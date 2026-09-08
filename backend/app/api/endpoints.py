import os
import json
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.core.config import UPLOADS_DIR, STEMS_DIR, SESSIONS_DIR, SUPPORTED_EXTENSIONS
from app.services.mir_analyzer import MirAnalyzer
from app.services.transcription import StringInstrumentTranscriber
from app.services.separation import StemSeparatorService
from app.api.websocket import ws_manager

logger = logging.getLogger("endpoints")
router = APIRouter()

# In-memory tracking of jobs
JOBS: Dict[str, Dict[str, Any]] = {}

class UploadResponse(BaseModel):
    track_id: str
    filename: str
    status: str
    message: str

def _run_pipeline_blocking(track_id: str, file_path: Path, filename: str, main_loop: asyncio.AbstractEventLoop):
    """Ejecuta la separación y MIR en un hilo de trabajo con notificación síncrona/hilo seguro a asyncio."""
    track_stems_dir = STEMS_DIR / track_id
    track_stems_dir.mkdir(parents=True, exist_ok=True)
    abs_audio_path = str(file_path.resolve())

    def update_progress(pct: int, msg: str, stage: str = "PROCESSING", extra: dict = None):
        if track_id in JOBS:
            JOBS[track_id]["progress"] = pct
            JOBS[track_id]["message"] = msg
            JOBS[track_id]["stage"] = stage
        logger.info(f"[{track_id[:8]}] {pct}% | {stage} | {msg}")
        try:
            asyncio.run_coroutine_threadsafe(
                ws_manager.broadcast_progress(track_id, pct, stage, msg, extra),
                main_loop
            )
        except Exception as err:
            logger.warning(f"Error despachando evento WS a main_loop: {err}")

    try:
        update_progress(10, "Iniciando pipeline y cargando audio...", "INITIALIZING")

        # 1. Separación de Stems
        update_progress(25, "Separando pistas en 6 stems con Demucs v4...", "SEPARATION")
        stems_dict = StemSeparatorService.separate(
            abs_audio_path,
            track_stems_dir,
            progress_callback=lambda p, m: update_progress(p, m, "SEPARATION")
        )

        # 2. Análisis Armónico (BPM, Key, Beats, Chords)
        update_progress(75, "Detectando tempo, tonalidad y acordes...", "HARMONIC_ANALYSIS")
        mir_data = MirAnalyzer.analyze(abs_audio_path)

        # 3. Transcripción de Guitarra a Tablatura
        update_progress(88, "Transcribiendo digitación de cuerdas...", "TRANSCRIPTION")
        guitar_stem = track_stems_dir / "guitar.wav"
        transcription_target = str(guitar_stem.resolve()) if guitar_stem.exists() else abs_audio_path
        notes = StringInstrumentTranscriber.transcribe(transcription_target, instrument="guitar")

        # 4. Construir URLs públicas relativas para el frontend
        stems_urls = {
            stem_name: f"/stems/{track_id}/{filename_wav}"
            for stem_name, filename_wav in stems_dict.items()
        }

        session_data = {
            "track_id": track_id,
            "metadata": {
                "title": Path(filename).stem,
                "duration_seconds": mir_data.duration,
                "bpm": mir_data.bpm,
                "key": mir_data.key,
                "time_signature": mir_data.time_signature,
            },
            "stems": stems_urls,
            "beat_grid": mir_data.beat_grid,
            "chords": [c.model_dump() for c in mir_data.chords],
            "guitar_transcription": [n.model_dump() for n in notes]
        }

        session_file = SESSIONS_DIR / f"{track_id}.json"
        with open(session_file, "w", encoding="utf-8") as f:
            json.dump(session_data, f, indent=2)

        if track_id in JOBS:
            JOBS[track_id]["status"] = "COMPLETED"
            JOBS[track_id]["progress"] = 100
            JOBS[track_id]["message"] = "¡Pistas y análisis listos!"
            JOBS[track_id]["data"] = session_data

        update_progress(100, "¡Pistas y análisis listos!", "COMPLETED", extra=session_data)

    except Exception as e:
        logger.exception(f"Error procesando track {track_id}: {e}")
        if track_id in JOBS:
            JOBS[track_id]["status"] = "ERROR"
            JOBS[track_id]["message"] = str(e)
        update_progress(0, f"Error: {str(e)}", "ERROR")

async def run_track_pipeline(track_id: str, file_path: Path, filename: str):
    """Wrapper asíncrono para ejecutar el pipeline sin bloquear el bucle de eventos."""
    loop = asyncio.get_running_loop()
    await asyncio.to_thread(_run_pipeline_blocking, track_id, file_path, filename, loop)

@router.post("/tracks/upload", response_model=UploadResponse)
async def upload_audio_track(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extensión no permitida. Formatos aceptados: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    track_id = str(uuid.uuid4())
    save_path = UPLOADS_DIR / f"{track_id}{ext}"

    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    JOBS[track_id] = {
        "status": "QUEUED",
        "progress": 5,
        "stage": "QUEUED",
        "message": "Archivo recibido. Iniciando procesamiento...",
        "filename": file.filename,
        "path": str(save_path),
        "data": None
    }

    background_tasks.add_task(run_track_pipeline, track_id, save_path, file.filename)

    return UploadResponse(
        track_id=track_id,
        filename=file.filename,
        status="QUEUED",
        message="Archivo recibido. Tarea de separación y análisis encolada."
    )

@router.get("/tracks/{track_id}/status")
async def get_track_status(track_id: str):
    # Si existe en memoria
    if track_id in JOBS:
        job = JOBS[track_id]
        return {
            "track_id": track_id,
            "status": job["status"],
            "progress": job["progress"],
            "stage": job.get("stage", "PROCESSING"),
            "message": job["message"],
            "data": job.get("data")
        }

    # Si ya existe en disco
    session_file = SESSIONS_DIR / f"{track_id}.json"
    if session_file.exists():
        with open(session_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {
            "track_id": track_id,
            "status": "COMPLETED",
            "progress": 100,
            "stage": "COMPLETED",
            "message": "Sesión lista en disco.",
            "data": data
        }

    raise HTTPException(status_code=404, detail="Track ID no encontrado.")

@router.get("/tracks/{track_id}/session")
async def get_track_session(track_id: str):
    session_file = SESSIONS_DIR / f"{track_id}.json"
    if session_file.exists():
        with open(session_file, "r", encoding="utf-8") as f:
            return json.load(f)

    if track_id in JOBS and JOBS[track_id].get("data"):
        return JOBS[track_id]["data"]

    raise HTTPException(status_code=404, detail="Sesión no encontrada o aún en proceso.")

@router.get("/tracks")
async def list_available_tracks():
    """Retorna la lista de todas las sesiones de audio disponibles."""
    sessions = []
    for f in SESSIONS_DIR.glob("*.json"):
        try:
            with open(f, "r", encoding="utf-8") as s_file:
                s_data = json.load(s_file)
                sessions.append({
                    "track_id": s_data.get("track_id", f.stem),
                    "title": s_data.get("metadata", {}).get("title", f.stem),
                    "duration": s_data.get("metadata", {}).get("duration_seconds", 0),
                    "bpm": s_data.get("metadata", {}).get("bpm", 0),
                    "key": s_data.get("metadata", {}).get("key", ""),
                })
        except Exception:
            continue
    return sessions

@router.websocket("/ws/tracks/{track_id}")
async def websocket_track_progress(websocket: WebSocket, track_id: str):
    await ws_manager.connect(track_id, websocket)
    try:
        # Enviar estado actual inmediato si ya existe en memoria o disco
        if track_id in JOBS:
            job = JOBS[track_id]
            await websocket.send_json({
                "track_id": track_id,
                "progress": job["progress"],
                "stage": job.get("stage", "PROCESSING"),
                "message": job["message"],
                "data": job.get("data")
            })
        else:
            session_file = SESSIONS_DIR / f"{track_id}.json"
            if session_file.exists():
                with open(session_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                await websocket.send_json({
                    "track_id": track_id,
                    "progress": 100,
                    "stage": "COMPLETED",
                    "message": "Sesión lista en disco.",
                    "data": data
                })

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(track_id, websocket)
    except Exception as e:
        logger.warning(f"Excepción en WS de {track_id}: {e}")
        ws_manager.disconnect(track_id, websocket)

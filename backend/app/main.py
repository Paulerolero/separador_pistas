import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import STEMS_DIR, SESSIONS_DIR, CORS_ORIGINS
from app.api.endpoints import router as api_router
from app.services.demo_generator import create_demo_session_if_needed

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("main")
FRONTEND_DIR = os.environ.get("STEMLAB_FRONTEND_DIR")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando Music Practice & Stem Lab Backend...")
    # Asegurar sesión de demostración
    try:
        demo_id = create_demo_session_if_needed()
        logger.info(f"Sesión demo preparada: {demo_id}")
    except Exception as e:
        logger.error(f"No se pudo inicializar la demo: {e}")
    yield
    logger.info("Deteniendo servidor...")

app = FastAPI(
    title="Music Practice & Stem Lab API",
    version="1.0.0",
    description="Backend para separación de stems, análisis armónico (Key/BPM/Acordes) y transcripción de tablatura.",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permitir acceso desde Vite dev y empaquetados
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar directorio estático para servir stems de audio decodificables por Web Audio API
app.mount("/stems", StaticFiles(directory=str(STEMS_DIR)), name="stems")

# Incluir endpoints de la API
app.include_router(api_router, prefix="/api/v1")

if FRONTEND_DIR:
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

@app.get("/")
def read_root():
    return {
        "app": "Music Practice & Stem Lab",
        "status": "online",
        "endpoints": {
            "upload": "POST /api/v1/tracks/upload",
            "session": "GET /api/v1/tracks/{track_id}/session",
            "demo": "GET /api/v1/tracks/demo-session/session",
            "websocket": "WS /api/v1/ws/tracks/{track_id}"
        }
    }

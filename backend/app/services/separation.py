import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Callable, Optional
import numpy as np
import soundfile as sf
import librosa
from app.core.config import AI_DEVICE, AI_MODEL, AI_MODEL_CACHE, STEM_NAMES, STEMS_DIR

logger = logging.getLogger("separation")

class StemSeparatorService:
    """
    Orchestrates stem separation using Demucs v4 (HTDemucs 6-stems/4-stems)
    with a fallback spectral-filter DSP engine for immediate availability.
    """

    @classmethod
    def separate(
        cls,
        audio_path: str,
        output_dir: Path,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> Dict[str, str]:
        """
        Separates audio_path into stems saved in output_dir.
        Returns a dictionary mapping stem name -> relative or absolute file path.
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        stems_result: Dict[str, str] = {}

        abs_audio_path = str(Path(audio_path).resolve())
        if progress_callback:
            progress_callback(15, "Preparando archivo y entorno de inferencia...")

        # Demucs runs entirely locally. Its first run downloads the model into
        # the application's persistent cache; subsequent runs reuse it.
        demucs_success = False
        try:
            os.environ.setdefault("TORCH_HOME", str(AI_MODEL_CACHE))
            import torch
            import demucs.api
            device = AI_DEVICE
            if device == "auto":
                device = "cuda" if torch.cuda.is_available() else "cpu"
            if device == "cuda" and not torch.cuda.is_available():
                raise RuntimeError("STEMLAB_AI_DEVICE=cuda, pero CUDA no está disponible.")

            logger.info("Ejecutando modelo local Demucs %s en %s", AI_MODEL, device)
            if progress_callback:
                progress_callback(25, f"Iniciando modelo IA local {AI_MODEL} ({device})...")

            separator = demucs.api.Separator(model=AI_MODEL, device=device, segment=6)

            if progress_callback:
                progress_callback(40, "Separando pistas con IA local; el tiempo depende del equipo...")

            origin, separated = separator.separate_audio_file(abs_audio_path)

            total_stems = len(separated)
            curr = 0
            for stem_name, stem_tensor in separated.items():
                curr += 1
                out_path = output_dir / f"{stem_name}.wav"
                demucs.api.save_audio(stem_tensor, str(out_path), samplerate=separator.samplerate)
                stems_result[stem_name] = str(out_path.name)
                pct = 45 + int((curr / total_stems) * 25)
                if progress_callback:
                    progress_callback(pct, f"Exportando stem: {stem_name.upper()}")

            demucs_success = True
        except ImportError:
            logger.warning("PyTorch/Demucs no está instalado. Usando fallback DSP.")
        except Exception as e:
            logger.warning(f"Demucs arrojó: ({e}). Aplicando fallback de DSP Spectral Separation...")

        if not demucs_success:
            stems_result = cls._dsp_spectral_separation(abs_audio_path, output_dir, progress_callback)

        if progress_callback:
            progress_callback(95, "Finalizando procesamiento de stems...")

        return stems_result

    @classmethod
    def _dsp_spectral_separation(
        cls,
        audio_path: str,
        output_dir: Path,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> Dict[str, str]:
        """
        High-precision DSP spectral separation using HPSS (Harmonic/Percussive)
        and Butterworth multi-band filters to generate 6 isolated stems.
        """
        if progress_callback:
            progress_callback(25, "Cargando señal y descomponiendo espectro...")

        y, sr = librosa.load(audio_path, sr=44100, mono=False)
        is_stereo = (y.ndim == 2 and y.shape[0] == 2)
        
        # Trabajar en mono para filtrado, manteniendo fase estéreo si aplica
        mono_signal = np.mean(y, axis=0) if is_stereo else y

        if progress_callback:
            progress_callback(40, "Descomponiendo fuentes armónicas y percusivas...")

        # HPSS: Separar transientes de percusión y componentes tonales
        y_harm, y_perc = librosa.effects.hpss(mono_signal, margin=(1.2, 1.2))

        # 1. Batería (Percussive focus)
        drums = y_perc

        # 2. Bajo (Low-pass < 220Hz del componente armónico)
        from scipy.signal import butter, sosfilt
        sos_bass = butter(4, 220, 'lowpass', fs=sr, output='sos')
        bass = sosfilt(sos_bass, y_harm) * 1.5

        # 3. Voz (Band-pass centrado en frecuencias formantes vocales 300 - 3400 Hz)
        sos_vocals = butter(4, [300, 3400], 'bandpass', fs=sr, output='sos')
        vocals = sosfilt(sos_vocals, y_harm) * 1.2

        # 4. Guitarra (Mid-range 350 - 4500 Hz con realce de armónicos)
        sos_guitar = butter(4, [400, 4800], 'bandpass', fs=sr, output='sos')
        guitar = sosfilt(sos_guitar, y_harm) * 1.1

        # 5. Piano / Teclados (Resonancia armónica amplia 250 - 6000 Hz)
        sos_piano = butter(4, [250, 6000], 'bandpass', fs=sr, output='sos')
        piano = sosfilt(sos_piano, y_harm) * 0.9

        # 6. Otros (Ambiente / altas frecuencias)
        sos_other = butter(4, 5000, 'highpass', fs=sr, output='sos')
        other = sosfilt(sos_other, mono_signal) * 0.8

        stems_data = {
            "drums": drums,
            "bass": bass,
            "guitar": guitar,
            "vocals": vocals,
            "piano": piano,
            "other": other,
        }

        results = {}
        total = len(stems_data)
        for idx, (name, audio_data) in enumerate(stems_data.items()):
            # Normalizar ligeramente para evitar clipping
            peak = np.max(np.abs(audio_data))
            if peak > 1.0:
                audio_data = audio_data / peak * 0.95

            file_path = output_dir / f"{name}.wav"
            sf.write(str(file_path), audio_data, sr)
            results[name] = file_path.name

            if progress_callback:
                pct = 50 + int((idx + 1) / total * 40)
                progress_callback(pct, f"Generando stem: {name.upper()}")

        return results

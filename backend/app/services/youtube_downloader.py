import re
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
import yt_dlp
import imageio_ffmpeg

logger = logging.getLogger("youtube_downloader")

YOUTUBE_REGEX = re.compile(
    r'^(https?://)?(www\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)([\w\-]{11})'
)

class YouTubeDownloaderService:
    """
    Downloads audio directly from YouTube URLs and converts it to high-quality MP3/WAV
    using yt-dlp and the bundled imageio-ffmpeg binary.
    """

    @classmethod
    def is_valid_youtube_url(cls, url: str) -> bool:
        if not url or not isinstance(url, str):
            return False
        clean_url = url.strip()
        return bool(YOUTUBE_REGEX.search(clean_url))

    @classmethod
    def extract_info(cls, url: str) -> Dict[str, Any]:
        """Extrae metadatos del video sin descargarlo aún."""
        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url.strip(), download=False)
            return {
                "id": info.get("id"),
                "title": info.get("title", "YouTube Track"),
                "duration": info.get("duration", 0),
                "uploader": info.get("uploader", "Artista"),
                "thumbnail": info.get("thumbnail", ""),
            }

    @classmethod
    def download_audio(
        cls,
        url: str,
        output_dir: Path,
        track_id: str,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Descarga el stream de audio óptimo y lo convierte a formato WAV o MP3.
        Retorna metadatos y la ruta absoluta del archivo descargado.
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        logger.info(f"Usando binario FFmpeg en: {ffmpeg_exe}")

        if progress_callback:
            progress_callback(5, "Conectando con YouTube y analizando streams de audio...")

        output_template = str(output_dir / f"{track_id}.%(ext)s")

        def ydl_hook(d):
            if d['status'] == 'downloading':
                total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate') or 1
                downloaded_bytes = d.get('downloaded_bytes', 0)
                pct = int((downloaded_bytes / total_bytes) * 15) + 5
                speed = d.get('_speed_str', '')
                eta = d.get('_eta_str', '')
                msg = f"Descargando audio de YouTube... {speed} (ETA: {eta})" if speed else "Descargando audio de YouTube..."
                if progress_callback:
                    progress_callback(min(pct, 20), msg)
            elif d['status'] == 'finished':
                if progress_callback:
                    progress_callback(22, "Extracción de audio completada. Convirtiendo señal...")

        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_template,
            'ffmpeg_location': ffmpeg_exe,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'progress_hooks': [ydl_hook],
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            meta = ydl.extract_info(url.strip(), download=True)
            video_title = meta.get("title", f"YouTube_{track_id[:8]}")
            duration = meta.get("duration", 0)
            uploader = meta.get("uploader", "")
            thumbnail = meta.get("thumbnail", "")

        # El archivo final exportado por FFmpegExtractAudio será .mp3
        final_file = output_dir / f"{track_id}.mp3"
        if not final_file.exists():
            # Buscar cualquier archivo generado con el prefijo track_id
            candidates = list(output_dir.glob(f"{track_id}.*"))
            if candidates:
                final_file = candidates[0]
            else:
                raise FileNotFoundError(f"No se encontró el archivo de audio descargado para {track_id}")

        logger.info(f"Audio descargado con éxito: {final_file} ({video_title})")

        return {
            "file_path": final_file,
            "title": video_title,
            "duration": duration,
            "uploader": uploader,
            "thumbnail": thumbnail,
        }

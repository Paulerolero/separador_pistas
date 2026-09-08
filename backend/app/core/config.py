import os
from pathlib import Path

# Use a writable directory beside the executable when packaged, while keeping
# the existing backend/storage location for development.
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = Path(os.environ.get("STEMLAB_DATA_DIR", BACKEND_DIR / "storage"))
UPLOADS_DIR = STORAGE_DIR / "uploads"
STEMS_DIR = STORAGE_DIR / "stems"
SESSIONS_DIR = STORAGE_DIR / "sessions"
DEMO_DIR = STORAGE_DIR / "demo"
MODEL_DIR = STORAGE_DIR / "models"

# Create directories if they don't exist
for folder in [STORAGE_DIR, UPLOADS_DIR, STEMS_DIR, SESSIONS_DIR, DEMO_DIR, MODEL_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

# Audio & Demucs config
STEM_NAMES = ["drums", "bass", "guitar", "vocals", "piano", "other"]
SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}

# Server settings
HOST = "127.0.0.1"
PORT = 8000
AI_MODEL = os.environ.get("STEMLAB_AI_MODEL", "htdemucs_6s")
AI_DEVICE = os.environ.get("STEMLAB_AI_DEVICE", "auto").lower()
AI_MODEL_CACHE = MODEL_DIR
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

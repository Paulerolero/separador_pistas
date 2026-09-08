import os
import sys
import threading
import time
import webbrowser
from pathlib import Path


def application_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


_APPLICATION_DIR = application_dir()
_BUNDLE_ROOT = Path(getattr(sys, "_MEIPASS", _APPLICATION_DIR))
os.environ.setdefault("STEMLAB_DATA_DIR", str(_APPLICATION_DIR / "data"))
os.environ.setdefault("STEMLAB_FRONTEND_DIR", str(_BUNDLE_ROOT / "frontend_dist"))
_BACKEND_DIR = _BUNDLE_ROOT / "backend"
sys.path.insert(0, str(_BACKEND_DIR))

import uvicorn
from app.main import app


def main() -> None:
    data_dir = _APPLICATION_DIR / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    url = "http://127.0.0.1:8000"

    def open_browser() -> None:
        time.sleep(1.5)
        webbrowser.open(url)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")


if __name__ == "__main__":
    main()

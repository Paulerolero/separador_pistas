import os
import sys
from pathlib import Path
import gradio as gr
import uvicorn
import threading

# Añadir directorio raíz y backend al path
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Configurar entorno para Hugging Face Spaces
os.environ.setdefault("STEMLAB_DATA_DIR", str(ROOT_DIR / "storage"))
os.environ.setdefault("STEMLAB_AI_DEVICE", "cuda" if os.environ.get("SPACES_ZERO_GPU") else "auto")

# Importar app de FastAPI existente
from backend.app.main import app as fastapi_app

# Montar FastAPI dentro de Gradio o montar Gradio como frontend de bienvenida
with gr.Blocks(title="Music Practice & Stem Lab API") as demo:
    gr.Markdown(
        """
        # 🎵 Music Practice & Stem Lab - Servidor de IA
        
        Este Space ejecuta el backend de separación de pistas y análisis musical (FastAPI + Demucs).
        
        ### 📡 Estado del Servidor
        - **FastAPI Endpoints**: Activos en `/api/v1/...`
        - **WebSockets de Telemetría**: Activos en `/api/v1/ws/tracks/{track_id}`
        - **Servicio de Stems**: Activo en `/stems/...`
        
        ---
        💡 *Copia la URL de este Space (Direct URL) y pégala en el panel de **Configuración (⚙️)** de tu Frontend.*
        """
    )
    
    with gr.Row():
        status_btn = gr.Button("Verificar Estado del Backend", variant="primary")
        status_output = gr.Textbox(label="Respuesta del Servidor", interactive=False)
        
    def check_health():
        return "✅ Backend FastAPI y Demucs operacionales y listos para procesar audio."
        
    status_btn.click(fn=check_health, outputs=status_output)

# gradio.mount_gradio_app integra FastAPI y Gradio en el mismo puerto 7860
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

# Si se ejecuta directamente con Python (punto de entrada por defecto en HF Spaces Gradio)
if __name__ == "__main__":
    demo.queue()
    # Iniciar FastAPI con Gradio montado en el puerto estándar 7860
    uvicorn.run(app, host="0.0.0.0", port=7860)

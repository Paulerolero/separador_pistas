FROM python:3.10-slim

# Instalar dependencias del sistema necesarias para procesamiento de audio y compilar paquetes C/C++
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario sin privilegios root requerido por las políticas de Hugging Face Spaces (UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    STEMLAB_DATA_DIR=/home/user/app/storage \
    STEMLAB_AI_DEVICE=cpu

WORKDIR /home/user/app

# Copiar requirements e instalar con pip
COPY --chown=user:user backend/requirements.txt requirements.txt

# Instalar PyTorch CPU primero para optimizar tamaño del contenedor y tiempo de build
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Pre-descargar el modelo Demucs htdemucs_6s durante el build para que los arranques sean instantáneos
RUN python3 -c "import demucs.pretrained; demucs.pretrained.get_model('htdemucs_6s')"

# Copiar el código del backend
COPY --chown=user:user backend/ /home/user/app/

# Hugging Face Spaces expone el puerto 7860 por defecto
EXPOSE 7860

# Iniciar Uvicorn en el puerto 7860 y 0.0.0.0
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]

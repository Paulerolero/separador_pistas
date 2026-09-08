import React, { useState, useRef } from 'react';
import { UploadCloud, X, Loader2, AlertCircle, FileAudio } from 'lucide-react';
import type { SessionData } from '../audio/types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionLoaded: (session: SessionData) => void;
  apiUrl?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onSessionLoaded,
  apiUrl = 'http://127.0.0.1:8000',
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      validateAndSetFile(selected);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    const validExts = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];
    const hasValidExt = validExts.some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setErrorMessage('Por favor selecciona un archivo de audio válido (MP3, WAV, FLAC, OGG).');
      return;
    }
    setErrorMessage('');
    setFile(f);
  };

  const handleStartProcessing = async () => {
    if (!file) return;

    setIsUploading(true);
    setProgress(5);
    setStageMessage('Subiendo archivo al servidor...');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResp = await fetch(`${apiUrl}/api/v1/tracks/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResp.ok) {
        throw new Error(`Error en subida: ${uploadResp.statusText}`);
      }

      const uploadData = await uploadResp.json();
      const trackId = uploadData.track_id;

      // Iniciar conexión WebSocket para telemetría
      connectWebSocket(trackId);
    } catch (err: unknown) {
      console.error(err);
      setIsUploading(false);
      const message = err instanceof Error ? err.message : 'Error desconocido al subir';
      setErrorMessage(message || 'Error al conectar con el servidor.');
    }
  };

  const connectWebSocket = (trackId: string) => {
    const wsUrl = apiUrl.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
    let ws: WebSocket | null = null;
    let pollInterval: number | null = null;

    const startPollingFallback = (id: string) => {
      if (pollInterval) return;
      pollInterval = window.setInterval(async () => {
        try {
          const statusResp = await fetch(`${apiUrl}/api/v1/tracks/${id}/status`);
          if (statusResp.ok) {
            const st = await statusResp.json();
            setProgress(st.progress);
            setStageMessage(st.message);
            if (st.status === 'COMPLETED') {
              clearInterval(pollInterval!);
              fetchFinalSession(id);
            } else if (st.status === 'ERROR') {
              clearInterval(pollInterval!);
              setErrorMessage(st.message);
              setIsUploading(false);
            }
          }
        } catch {
          // Reintentar
        }
      }, 1200);
    };

    try {
      ws = new WebSocket(`${wsUrl}/api/v1/ws/tracks/${trackId}`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.progress !== undefined) {
            setProgress(data.progress);
          }
          if (data.message) {
            setStageMessage(data.message);
          }
          if (data.stage === 'COMPLETED' || data.progress === 100) {
            fetchFinalSession(trackId);
            if (ws) ws.close();
            if (pollInterval) clearInterval(pollInterval);
          } else if (data.stage === 'ERROR') {
            setErrorMessage(data.message || 'Ocurrió un fallo en el procesamiento');
            setIsUploading(false);
            if (ws) ws.close();
            if (pollInterval) clearInterval(pollInterval);
          }
        } catch {
          // Ignorar error de parsing
        }
      };

      ws.onerror = () => {
        startPollingFallback(trackId);
      };
    } catch {
      startPollingFallback(trackId);
    }
  };

  const fetchFinalSession = async (trackId: string) => {
    try {
      const resp = await fetch(`${apiUrl}/api/v1/tracks/${trackId}/session`);
      if (!resp.ok) throw new Error('No se pudo descargar la sesión procesada');
      const sessionData = await resp.json();
      onSessionLoaded(sessionData);
      setIsUploading(false);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al obtener sesión';
      setErrorMessage(message);
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Separador de Pistas & Análisis</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Soporte para MP3, WAV, FLAC con Demucs v4 y detección armónica
            </p>
          </div>
          {!isUploading && (
            <button onClick={onClose} className="btn btn-icon">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Zona de Selección o Drag & Drop */}
        {!isUploading && (
          <>
            <div
              className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.flac,.ogg,.m4a"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(0, 229, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)'
                }}>
                  <UploadCloud size={28} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {file ? file.name : 'Arrastra tu archivo de audio aquí'}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    o haz clic para explorar en tu equipo
                  </p>
                </div>
                {file && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.06)',
                    padding: '0.35rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    color: 'var(--accent-cyan)'
                  }}>
                    <FileAudio size={14} />
                    <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                )}
              </div>
            </div>

            {errorMessage && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--accent-danger)',
                fontSize: '0.825rem',
                background: 'rgba(255, 23, 68, 0.1)',
                padding: '0.6rem 0.9rem',
                borderRadius: 'var(--radius-sm)'
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleStartProcessing}
              disabled={!file}
              className="btn btn-primary"
              style={{ padding: '0.75rem', width: '100%', fontSize: '0.95rem', opacity: file ? 1 : 0.5 }}
            >
              Iniciar Separación y Análisis
            </button>
          </>
        )}

        {/* Estado de Progreso de Procesamiento */}
        {isUploading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={24} className="animate-spin" color="var(--accent-cyan)" style={{ animation: 'spin 1.5s linear infinite' }} />
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Procesando Audio con IA</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{stageMessage}</p>
              </div>
            </div>

            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Etapa: Demucs 6-Stems + MIR</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{progress}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

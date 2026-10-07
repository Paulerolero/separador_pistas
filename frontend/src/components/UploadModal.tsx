import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  X,
  Loader2,
  AlertCircle,
  FileAudio,
  Sparkles,
} from 'lucide-react';
import { YoutubeIcon } from './YoutubeIcon';
import type { SessionData } from '../audio/types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionLoaded: (session: SessionData) => void;
  apiUrl?: string;
}

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w\-]{11})/;

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onSessionLoaded,
  apiUrl = 'http://127.0.0.1:8000',
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('youtube');
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const isYoutubeValid = YOUTUBE_REGEX.test(youtubeUrl.trim());

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
      setErrorMessage('Por favor selecciona un archivo de audio válido (MP3, WAV, FLAC, OGG, M4A).');
      return;
    }
    setErrorMessage('');
    setFile(f);
  };

  const handleStartProcessingFile = async () => {
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

      connectWebSocket(trackId);
    } catch (err: unknown) {
      console.error(err);
      setIsUploading(false);
      const message = err instanceof Error ? err.message : 'Error desconocido al subir';
      setErrorMessage(message || 'Error al conectar con el servidor.');
    }
  };

  const handleStartProcessingYouTube = async () => {
    if (!isYoutubeValid) {
      setErrorMessage('Por favor ingresa un enlace de YouTube válido.');
      return;
    }

    setIsUploading(true);
    setProgress(5);
    setStageMessage('Conectando con YouTube y extrayendo stream...');
    setErrorMessage('');

    try {
      const resp = await fetch(`${apiUrl}/api/v1/tracks/youtube`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: youtubeUrl.trim(),
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => null);
        throw new Error(errorData?.detail || `Error descargando de YouTube: ${resp.statusText}`);
      }

      const data = await resp.json();
      const trackId = data.track_id;

      connectWebSocket(trackId);
    } catch (err: unknown) {
      console.error(err);
      setIsUploading(false);
      const message = err instanceof Error ? err.message : 'Error al procesar YouTube';
      setErrorMessage(message);
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
          // Reintentar en siguiente ciclo
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
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Cargar Canción & Extraer Stems</span>
              <span className="badge-pill" style={{ background: 'rgba(0, 229, 255, 0.15)', color: 'var(--accent-cyan)', fontSize: '0.65rem' }}>
                IA + Tablatura
              </span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Separa voces, guitarra, bajo y genera tablatura interactiva estilo Songsterr
            </p>
          </div>
          {!isUploading && (
            <button onClick={onClose} className="btn btn-icon">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Selector de modo: YouTube vs Archivo local */}
        {!isUploading && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', background: 'rgba(0, 0, 0, 0.25)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => { setActiveTab('youtube'); setErrorMessage(''); }}
              className={`pill-btn ${activeTab === 'youtube' ? 'active' : ''}`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: activeTab === 'youtube' ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: activeTab === 'youtube' ? '#e50914' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <YoutubeIcon size={16} />
              <span>Enlace de YouTube</span>
            </button>
            <button
              onClick={() => { setActiveTab('file'); setErrorMessage(''); }}
              className={`pill-btn ${activeTab === 'file' ? 'active' : ''}`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: activeTab === 'file' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                backgroundColor: activeTab === 'file' ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <UploadCloud size={16} />
              <span>Archivo de Audio</span>
            </button>
          </div>
        )}

        {/* Tab 1: Extractor de YouTube */}
        {!isUploading && activeTab === 'youtube' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pega la URL de la canción en YouTube:
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setYoutubeUrl(text.trim());
                    } catch {
                      // ignore
                    }
                  }}
                  className="pill-btn mini"
                  style={{ fontSize: '0.7rem', padding: '1px 6px' }}
                  title="Pegar automáticamente lo que tengas copiado"
                >
                  📋 Pegar Portapapeles
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '0.85rem', color: isYoutubeValid ? '#ff0033' : 'var(--text-muted)' }}>
                  <YoutubeIcon size={18} />
                </div>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isYoutubeValid) {
                      handleStartProcessingYouTube();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: `1px solid ${isYoutubeValid ? 'rgba(255, 0, 51, 0.6)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxShadow: isYoutubeValid ? '0 0 10px rgba(255, 0, 51, 0.2)' : 'none',
                  }}
                />
                {youtubeUrl && (
                  <button
                    onClick={() => setYoutubeUrl('')}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                <Sparkles size={14} color="var(--accent-amber)" />
                <span>¿Cómo funciona la extracción?</span>
              </div>
              El sistema descargará el audio del video con <strong style={{ color: '#fff' }}>yt-dlp</strong>, separará las 6 pistas con <strong style={{ color: 'var(--accent-cyan)' }}>Demucs v4</strong> y transcribirá automáticamente la <strong style={{ color: 'var(--accent-magenta)' }}>tablatura para practicar</strong>.
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
                borderRadius: 'var(--radius-sm)',
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleStartProcessingYouTube}
              disabled={!isYoutubeValid}
              className="btn btn-primary"
              style={{
                padding: '0.75rem',
                width: '100%',
                fontSize: '0.95rem',
                fontWeight: 700,
                opacity: isYoutubeValid ? 1 : 0.45,
                background: isYoutubeValid
                  ? 'linear-gradient(135deg, #e50914 0%, #b20710 100%)'
                  : 'var(--bg-surface)',
                border: 'none',
                cursor: isYoutubeValid ? 'pointer' : 'not-allowed',
                boxShadow: isYoutubeValid ? '0 4px 14px rgba(229, 9, 20, 0.35)' : 'none',
              }}
            >
              Extraer de YouTube & Separar Pistas
            </button>
          </div>
        )}

        {/* Tab 2: Archivo Local */}
        {!isUploading && activeTab === 'file' && (
          <>
            <div
              className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ marginTop: '0.5rem' }}
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
                    Soporta MP3, WAV, FLAC, OGG, M4A
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
                borderRadius: 'var(--radius-sm)',
                marginTop: '0.5rem',
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleStartProcessingFile}
              disabled={!file}
              className="btn btn-primary"
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                width: '100%',
                fontSize: '0.95rem',
                opacity: file ? 1 : 0.5,
              }}
            >
              Iniciar Separación y Análisis
            </button>
          </>
        )}

        {/* Estado de Progreso de Procesamiento (WebSocket en vivo) */}
        {isUploading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={24} className="animate-spin" color="var(--accent-cyan)" style={{ animation: 'spin 1.5s linear infinite' }} />
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                  {activeTab === 'youtube' ? 'Extrayendo de YouTube & Procesando IA' : 'Procesando Audio con IA'}
                </span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{stageMessage}</p>
              </div>
            </div>

            <div className="progress-bar-track" style={{ height: '8px' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${progress}%`,
                  transition: 'width 0.4s ease-out',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Pipeline: YouTube / Demucs / Tablatura</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {progress}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

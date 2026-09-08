import React, { useState } from 'react';
import { Settings, X, CheckCircle2, AlertTriangle, Globe, Shield, RefreshCw, Flame } from 'lucide-react';
import {
  getEffectiveFirebaseConfig,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig,
} from '../firebase/config';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl: string;
  onSaveApiUrl: (url: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiUrl,
  onSaveApiUrl,
}) => {
  const [currentUrl, setCurrentUrl] = useState(apiUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const existingConfig = getEffectiveFirebaseConfig();
  const [apiKey, setApiKey] = useState(existingConfig?.apiKey || '');
  const [authDomain, setAuthDomain] = useState(existingConfig?.authDomain || '');
  const [projectId, setProjectId] = useState(existingConfig?.projectId || '');
  const [appId, setAppId] = useState(existingConfig?.appId || '');
  const [showFirebaseInputs, setShowFirebaseInputs] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const trimmed = currentUrl.replace(/\/$/, '');
      const resp = await fetch(`${trimmed}/`, { method: 'GET' });
      if (resp.ok) {
        setTestResult({ ok: true, message: '¡Conexión exitosa con el Backend de IA!' });
        onSaveApiUrl(trimmed);
      } else {
        setTestResult({ ok: false, message: `El servidor respondió con código ${resp.status}` });
      }
    } catch {
      setTestResult({
        ok: false,
        message: 'No se pudo conectar. Verifica que el backend esté corriendo y la URL sea accesible.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveFirebaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !projectId || !appId) {
      alert('Por favor ingresa al menos apiKey, projectId y appId.');
      return;
    }
    saveCustomFirebaseConfig({
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      projectId: projectId.trim(),
      appId: appId.trim(),
    });
  };

  const handleResetFirebaseConfig = () => {
    if (confirm('¿Deseas restaurar la configuración predeterminada de Firebase?')) {
      clearCustomFirebaseConfig();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Settings size={20} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Configuración y Nube</h3>
          </div>
          <button onClick={onClose} className="btn btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Sección 1: Servidor de IA (FastAPI / Demucs) */}
        <div className="settings-section">
          <div className="settings-section-header">
            <Globe size={16} color="var(--accent-cyan)" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Servidor de IA (Backend Demucs)</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Ingresa la URL de tu backend de IA local (ej. <code>http://127.0.0.1:8000</code>) o en la nube (ej. <code>https://tu-space.hf.space</code>).
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="text"
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              placeholder="http://127.0.0.1:8000 o https://tu-space.hf.space"
              className="settings-input"
              style={{ flex: 1 }}
            />
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            >
              {isTesting ? <RefreshCw size={14} className="animate-spin" /> : 'Probar'}
            </button>
          </div>

          {testResult && (
            <div
              className={`test-result-alert ${testResult.ok ? 'success' : 'error'}`}
              style={{ marginTop: '0.5rem' }}
            >
              {testResult.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Sección 2: Configuración Firebase (Google Auth & Firestore) */}
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="settings-section-header">
              <Flame size={16} color="var(--accent-amber)" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Firebase (Google Sign-In & Nube)</span>
            </div>
            <span
              className={`status-chip ${existingConfig ? 'active' : 'inactive'}`}
            >
              {existingConfig ? 'Configurado' : 'Pendiente'}
            </span>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Permite iniciar sesión con Google y sincronizar tu biblioteca de canciones y preferencias en cualquier dispositivo.
          </p>

          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={() => setShowFirebaseInputs(!showFirebaseInputs)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem' }}
            >
              <Shield size={13} />
              {showFirebaseInputs ? 'Ocultar Credenciales' : 'Ver / Editar Credenciales Firebase'}
            </button>
          </div>

          {showFirebaseInputs && (
            <form onSubmit={handleSaveFirebaseConfig} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              <div>
                <label className="settings-label">API Key (VITE_FIREBASE_API_KEY)</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="settings-input"
                  required
                />
              </div>

              <div>
                <label className="settings-label">Project ID</label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="tu-proyecto-firebase"
                  className="settings-input"
                  required
                />
              </div>

              <div>
                <label className="settings-label">Auth Domain</label>
                <input
                  type="text"
                  value={authDomain}
                  onChange={(e) => setAuthDomain(e.target.value)}
                  placeholder="tu-proyecto.firebaseapp.com"
                  className="settings-input"
                />
              </div>

              <div>
                <label className="settings-label">App ID</label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1:123456789:web:abcdef..."
                  className="settings-input"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button type="submit" className="btn btn-primary btn-sm">
                  Guardar y Recargar
                </button>
                {existingConfig && (
                  <button
                    type="button"
                    onClick={handleResetFirebaseConfig}
                    className="btn btn-secondary btn-sm"
                  >
                    Restablecer
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Sección 3: Despliegue en Firebase */}
        <div className="settings-section" style={{ background: 'rgba(0, 0, 0, 0.25)' }}>
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>
            🚀 ¿Cómo desplegar en Firebase Hosting?
          </span>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem', lineHeight: '1.4' }}>
            Los archivos <code>firebase.json</code> y <code>firestore.rules</code> ya están configurados en el proyecto. Para publicar tu versión web ejecuta en tu terminal:
          </p>
          <code style={{
            display: 'block',
            padding: '0.4rem 0.6rem',
            background: '#070a10',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: 'var(--accent-green)',
            marginTop: '0.3rem',
            fontFamily: 'var(--font-mono)'
          }}>
            npm run build &amp;&amp; npx firebase deploy --only hosting
          </code>
        </div>
      </div>
    </div>
  );
};

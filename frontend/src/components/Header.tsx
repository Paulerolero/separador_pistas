import React, { useState } from 'react';
import { Music2, UploadCloud, Sparkles, LogIn, LogOut, Settings, Library, User } from 'lucide-react';
import { useAuth } from '../firebase/useAuth';

interface HeaderProps {
  onOpenUpload: () => void;
  onLoadDemo: () => void;
  isLoadingDemo: boolean;
  onOpenLibrary: () => void;
  savedTracksCount: number;
  onOpenSettings: () => void;
  trackTitle?: string;
  keyName?: string;
  bpm?: number;
  currentChord?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenUpload,
  onLoadDemo,
  isLoadingDemo,
  onOpenLibrary,
  savedTracksCount,
  onOpenSettings,
  trackTitle,
  keyName,
  bpm,
  currentChord,
}) => {
  const { user, login, logout, isConfigured } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    if (!isConfigured) {
      onOpenSettings();
      return;
    }
    try {
      setIsLoggingIn(true);
      await login();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <header className="glass-panel compact-studio-header">
      {/* 1. Logotipo y Título de Estudio */}
      <div className="header-brand-group">
        <div className="brand-icon-box">
          <Music2 size={18} color="#000" strokeWidth={2.5} />
        </div>
        <div className="brand-text-wrap">
          <span className="brand-main-title">StemLab Studio</span>
          <span className="brand-mini-badge">AI MIR</span>
        </div>
      </div>

      {/* 2. HUD Compacto de Pista Activa (Título, Key, BPM, Acorde en vivo) */}
      <div className="header-track-hud">
        <span className="hud-title-text" title={trackTitle || 'Sin pista cargada'}>
          {trackTitle || 'Sesión de Estudio'}
        </span>

        <div className="hud-badges-row">
          <span className="hud-pill" title="Tonalidad">
            KEY: <strong>{keyName || '--'}</strong>
          </span>
          <span className="hud-pill hud-bpm" title="Tempo">
            {bpm ? bpm.toFixed(0) : '--'} <strong>BPM</strong>
          </span>
          {currentChord && currentChord !== '--' && (
            <span className="hud-pill hud-live-chord" title="Acorde en tiempo real">
              {currentChord}
            </span>
          )}
        </div>
      </div>

      {/* 3. Acciones & Biblioteca & Perfil de Usuario */}
      <div className="header-controls-group">
        <button
          onClick={onLoadDemo}
          disabled={isLoadingDemo}
          className="btn btn-demo btn-compact"
          title="Cargar pista de demostración"
        >
          <Sparkles size={14} />
          <span>{isLoadingDemo ? 'Cargando...' : 'Demo Jam'}</span>
        </button>

        <button
          onClick={onOpenUpload}
          className="btn btn-primary btn-compact"
          title="Subir canción (MP3, WAV, FLAC)"
        >
          <UploadCloud size={14} />
          <span>Subir</span>
        </button>

        <button
          onClick={onOpenLibrary}
          className="btn btn-secondary btn-compact"
          title="Ver mi biblioteca de canciones guardadas"
        >
          <Library size={14} color="var(--accent-cyan)" />
          <span>Mi Biblioteca</span>
          {savedTracksCount > 0 && <span className="count-tag">{savedTracksCount}</span>}
        </button>

        {/* Google Sign-in / Avatar de Usuario */}
        {user ? (
          <div className="user-profile-relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="user-avatar-btn"
              title={`Perfil: ${user.displayName || user.email}`}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'Usuario'} className="avatar-img" />
              ) : (
                <div className="avatar-fallback">
                  <User size={14} />
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="user-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                <div className="dropdown-user-info">
                  <p className="user-name">{user.displayName || 'Usuario'}</p>
                  <p className="user-email">{user.email}</p>
                </div>
                <div className="dropdown-divider" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenLibrary();
                  }}
                  className="dropdown-item"
                >
                  <Library size={14} /> Mis Canciones
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenSettings();
                  }}
                  className="dropdown-item"
                >
                  <Settings size={14} /> Ajustes & Nube
                </button>
                <div className="dropdown-divider" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="dropdown-item danger"
                >
                  <LogOut size={14} /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="btn btn-google-login btn-compact"
            title="Iniciar sesión con tu cuenta de Google"
          >
            <LogIn size={14} />
            <span>{isLoggingIn ? 'Iniciando...' : 'Acceder con Google'}</span>
          </button>
        )}

        {/* Botón de Ajustes */}
        <button
          onClick={onOpenSettings}
          className="btn btn-icon btn-compact-icon"
          title="Configuración de Red y Nube"
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
};

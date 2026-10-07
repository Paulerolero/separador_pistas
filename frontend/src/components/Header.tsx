import React, { useState, useEffect } from 'react';
import {
  Music2,
  Sparkles,
  LogIn,
  LogOut,
  Settings,
  Library,
  User,
  LayoutDashboard,
  FileMusic,
  Columns,
  Play,
  Pause,
  Square,
  RotateCcw,
  Activity,
  Maximize2,
  Minimize2,
  Gauge,
} from 'lucide-react';
import { YoutubeIcon } from './YoutubeIcon';
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
  activeView: 'studio' | 'tablature' | 'split';
  onSelectView: (view: 'studio' | 'tablature' | 'split') => void;
  // Transport Props integrados
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  metronomeActive: boolean;
  loopA: number | null;
  loopB: number | null;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onToggleMetronome: () => void;
  onSetLoopA: () => void;
  onSetLoopB: () => void;
  onClearLoop: () => void;
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
  activeView,
  onSelectView,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  metronomeActive,
  loopA,
  loopB,
  onPlayPause,
  onStop,
  onSeek,
  onSetPlaybackRate,
  onToggleMetronome,
  onSetLoopA,
  onSetLoopB,
  onClearLoop,
}) => {
  const { user, login, logout, isConfigured } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(pct * duration);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const speedOptions = [0.5, 0.75, 0.9, 1.0];

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
    <header className="glass-panel unified-studio-header">
      {/* 1. SECCIÓN IZQUIERDA: Marca & HUD Musical */}
      <div className="header-left-col">
        <div className="header-brand-group">
          <div className="brand-icon-box">
            <Music2 size={16} color="#000" strokeWidth={2.8} />
          </div>
          <span className="brand-main-title">StemLab</span>
        </div>

        <div className="header-track-hud-compact">
          <span className="hud-title-text" title={trackTitle || 'Sesión de Estudio'}>
            {trackTitle || 'Sesión de Estudio'}
          </span>
          <div className="hud-badges-row-mini">
            <span className="hud-pill-mini">KEY: <strong>{keyName || '--'}</strong></span>
            <span className="hud-pill-mini hud-bpm">{bpm ? bpm.toFixed(0) : '--'} <strong>BPM</strong></span>
            {currentChord && currentChord !== '--' && (
              <span className="hud-pill-mini hud-live-chord" title="Acorde actual">
                {currentChord}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. SECCIÓN CENTRAL: TRANSPORTE UNIFICADO TÁCTIL (Elimina barras duplicadas) */}
      <div className="header-transport-col">
        <button
          onClick={onPlayPause}
          className={`master-play-btn ${isPlaying ? 'playing' : ''}`}
          title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
        >
          {isPlaying ? <Pause size={18} fill="#000" /> : <Play size={18} fill="#000" style={{ marginLeft: '2px' }} />}
        </button>

        <button
          onClick={onStop}
          className="btn btn-icon btn-header-icon"
          title="Detener reproducción"
        >
          <Square size={13} />
        </button>

        <button
          onClick={() => onSeek(0)}
          className="btn btn-icon btn-header-icon"
          title="Reiniciar al inicio"
        >
          <RotateCcw size={14} />
        </button>

        {/* Scrubber con Tiempo en Vivo */}
        <div className="header-scrubber-group">
          <span className="header-time-text">{formatTime(currentTime)}</span>
          <div className="header-progress-track" onClick={handleProgressBarClick} title="Saltar a posición">
            <div className="header-progress-bar" style={{ width: `${progressPercent}%` }} />
            {loopA !== null && duration > 0 && (
              <div className="loop-marker marker-a" style={{ left: `${(loopA / duration) * 100}%` }} />
            )}
            {loopB !== null && duration > 0 && (
              <div className="loop-marker marker-b" style={{ left: `${(loopB / duration) * 100}%` }} />
            )}
          </div>
          <span className="header-duration-text">{formatTime(duration)}</span>
        </div>

        {/* Selector de Velocidad Time-Stretch */}
        <div className="header-speed-selector">
          <Gauge size={12} color="var(--text-muted)" />
          {speedOptions.map((rate) => (
            <button
              key={rate}
              onClick={() => onSetPlaybackRate(rate)}
              className={`pill-btn mini ${playbackRate === rate ? 'active' : ''}`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Metrónomo */}
        <button
          onClick={onToggleMetronome}
          className={`pill-btn mini ${metronomeActive ? 'active' : ''}`}
          title={metronomeActive ? 'Metrónomo Activo (M)' : 'Activar Metrónomo (M)'}
        >
          <Activity size={12} />
          <span>Metr</span>
        </button>

        {/* Bucle A-B */}
        <div className="header-loop-group">
          <button
            onClick={onSetLoopA}
            className={`pill-btn mini ${loopA !== null ? 'active' : ''}`}
            title="Punto A de repetición"
          >
            [A
          </button>
          <button
            onClick={onSetLoopB}
            className={`pill-btn mini ${loopB !== null ? 'active' : ''}`}
            title="Punto B de repetición"
          >
            B]
          </button>
          {(loopA !== null || loopB !== null) && (
            <button
              onClick={onClearLoop}
              className="pill-btn mini clear-btn"
              title="Borrar bucle A-B"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. SECCIÓN DERECHA: Selector de Vistas, Modo Atril y Acciones */}
      <div className="header-right-col">
        {/* Selector de Modo */}
        <div className="header-view-switcher">
          <button
            onClick={() => onSelectView('tablature')}
            className={`view-tab-btn ${activeView === 'tablature' ? 'active' : ''}`}
            title="Modo Tablatura Interactiva Songsterr"
          >
            <FileMusic size={13} />
            <span>Tablatura</span>
          </button>
          <button
            onClick={() => onSelectView('studio')}
            className={`view-tab-btn ${activeView === 'studio' ? 'active' : ''}`}
            title="Modo Consola de Mezcla Multi-Pista"
          >
            <LayoutDashboard size={13} />
            <span>Mixer</span>
          </button>
          <button
            onClick={() => onSelectView('split')}
            className={`view-tab-btn ${activeView === 'split' ? 'active' : ''}`}
            title="Vista Dividida"
          >
            <Columns size={13} />
            <span>Split</span>
          </button>
        </div>

        {/* Botón Modo Atril (Pantalla Completa) */}
        <button
          onClick={toggleFullscreen}
          className={`btn btn-icon btn-header-icon ${isFullscreen ? 'active-neon' : ''}`}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Modo Atril / Pantalla Completa'}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Botón Extraer YouTube o Subir Audio */}
        <button
          onClick={onOpenUpload}
          className="btn btn-primary btn-compact pulse-subtle"
          style={{ background: 'linear-gradient(135deg, #e50914 0%, #00e5ff 100%)', border: 'none' }}
          title="Pegar enlace de YouTube o subir archivo MP3"
        >
          <YoutubeIcon size={14} color="#fff" />
          <span>+ Cargar</span>
        </button>

        <button
          onClick={onLoadDemo}
          disabled={isLoadingDemo}
          className="btn btn-demo btn-compact"
          title="Probar pista de demostración precargada"
        >
          <Sparkles size={13} />
          <span>Demo</span>
        </button>

        <button
          onClick={onOpenLibrary}
          className="btn btn-secondary btn-compact"
          title="Mi Biblioteca de Canciones"
        >
          <Library size={13} color="var(--accent-cyan)" />
          {savedTracksCount > 0 && <span className="count-tag-mini">{savedTracksCount}</span>}
        </button>

        {/* Perfil Google & Configuración */}
        {user ? (
          <div className="user-profile-relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="user-avatar-btn"
              title={`Perfil: ${user.displayName || user.email}`}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="avatar-img" />
              ) : (
                <div className="avatar-fallback"><User size={13} /></div>
              )}
            </button>
            {showUserMenu && (
              <div className="user-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                <div className="dropdown-user-info">
                  <p className="user-name">{user.displayName || 'Usuario'}</p>
                  <p className="user-email">{user.email}</p>
                </div>
                <div className="dropdown-divider" />
                <button onClick={() => { setShowUserMenu(false); onOpenSettings(); }} className="dropdown-item">
                  <Settings size={14} />
                  <span>Configuración</span>
                </button>
                <button onClick={() => { setShowUserMenu(false); logout(); }} className="dropdown-item danger">
                  <LogOut size={14} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={handleGoogleLogin} disabled={isLoggingIn} className="btn btn-icon btn-header-icon" title="Iniciar sesión con Google">
            <LogIn size={14} color="var(--accent-cyan)" />
          </button>
        )}

        <button onClick={onOpenSettings} className="btn btn-icon btn-header-icon" title="Ajustes de Firebase y Servidor">
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
};

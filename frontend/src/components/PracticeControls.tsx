import React from 'react';
import { Play, Pause, Square, RotateCcw, Activity, Repeat, Gauge } from 'lucide-react';

interface PracticeControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  metronomeActive: boolean;
  loopA: number | null;
  loopB: number | null;
  onPlayPause: () => void;
  onStop: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onToggleMetronome: () => void;
  onSetLoopA: () => void;
  onSetLoopB: () => void;
  onClearLoop: () => void;
}

export const PracticeControls: React.FC<PracticeControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  metronomeActive,
  loopA,
  loopB,
  onPlayPause,
  onStop,
  onSetPlaybackRate,
  onToggleMetronome,
  onSetLoopA,
  onSetLoopB,
  onClearLoop,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5];

  return (
    <div className="glass-panel compact-transport-toolbar">
      {/* 1. Play / Pause & Time Counter */}
      <div className="transport-left-group">
        <button
          onClick={onPlayPause}
          className={`compact-play-btn ${isPlaying ? 'playing' : ''}`}
          title={isPlaying ? 'Pausa (Espacio)' : 'Reproducir (Espacio)'}
        >
          {isPlaying ? <Pause size={18} fill="#000" /> : <Play size={18} fill="#000" style={{ marginLeft: '2px' }} />}
        </button>

        <button
          onClick={onStop}
          className="btn btn-icon btn-transport-sub"
          title="Detener"
        >
          <Square size={13} />
        </button>

        <button
          onClick={onStop}
          className="btn btn-icon btn-transport-sub"
          title="Reiniciar al inicio"
        >
          <RotateCcw size={13} />
        </button>

        <div className="compact-time-counter">
          <span>{formatTime(currentTime)}</span>
          <span className="time-separator">/</span>
          <span className="duration-text">{formatTime(duration)}</span>
        </div>
      </div>

      {/* 2. Control de Velocidad (Time-Stretch) & Metrónomo */}
      <div className="transport-center-group">
        <div className="compact-speed-pill-wrap">
          <Gauge size={13} color="var(--text-muted)" />
          <div className="speed-pills">
            {speedOptions.map((rate) => (
              <button
                key={rate}
                onClick={() => onSetPlaybackRate(rate)}
                className={`speed-pill ${playbackRate === rate ? 'active' : ''}`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onToggleMetronome}
          className={`compact-metronome-btn ${metronomeActive ? 'active' : ''}`}
          title="Metrónomo sincronizado al Beat Grid (Tecla M)"
        >
          <Activity size={14} />
          <span>Metrónomo {metronomeActive ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* 3. Bucle A-B (Loop Region) */}
      <div className="transport-right-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Repeat size={14} color="var(--accent-purple)" />
          <span className="loop-label">LOOP:</span>
        </div>

        <button
          onClick={onSetLoopA}
          className={`loop-tag-btn ${loopA !== null ? 'active' : ''}`}
          title="Fijar punto de inicio de repetición (A)"
        >
          {loopA !== null ? `A: ${loopA.toFixed(1)}s` : '[ Fijar A ]'}
        </button>

        <button
          onClick={onSetLoopB}
          className={`loop-tag-btn ${loopB !== null ? 'active' : ''}`}
          title="Fijar punto final de repetición (B)"
        >
          {loopB !== null ? `B: ${loopB.toFixed(1)}s` : '[ Fijar B ]'}
        </button>

        {(loopA !== null || loopB !== null) && (
          <button
            onClick={onClearLoop}
            className="loop-clear-btn"
            title="Quitar bucle A-B"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

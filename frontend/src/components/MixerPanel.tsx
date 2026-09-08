import React, { useEffect, useState, useRef } from 'react';
import { MultiTrackEngine } from '../audio/MultiTrackEngine';
import { Drum, Mic, Guitar, Sliders, Volume2, Sparkles, Piano, BookmarkCheck } from 'lucide-react';
import type { UserPreferences } from '../firebase/firestore';

interface MixerPanelProps {
  engine: MultiTrackEngine | null;
  stems: Record<string, string>;
  isPlaying: boolean;
  onSaveMixPreferences?: (prefs: UserPreferences) => void;
  initialPreferences?: UserPreferences | null;
}

interface ChannelVisualState {
  volume: number;
  pan: number;
  isMuted: boolean;
  isSolo: boolean;
}

const STEM_CONFIGS: Record<string, { label: string; shortLabel: string; color: string; icon: React.ReactNode }> = {
  drums: { label: 'Batería', shortLabel: 'DRUM', color: 'var(--accent-amber)', icon: <Drum size={15} /> },
  bass: { label: 'Bajo', shortLabel: 'BASS', color: 'var(--accent-green)', icon: <Guitar size={15} /> },
  guitar: { label: 'Guitarra', shortLabel: 'GUIT', color: 'var(--accent-magenta)', icon: <Guitar size={15} /> },
  vocals: { label: 'Voz', shortLabel: 'VOZ', color: 'var(--accent-cyan)', icon: <Mic size={15} /> },
  piano: { label: 'Teclados', shortLabel: 'KEYS', color: 'var(--accent-purple)', icon: <Piano size={15} /> },
  other: { label: 'Otros / FX', shortLabel: 'FX', color: 'var(--accent-coral)', icon: <Sparkles size={15} /> },
};

export const MixerPanel: React.FC<MixerPanelProps> = ({
  engine,
  stems,
  isPlaying,
  onSaveMixPreferences,
  initialPreferences,
}) => {
  const stemKeys = Object.keys(stems);

  const [channelStates, setChannelStates] = useState<Record<string, ChannelVisualState>>(() => {
    const init: Record<string, ChannelVisualState> = {};
    Object.keys(stems).forEach((k) => {
      init[k] = {
        volume: initialPreferences?.channelVolumes?.[k] ?? 0.85,
        pan: initialPreferences?.channelPans?.[k] ?? 0.0,
        isMuted: false,
        isSolo: false,
      };
    });
    return init;
  });

  const [masterVolume, setMasterVolume] = useState(initialPreferences?.masterVolume ?? 0.9);
  const [vuLevels, setVuLevels] = useState<Record<string, number>>({});
  const [saveToast, setSaveToast] = useState(false);
  const animRef = useRef<number | null>(null);

  // Meter Animation Loop
  useEffect(() => {
    const updateVUs = () => {
      if (engine && isPlaying) {
        const levels: Record<string, number> = {};
        stemKeys.forEach((key) => {
          levels[key] = engine.getChannelLevel(key);
        });
        setVuLevels(levels);
      } else {
        setVuLevels({});
      }
      animRef.current = requestAnimationFrame(updateVUs);
    };

    animRef.current = requestAnimationFrame(updateVUs);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [engine, isPlaying, stemKeys]);

  const handleVolumeChange = (stemId: string, val: number) => {
    setChannelStates((prev) => ({
      ...prev,
      [stemId]: { ...prev[stemId], volume: val },
    }));
    engine?.setVolume(stemId, val);
  };

  const handlePanChange = (stemId: string, val: number) => {
    setChannelStates((prev) => ({
      ...prev,
      [stemId]: { ...prev[stemId], pan: val },
    }));
    engine?.setPan(stemId, val);
  };

  const handleToggleMute = (stemId: string) => {
    setChannelStates((prev) => {
      const nextMute = !prev[stemId]?.isMuted;
      return {
        ...prev,
        [stemId]: { ...prev[stemId], isMuted: nextMute },
      };
    });
    engine?.toggleMute(stemId);
  };

  const handleToggleSolo = (stemId: string) => {
    setChannelStates((prev) => {
      const nextSolo = !prev[stemId]?.isSolo;
      return {
        ...prev,
        [stemId]: { ...prev[stemId], isSolo: nextSolo },
      };
    });
    engine?.toggleSolo(stemId);
  };

  const handleMasterVolChange = (val: number) => {
    setMasterVolume(val);
    engine?.setMasterVolume(val);
  };

  const handleSaveMix = () => {
    if (!onSaveMixPreferences) return;
    const volumes: Record<string, number> = {};
    const pans: Record<string, number> = {};
    Object.entries(channelStates).forEach(([k, v]) => {
      volumes[k] = v.volume;
      pans[k] = v.pan;
    });

    onSaveMixPreferences({
      masterVolume,
      channelVolumes: volumes,
      channelPans: pans,
    });

    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  if (stemKeys.length === 0) {
    return (
      <div className="compact-mixer-sidebar empty-mixer">
        <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Sin pistas cargadas
        </div>
      </div>
    );
  }

  return (
    <div className="compact-mixer-sidebar">
      {/* Cabecera compacta con Master Volume */}
      <div className="mixer-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sliders size={14} color="var(--accent-cyan)" />
          <span className="mixer-title">MIXER ({stemKeys.length})</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div className="master-fader-wrap" title="Volumen General">
            <Volume2 size={13} color="var(--accent-cyan)" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => handleMasterVolChange(parseFloat(e.target.value))}
              className="master-slider"
            />
            <span className="master-pct">{Math.round(masterVolume * 100)}%</span>
          </div>

          {onSaveMixPreferences && (
            <button
              onClick={handleSaveMix}
              className={`btn-save-mix ${saveToast ? 'saved' : ''}`}
              title="Guardar balance de mezcla en mi perfil"
            >
              <BookmarkCheck size={13} />
              {saveToast ? '¡Guardado!' : 'Guardar'}
            </button>
          )}
        </div>
      </div>

      {/* Lista compacta de pistas de canal */}
      <div className="mixer-channel-list">
        {stemKeys.map((stemId) => {
          const cfg = STEM_CONFIGS[stemId] || {
            label: stemId.toUpperCase(),
            shortLabel: stemId.slice(0, 4).toUpperCase(),
            color: 'var(--accent-cyan)',
            icon: <Volume2 size={14} />,
          };
          const state = channelStates[stemId] || { volume: 0.85, pan: 0.0, isMuted: false, isSolo: false };
          const level = vuLevels[stemId] || 0;

          return (
            <div key={stemId} className={`compact-channel-row ${state.isMuted ? 'muted' : ''} ${state.isSolo ? 'solo' : ''}`}>
              {/* Badge Instrumento */}
              <div
                className="channel-badge"
                style={{
                  color: cfg.color,
                  background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`,
                  borderLeftColor: cfg.color,
                }}
                title={cfg.label}
              >
                {cfg.icon}
                <span className="badge-text">{cfg.shortLabel}</span>
              </div>

              {/* Botones Mute y Solo compactos */}
              <div className="channel-action-btns">
                <button
                  onClick={() => handleToggleMute(stemId)}
                  className={`mini-btn mute-btn ${state.isMuted ? 'active' : ''}`}
                  title={state.isMuted ? 'Desmutear' : 'Silenciar (Mute)'}
                >
                  M
                </button>
                <button
                  onClick={() => handleToggleSolo(stemId)}
                  className={`mini-btn solo-btn ${state.isSolo ? 'active' : ''}`}
                  title={state.isSolo ? 'Quitar Solo' : 'Escuchar solo este canal'}
                >
                  S
                </button>
              </div>

              {/* Fader Horizontal con VU Meter integrado */}
              <div className="fader-horizontal-wrap">
                <div className="fader-track-container">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={state.volume}
                    onChange={(e) => handleVolumeChange(stemId, parseFloat(e.target.value))}
                    className="horizontal-fader"
                    style={{
                      accentColor: cfg.color,
                    }}
                    title={`Volumen ${cfg.label}: ${Math.round(state.volume * 100)}%`}
                  />
                  {/* Micro VU bar integrado */}
                  <div className="mini-vu-track">
                    <div
                      className="mini-vu-fill"
                      style={{
                        width: `${Math.min(100, Math.round(level * 100))}%`,
                        background: cfg.color,
                      }}
                    />
                  </div>
                </div>
                <span className="vol-val-text">{Math.round(state.volume * 100)}%</span>
              </div>

              {/* Paneo compacto */}
              <div className="compact-pan-wrap" title={`Paneo: ${state.pan.toFixed(2)}`}>
                <span className="pan-tag">
                  {state.pan < -0.05 ? `L${Math.round(Math.abs(state.pan) * 100)}` : state.pan > 0.05 ? `R${Math.round(state.pan * 100)}` : 'C'}
                </span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={state.pan}
                  onChange={(e) => handlePanChange(stemId, parseFloat(e.target.value))}
                  className="mini-pan-slider"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

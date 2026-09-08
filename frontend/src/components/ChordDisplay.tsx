import React from 'react';
import type { ChordSegment } from '../audio/types';
import { Activity, KeyRound } from 'lucide-react';

interface ChordDisplayProps {
  title: string;
  keyName: string;
  bpm: number;
  timeSignature: string;
  chords: ChordSegment[];
  currentTime: number;
}

// Diagramas de acordes básicos para visualización rápida de digitación de guitarra
const GUITAR_CHORD_SHAPES: Record<string, string> = {
  'Am': 'X-0-2-2-1-0',
  'A':  'X-0-2-2-2-0',
  'C':  'X-3-2-0-1-0',
  'G':  '3-2-0-0-0-3',
  'D':  'X-X-0-2-3-2',
  'Dm': 'X-X-0-2-3-1',
  'E':  '0-2-2-1-0-0',
  'Em': '0-2-2-0-0-0',
  'F':  '1-3-3-2-1-1',
  'B':  'X-2-4-4-4-2',
  'Bm': 'X-2-4-4-3-2',
};

export const ChordDisplay: React.FC<ChordDisplayProps> = ({
  title,
  keyName,
  bpm,
  timeSignature,
  chords,
  currentTime,
}) => {
  // Encontrar acorde activo
  const activeChordSegment = chords.find(
    (c) => currentTime >= c.start && currentTime < c.end
  );
  const currentChord = activeChordSegment?.chord || (chords[0]?.chord ?? '--');
  const fingering = GUITAR_CHORD_SHAPES[currentChord] || 'Posición abierta';

  return (
    <div className="glass-panel hud-banner">
      {/* Título de la pista y metadatos */}
      <div>
        <h2 className="track-info-title">{title || 'Sesión de Estudio'}</h2>
        <div className="track-info-meta">
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <KeyRound size={14} color="var(--accent-cyan)" />
            Tonalidad: <strong style={{ color: '#fff' }}>{keyName || 'Desconocida'}</strong>
          </span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={14} color="var(--accent-amber)" />
            Compás: <strong style={{ color: '#fff' }}>{timeSignature || '4/4'}</strong>
          </span>
        </div>
      </div>

      {/* BPM Counter */}
      <div className="hud-stat-box">
        <span className="hud-stat-label">TEMPO DETECTADO</span>
        <span className="hud-stat-val" style={{ color: 'var(--accent-amber)' }}>
          {bpm ? bpm.toFixed(1) : '--'} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>BPM</span>
        </span>
      </div>

      {/* Key Display */}
      <div className="hud-stat-box">
        <span className="hud-stat-label">TONALIDAD (KEY)</span>
        <span className="hud-stat-val" style={{ color: 'var(--accent-cyan)' }}>
          {keyName || '--'}
        </span>
      </div>

      {/* Acorde Actual y Digitación */}
      <div className="chord-hud-card">
        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-magenta)', letterSpacing: '0.08em' }}>
            ACORDE EN TIEMPO REAL
          </span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            Digitación: <strong style={{ color: '#fff' }}>{fingering}</strong>
          </div>
        </div>
        <div className="chord-hud-name">
          {currentChord}
        </div>
      </div>
    </div>
  );
};

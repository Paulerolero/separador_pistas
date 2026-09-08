import React, { useRef, useEffect } from 'react';
import type { ChordSegment } from '../audio/types';

interface TimelineWaveformProps {
  duration: number;
  currentTime: number;
  beatGrid: number[];
  chords: ChordSegment[];
  loopA: number | null;
  loopB: number | null;
  onSeek: (seconds: number) => void;
}

export const TimelineWaveform: React.FC<TimelineWaveformProps> = ({
  duration,
  currentTime,
  beatGrid,
  chords,
  loopA,
  loopB,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Render Waveform Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Fondo oscuro con sutil degradado
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Dibujar marcas de compás y beats
    if (duration > 0 && beatGrid.length > 0) {
      ctx.lineWidth = 1;
      beatGrid.forEach((beatTime, idx) => {
        const x = (beatTime / duration) * width;
        const isDownbeat = idx % 4 === 0;

        ctx.strokeStyle = isDownbeat ? 'rgba(0, 229, 255, 0.4)' : 'rgba(255, 255, 255, 0.07)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        if (isDownbeat) {
          ctx.fillStyle = 'rgba(0, 229, 255, 0.65)';
          ctx.font = '9px monospace';
          ctx.fillText(`${(idx / 4) + 1}`, x + 3, 10);
        }
      });
    }

    // Dibujar Forma de Onda Estilizada (Multi-band representation)
    const barWidth = 2.5;
    const barGap = 1.5;
    const totalStep = barWidth + barGap;
    const bars = Math.floor(width / totalStep);
    const midY = height / 2;

    for (let i = 0; i < bars; i++) {
      const x = i * totalStep;
      const progress = i / bars;
      const t = progress * duration;

      // Pseudo-onda reactiva armónica
      const waveVal = Math.sin(progress * 48) * 0.3 +
                      Math.sin(progress * 130) * 0.2 +
                      Math.cos(progress * 18) * 0.4 +
                      0.35;

      const barHeight = Math.max(4, Math.min(height * 0.88, waveVal * (height * 0.82)));
      const isPlayed = t <= currentTime;

      // Color según reproducción
      if (isPlayed) {
        ctx.fillStyle = '#00e5ff';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      }

      ctx.fillRect(x, midY - barHeight / 2, barWidth, barHeight);
    }
  }, [duration, currentTime, beatGrid]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    onSeek(ratio * duration);
  };

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const loopAPercent = loopA !== null && duration > 0 ? (loopA / duration) * 100 : null;
  const loopBPercent = loopB !== null && duration > 0 ? (loopB / duration) * 100 : null;

  return (
    <div className="compact-timeline-container">
      {/* Barra superior de información rápida */}
      <div className="timeline-header-bar">
        <span className="timeline-title">LÍNEA DE TIEMPO MULTI-PISTA</span>
        <span className="timeline-hint">Haz clic o arrastra para navegar</span>
      </div>

      {/* Contenedor interactivo de canvas */}
      <div
        ref={containerRef}
        className="timeline-canvas-container"
        onPointerDown={handlePointerDown}
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={95}
          className="timeline-canvas"
        />

        {/* Región Loop A-B */}
        {loopAPercent !== null && loopBPercent !== null && (
          <div
            className="loop-region-overlay"
            style={{
              left: `${loopAPercent}%`,
              width: `${Math.max(0, loopBPercent - loopAPercent)}%`,
            }}
          />
        )}

        {/* Cabezal de Reproducción */}
        <div
          className="playhead-marker"
          style={{ left: `${Math.min(100, Math.max(0, playheadPercent))}%` }}
        />
      </div>

      {/* Progresión de Acordes Horizontal Alineada */}
      {chords.length > 0 && duration > 0 ? (
        <div className="chords-timeline-bar">
          {chords.map((chord, idx) => {
            const leftPct = (chord.start / duration) * 100;
            const widthPct = Math.max(1, ((chord.end - chord.start) / duration) * 100);
            const isActive = currentTime >= chord.start && currentTime < chord.end;

            return (
              <div
                key={idx}
                className={`chord-timeline-segment ${isActive ? 'active' : ''}`}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: '100%',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(chord.start);
                }}
                title={`${chord.chord} (${chord.start.toFixed(1)}s - ${chord.end.toFixed(1)}s)`}
              >
                {chord.chord}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="chords-timeline-bar-empty">
          <span>Progresión armónica sincronizada</span>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import type { NoteEvent } from '../audio/types';
import { Guitar, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

interface FretboardViewProps {
  currentTime: number;
  notes: NoteEvent[];
  initialInstrument?: 'guitar' | 'bass';
  keyRootNote?: string;
  onInstrumentChange?: (inst: 'guitar' | 'bass') => void;
}

export const FretboardView: React.FC<FretboardViewProps> = ({
  currentTime,
  notes,
  initialInstrument = 'guitar',
  keyRootNote,
  onInstrumentChange,
}) => {
  const [instrumentOverride, setInstrumentOverride] = useState<'guitar' | 'bass' | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const instrument = instrumentOverride ?? initialInstrument;

  const handleSelectInstrument = (inst: 'guitar' | 'bass') => {
    setInstrumentOverride(inst);
    onInstrumentChange?.(inst);
  };

  const activeNotes = notes.filter(
    (n) => currentTime >= n.start && currentTime <= n.end
  );

  const numFrets = 22;
  const singleDotFrets = [3, 5, 7, 9, 15, 17, 19, 21];
  const doubleDotFrets = [12];

  const guitarStrings = [
    { num: 1, name: 'E4', gauge: 1.2 },
    { num: 2, name: 'B3', gauge: 1.6 },
    { num: 3, name: 'G3', gauge: 2.0 },
    { num: 4, name: 'D3', gauge: 2.6 },
    { num: 5, name: 'A2', gauge: 3.2 },
    { num: 6, name: 'E2', gauge: 4.0 },
  ];

  const bassStrings = [
    { num: 1, name: 'G2', gauge: 2.4 },
    { num: 2, name: 'D2', gauge: 3.2 },
    { num: 3, name: 'A1', gauge: 4.2 },
    { num: 4, name: 'E1', gauge: 5.2 },
  ];

  const currentStrings = instrument === 'guitar' ? guitarStrings : bassStrings;
  const totalStrings = currentStrings.length;

  return (
    <div className={`glass-panel compact-fretboard-section ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      {/* Barra de cabecera con toggle para colapsar y expandir */}
      <div className="compact-fretboard-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <Guitar size={15} color="var(--accent-magenta)" />
          <span className="fretboard-title">MÁSTIL INTERACTIVO</span>
          <span className="fretboard-note-counter">
            {activeNotes.length > 0 ? `${activeNotes.length} nota(s) sonando` : 'En espera'}
          </span>
          {keyRootNote && (
            <span className="root-key-badge" title="Tonalidad detectada">
              <Sparkles size={11} color="var(--accent-amber)" />
              <span>Key: {keyRootNote}</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }} onClick={(e) => e.stopPropagation()}>
          <div className="tool-pill-group mini-pill-group">
            <button
              onClick={() => handleSelectInstrument('guitar')}
              className={`pill-btn mini ${instrument === 'guitar' ? 'active' : ''}`}
            >
              Guitarra (6C)
            </button>
            <button
              onClick={() => handleSelectInstrument('bass')}
              className={`pill-btn mini ${instrument === 'bass' ? 'active' : ''}`}
            >
              Bajo (4C)
            </button>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="drawer-toggle-btn"
            title={isCollapsed ? 'Expandir mástil completo' : 'Plegar mástil para ganar espacio'}
          >
            {isCollapsed ? (
              <>
                <ChevronUp size={14} />
                <span>Mostrar Mástil</span>
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                <span>Ocultar Mástil</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Cuerpo del mástil (solo visible cuando está expandido) */}
      {!isCollapsed && (
        <div className="fretboard-wrap compact-fretboard-wrap">
          <div className="fretboard-board compact-fretboard-board">
            {Array.from({ length: numFrets + 1 }).map((_, fretIdx) => {
              const leftPct = (fretIdx / numFrets) * 98 + 1;
              return (
                <div
                  key={fretIdx}
                  className="fret-wire"
                  style={{ left: `${leftPct}%` }}
                >
                  {fretIdx > 0 && <span className="fret-number">{fretIdx}</span>}
                </div>
              );
            })}

            {singleDotFrets.map((fret) => {
              const fretLeft = ((fret - 0.5) / numFrets) * 98 + 1;
              return (
                <div
                  key={fret}
                  className="fret-inlay-dot"
                  style={{ left: `${fretLeft}%`, top: '50%' }}
                />
              );
            })}

            {doubleDotFrets.map((fret) => {
              const fretLeft = ((fret - 0.5) / numFrets) * 98 + 1;
              return (
                <React.Fragment key={fret}>
                  <div
                    className="fret-inlay-dot"
                    style={{ left: `${fretLeft}%`, top: '30%' }}
                  />
                  <div
                    className="fret-inlay-dot"
                    style={{ left: `${fretLeft}%`, top: '70%' }}
                  />
                </React.Fragment>
              );
            })}

            {currentStrings.map((str, idx) => {
              const topPct = ((idx + 0.5) / totalStrings) * 100;
              return (
                <div
                  key={str.num}
                  className="string-wire"
                  style={{
                    top: `${topPct}%`,
                    height: `${str.gauge}px`,
                  }}
                >
                  <span className="string-label-text">
                    {str.name}
                  </span>
                </div>
              );
            })}

            {activeNotes.map((note, idx) => {
              const stringIdx = Math.max(1, Math.min(note.string, totalStrings)) - 1;
              const topPct = ((stringIdx + 0.5) / totalStrings) * 100;
              const fretPos = note.fret === 0 ? 0.3 : note.fret - 0.5;
              const leftPct = (fretPos / numFrets) * 98 + 1;

              return (
                <div
                  key={`${note.start}-${note.string}-${idx}`}
                  className="note-dot-active compact-note-dot"
                  style={{
                    top: `${topPct}%`,
                    left: `${leftPct}%`,
                  }}
                  title={`${note.note_name} | Cuerda ${note.string}, Traste ${note.fret}`}
                >
                  {note.note_name}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

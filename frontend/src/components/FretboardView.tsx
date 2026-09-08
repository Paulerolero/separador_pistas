import React, { useState } from 'react';
import type { NoteEvent } from '../audio/types';
import { Guitar } from 'lucide-react';

interface FretboardViewProps {
  currentTime: number;
  notes: NoteEvent[];
  initialInstrument?: 'guitar' | 'bass';
  onInstrumentChange?: (inst: 'guitar' | 'bass') => void;
}

export const FretboardView: React.FC<FretboardViewProps> = ({
  currentTime,
  notes,
  initialInstrument = 'guitar',
  onInstrumentChange,
}) => {
  const [instrumentOverride, setInstrumentOverride] = useState<'guitar' | 'bass' | null>(null);
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
    <div className="glass-panel compact-fretboard-section">
      <div className="compact-fretboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Guitar size={15} color="var(--accent-magenta)" />
          <span className="fretboard-title">MÁSTIL INTERACTIVO & TABLATURA</span>
          <span className="fretboard-note-counter">
            {activeNotes.length > 0 ? `${activeNotes.length} nota(s)` : 'Esperando digitación'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>INSTRUMENTO:</span>
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
        </div>
      </div>

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
    </div>
  );
};

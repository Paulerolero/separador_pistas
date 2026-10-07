import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  VolumeX,
  Volume2,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Repeat,
  Compass,
  Headphones,
  Play,
  Pause,
  ChevronDown,
  Gauge,
} from 'lucide-react';
import type { SessionData, NoteEvent } from '../audio/types';
import type { MultiTrackEngine } from '../audio/MultiTrackEngine';

interface SongsterrTabPlayerProps {
  session: SessionData | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  loopA: number | null;
  loopB: number | null;
  engine: MultiTrackEngine | null;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetLoopA: () => void;
  onSetLoopB: () => void;
  onClearLoop: () => void;
}

// Mapeo de acordes a digitaciones estándar en Guitarra (cuerdas 6 a 1: E A D G B e)
const CHORD_FINGERINGS: Record<string, { string: number; fret: number }[]> = {
  C: [{ string: 5, fret: 3 }, { string: 4, fret: 2 }, { string: 3, fret: 0 }, { string: 2, fret: 1 }, { string: 1, fret: 0 }],
  D: [{ string: 4, fret: 0 }, { string: 3, fret: 2 }, { string: 2, fret: 3 }, { string: 1, fret: 2 }],
  E: [{ string: 6, fret: 0 }, { string: 5, fret: 2 }, { string: 4, fret: 2 }, { string: 3, fret: 1 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
  F: [{ string: 6, fret: 1 }, { string: 5, fret: 3 }, { string: 4, fret: 3 }, { string: 3, fret: 2 }, { string: 2, fret: 1 }, { string: 1, fret: 1 }],
  G: [{ string: 6, fret: 3 }, { string: 5, fret: 2 }, { string: 4, fret: 0 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 3 }],
  A: [{ string: 5, fret: 0 }, { string: 4, fret: 2 }, { string: 3, fret: 2 }, { string: 2, fret: 2 }, { string: 1, fret: 0 }],
  B: [{ string: 5, fret: 2 }, { string: 4, fret: 4 }, { string: 3, fret: 4 }, { string: 2, fret: 4 }, { string: 1, fret: 2 }],
  Am: [{ string: 5, fret: 0 }, { string: 4, fret: 2 }, { string: 3, fret: 2 }, { string: 2, fret: 1 }, { string: 1, fret: 0 }],
  Em: [{ string: 6, fret: 0 }, { string: 5, fret: 2 }, { string: 4, fret: 2 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
  Dm: [{ string: 4, fret: 0 }, { string: 3, fret: 2 }, { string: 2, fret: 3 }, { string: 1, fret: 1 }],
  Bm: [{ string: 5, fret: 2 }, { string: 4, fret: 4 }, { string: 3, fret: 4 }, { string: 2, fret: 3 }, { string: 1, fret: 2 }],
  Fm: [{ string: 6, fret: 1 }, { string: 5, fret: 3 }, { string: 4, fret: 3 }, { string: 3, fret: 1 }, { string: 2, fret: 1 }, { string: 1, fret: 1 }],
  Gm: [{ string: 6, fret: 3 }, { string: 5, fret: 5 }, { string: 4, fret: 5 }, { string: 3, fret: 3 }, { string: 2, fret: 3 }, { string: 1, fret: 3 }],
  Cm: [{ string: 5, fret: 3 }, { string: 4, fret: 5 }, { string: 3, fret: 5 }, { string: 2, fret: 4 }, { string: 1, fret: 3 }],
};

const CHORD_DIAGRAM_TEXT: Record<string, string> = {
  C: 'x32010',
  D: 'xx0232',
  E: '022100',
  F: '133211',
  G: '320003',
  A: 'x02220',
  B: 'x24442',
  Am: 'x02210',
  Em: '022000',
  Dm: 'xx0231',
  Bm: 'x24432',
  Fm: '133111',
  Gm: '355333',
  Cm: 'x35543',
};

// Rejilla rítmica: 16 semicorcheas por compás de 4/4
const STEPS = 16;
const LINE_GAP = 12; // px entre cuerdas (estilo Songsterr)
const FIRST_MEASURE_PREFIX = 46; // espacio para afinación + 4/4 en el compás 1
const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25];

// Posición horizontal (%) dentro del área de notas para una posición relativa 0..1
const xPct = (pos: number) => 5 + pos * 90;

interface NoteGroup {
  step: number;
  dur: number; // en semicorcheas
  notes: NoteEvent[];
}

interface Beam {
  fromStep: number;
  toStep: number;
  double: boolean;
}

type TabTrack = 'guitar_lead' | 'guitar_chords' | 'bass';

const TRACK_LABELS: Record<TabTrack, string> = {
  guitar_lead: 'Guitarra Lead',
  guitar_chords: 'Guitarra Rítmica (Acordes)',
  bass: 'Bajo',
};

export const SongsterrTabPlayer: React.FC<SongsterrTabPlayerProps> = ({
  session,
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  loopA,
  loopB,
  engine,
  onPlayPause,
  onSeek,
  onSetPlaybackRate,
  onClearLoop,
}) => {
  const [tabTrack, setTabTrack] = useState<TabTrack>('guitar_lead');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedAscii, setCopiedAscii] = useState<boolean>(false);
  const [isGuitarMuted, setIsGuitarMuted] = useState<boolean>(false);
  const [isGuitarSolo, setIsGuitarSolo] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastRowTopRef = useRef<number>(-1);

  // Cuerdas según instrumento (de aguda a grave, de arriba hacia abajo)
  const guitarStrings = ['E', 'B', 'G', 'D', 'A', 'E'];
  const bassStrings = ['G', 'D', 'A', 'E'];
  const currentStrings = tabTrack === 'bass' ? bassStrings : guitarStrings;
  const numStrings = currentStrings.length;
  const staffHeight = (numStrings - 1) * LINE_GAP;

  const bpm = session?.metadata.bpm || 120;
  const beatsPerMeasure = 4;
  const secondsPerBeat = 60 / bpm;
  const measureDuration = secondsPerBeat * beatsPerMeasure;

  // Notas de la pista activa
  const activeNotesList = useMemo(() => {
    if (!session) return [];

    if (tabTrack === 'guitar_lead') {
      return session.guitar_transcription || [];
    }

    if (tabTrack === 'bass') {
      return session.bass_transcription || [];
    }

    if (tabTrack === 'guitar_chords') {
      const generated: NoteEvent[] = [];
      const chords = session.chords || [];
      chords.forEach((c) => {
        const cleanName = c.chord.replace(/:.*/, '');
        const fingering = CHORD_FINGERINGS[cleanName] || CHORD_FINGERINGS[c.chord] || [];
        fingering.forEach((f) => {
          generated.push({
            start: c.start,
            end: c.end,
            pitch_midi: 60,
            note_name: c.chord,
            string: f.string,
            fret: f.fret,
          });
        });
      });
      return generated;
    }

    return [];
  }, [session, tabTrack]);

  // Lista de compases (Measures) con notas cuantizadas en grupos rítmicos
  const totalMeasuresCount = useMemo(() => {
    const totalTime = duration || session?.metadata.duration_seconds || 30;
    return Math.max(1, Math.ceil(totalTime / measureDuration));
  }, [duration, session, measureDuration]);

  const measures = useMemo(() => {
    const result = [];
    const chordsList = session?.chords || [];
    const stepDur = measureDuration / STEPS;
    let lastChordName = '';

    for (let m = 0; m < totalMeasuresCount; m++) {
      const mStart = m * measureDuration;
      const mEnd = (m + 1) * measureDuration;

      // 1. Agrupar notas por posición rítmica cuantizada
      const groupMap = new Map<number, NoteGroup>();
      activeNotesList
        .filter((n) => n.start >= mStart && n.start < mEnd)
        .forEach((n) => {
          const step = Math.max(0, Math.min(STEPS - 1, Math.round((n.start - mStart) / stepDur)));
          const dur = Math.max(1, Math.round((n.end - n.start) / stepDur));
          let g = groupMap.get(step);
          if (!g) {
            g = { step, dur, notes: [] };
            groupMap.set(step, g);
          }
          // Una sola nota por cuerda en cada posición
          if (!g.notes.some((existing) => existing.string === n.string)) {
            g.notes.push(n);
          }
          g.dur = Math.max(g.dur, dur);
        });

      const groups = Array.from(groupMap.values()).sort((a, b) => a.step - b.step);
      groups.forEach((g, i) => {
        const nextStep = i < groups.length - 1 ? groups[i + 1].step : STEPS;
        g.dur = Math.max(1, Math.min(g.dur, nextStep - g.step));
      });

      // 2. Calcular barras de unión (beams) por tiempo (negra)
      const beams: Beam[] = [];
      const flags: number[] = [];
      for (let beat = 0; beat < 4; beat++) {
        const inBeat = groups.filter((g) => g.step >= beat * 4 && g.step < beat * 4 + 4 && g.dur < 4);
        if (inBeat.length >= 2) {
          beams.push({
            fromStep: inBeat[0].step,
            toStep: inBeat[inBeat.length - 1].step,
            double: inBeat.every((g) => g.dur <= 1),
          });
        } else if (inBeat.length === 1) {
          flags.push(inBeat[0].step);
        }
      }

      // 3. Acordes que comienzan dentro del compás (solo cuando cambian)
      const mChords = chordsList
        .filter((c) => c.start < mEnd && c.end > mStart)
        .filter((c) => {
          const name = c.chord;
          if (name === lastChordName || name === 'N') return false;
          lastChordName = name;
          return true;
        })
        .map((c) => ({
          chord: c.chord,
          pos: Math.max(0, (c.start - mStart) / measureDuration),
        }));

      result.push({
        measureNumber: m + 1,
        start: mStart,
        end: mEnd,
        groups,
        beams,
        flags,
        chords: mChords,
      });
    }
    return result;
  }, [totalMeasuresCount, measureDuration, activeNotesList, session]);

  // Compás activo
  const activeMeasureIndex = Math.min(
    totalMeasuresCount - 1,
    Math.max(0, Math.floor(currentTime / measureDuration))
  );

  // Auto-scroll vertical: mantiene visible la fila (sistema) que suena
  useEffect(() => {
    if (!autoScroll || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const measureEl = container.querySelector<HTMLDivElement>(`[data-measure="${activeMeasureIndex + 1}"]`);
    if (!measureEl) return;
    const rowTop = measureEl.offsetTop;
    if (rowTop === lastRowTopRef.current) return;
    lastRowTopRef.current = rowTop;
    container.scrollTo({
      top: Math.max(0, rowTop - container.clientHeight * 0.22),
      behavior: 'smooth',
    });
  }, [activeMeasureIndex, autoScroll]);

  // 1-Click Presets para Músicos
  const toggleMuteGuitar = () => {
    if (!engine) return;
    const newState = !isGuitarMuted;
    setIsGuitarMuted(newState);
    engine.setMute('guitar', newState);
  };

  const toggleSoloGuitar = () => {
    if (!engine) return;
    const newState = !isGuitarSolo;
    setIsGuitarSolo(newState);
    engine.setSolo('guitar', newState);
  };

  const handleLoopMeasure = (mStart: number, mEnd: number) => {
    if (!engine) return;
    engine.setLoopA(mStart);
    engine.setLoopB(mEnd);
    engine.seek(mStart);
    onSeek(mStart);
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.findIndex((s) => Math.abs(s - playbackRate) < 0.01);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    onSetPlaybackRate(next);
  };

  const copyAsciiTab = () => {
    if (!session) return;
    let ascii = `=== TABLATURA: ${session.metadata.title} ===\n`;
    ascii += `Tempo: ${bpm} BPM | Tonalidad: ${session.metadata.key} | Compás: 4/4\n\n`;

    const stringLabels = tabTrack === 'bass' ? ['G', 'D', 'A', 'E'] : ['e', 'B', 'G', 'D', 'A', 'E'];

    measures.slice(0, 16).forEach((m) => {
      ascii += `[Compás ${m.measureNumber}] ${m.chords.map((c) => c.chord).join(' - ')}\n`;
      stringLabels.forEach((label, sIdx) => {
        const strNum = sIdx + 1;
        let line = `${label}|`;
        for (let step = 0; step < STEPS; step += 2) {
          const g = m.groups.find((gr) => gr.step === step || gr.step === step + 1);
          const n = g?.notes.find((note) => note.string === strNum);
          line += n ? `-${n.fret}-`.padEnd(3, '-') : '---';
        }
        line += '|\n';
        ascii += line;
      });
      ascii += '\n';
    });

    navigator.clipboard.writeText(ascii);
    setCopiedAscii(true);
    setTimeout(() => setCopiedAscii(false), 2500);
  };

  // Título estilo Songsterr: "Canción  Artista  tab"
  const rawTitle = session?.metadata.title || 'Sesión de Estudio';
  const [artistName, songName] = rawTitle.includes(' - ')
    ? [rawTitle.split(' - ')[0], rawTitle.split(' - ').slice(1).join(' - ')]
    : ['', rawTitle];

  const hasLoop = loopA !== null && loopB !== null;
  const rhythmTop = staffHeight + 6;

  return (
    <div className="sg-sheet">
      <div className="sg-scroll" ref={scrollContainerRef}>
        {/* Cabecera centrada */}
        <header className="sg-title-block">
          <h2 className="sg-title">
            <span className="sg-title-song">{songName}</span>
            {artistName && <span className="sg-title-artist">{artistName}</span>}
            <span className="sg-title-tab">tab</span>
          </h2>
          <p className="sg-subtitle">
            {TRACK_LABELS[tabTrack]}
            <span className="sg-sep">|</span>
            Afinación estándar ({tabTrack === 'bass' ? 'E A D G' : 'E A D G B E'})
            <span className="sg-sep">|</span>
            Tonalidad: {session?.metadata.key || '--'}
            <span className="sg-sep">|</span>
            {Math.round(bpm)} BPM
          </p>
        </header>

        {!session ? (
          <div className="sg-empty">Carga una canción o la demo para ver la tablatura.</div>
        ) : (
          <div className="sg-system">
            {measures.map((measure, mIdx) => {
              const isCurrent = mIdx === activeMeasureIndex;
              const isFirst = mIdx === 0;
              const inLoop = hasLoop && measure.start >= loopA! - 0.01 && measure.end <= loopB! + 0.01;
              const basis = Math.max(150, measure.groups.length * 30 + 60) * zoomLevel + (isFirst ? FIRST_MEASURE_PREFIX : 0);
              const cursorPos = Math.max(0, Math.min(1, (currentTime - measure.start) / measureDuration));

              return (
                <div
                  key={measure.measureNumber}
                  data-measure={measure.measureNumber}
                  className={`sg-measure ${inLoop ? 'sg-in-loop' : ''}`}
                  style={{ flex: `${basis} 1 ${basis}px` }}
                  onClick={() => onSeek(measure.start)}
                >
                  {/* Número de compás + botón de bucle */}
                  <div className="sg-measure-number">
                    <span>{measure.measureNumber}</span>
                    <button
                      className="sg-loop-btn"
                      title="Repetir este compás en bucle"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoopMeasure(measure.start, measure.end);
                      }}
                    >
                      <Repeat size={10} />
                    </button>
                  </div>

                  {isFirst && (
                    <div className="sg-tempo-mark" style={{ left: FIRST_MEASURE_PREFIX }}>
                      <span className="sg-tempo-note">♩</span> = {Math.round(bpm)}
                    </div>
                  )}

                  {/* Pentagrama de tablatura */}
                  <div className="sg-staff" style={{ height: staffHeight }}>
                    {currentStrings.map((_, sIdx) => (
                      <div key={sIdx} className="sg-line" style={{ top: sIdx * LINE_GAP }} />
                    ))}

                    {isFirst && (
                      <div className="sg-clef" style={{ width: FIRST_MEASURE_PREFIX }}>
                        <div className="sg-tuning">
                          {currentStrings.map((label, sIdx) => (
                            <span key={sIdx} style={{ top: sIdx * LINE_GAP }}>{label}</span>
                          ))}
                        </div>
                        <div className="sg-timesig" style={{ fontSize: staffHeight * 0.55, lineHeight: `${staffHeight / 2}px` }}>
                          <span>4</span>
                          <span>4</span>
                        </div>
                      </div>
                    )}

                    <div className="sg-note-area" style={{ left: isFirst ? FIRST_MEASURE_PREFIX : 0 }}>
                      {/* Acordes */}
                      {measure.chords.map((c, cIdx) => {
                        const cleanC = c.chord.replace(/:.*/, '');
                        const diagram = CHORD_DIAGRAM_TEXT[cleanC] || CHORD_DIAGRAM_TEXT[c.chord];
                        return (
                          <span
                            key={cIdx}
                            className="sg-chord-label"
                            style={{ left: `${xPct(c.pos)}%` }}
                            title={diagram ? `Posición: ${diagram}` : c.chord}
                          >
                            {c.chord}
                          </span>
                        );
                      })}

                      {/* Cursor verde estilo Songsterr */}
                      {isCurrent && (
                        <div
                          className="sg-cursor"
                          style={{ left: `${xPct(cursorPos)}%`, top: -9, height: staffHeight + 18 }}
                        />
                      )}

                      {/* Números de traste */}
                      {measure.groups.map((g) =>
                        g.notes.map((note, nIdx) => {
                          const strIndex = Math.max(1, Math.min(note.string, numStrings)) - 1;
                          const isNoteActive = currentTime >= note.start && currentTime <= note.end;
                          return (
                            <span
                              key={`${g.step}-${note.string}-${nIdx}`}
                              className={`sg-fret ${isNoteActive ? 'sg-fret-active' : ''}`}
                              style={{ left: `${xPct(g.step / STEPS)}%`, top: strIndex * LINE_GAP }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSeek(note.start);
                              }}
                              title={`Cuerda ${note.string} · Traste ${note.fret} (${note.note_name})`}
                            >
                              {note.fret}
                            </span>
                          );
                        })
                      )}

                      {/* Plicas rítmicas */}
                      {measure.groups.map((g) =>
                        g.dur < STEPS ? (
                          <div
                            key={`stem-${g.step}`}
                            className={`sg-stem ${g.dur >= 8 ? 'sg-stem-half' : ''}`}
                            style={{ left: `${xPct(g.step / STEPS)}%`, top: rhythmTop }}
                          />
                        ) : null
                      )}

                      {/* Barras de unión (corcheas / semicorcheas) */}
                      {measure.beams.map((b, bIdx) => (
                        <React.Fragment key={`beam-${bIdx}`}>
                          <div
                            className="sg-beam"
                            style={{
                              left: `${xPct(b.fromStep / STEPS)}%`,
                              width: `${xPct(b.toStep / STEPS) - xPct(b.fromStep / STEPS)}%`,
                              top: rhythmTop + 14,
                            }}
                          />
                          {b.double && (
                            <div
                              className="sg-beam"
                              style={{
                                left: `${xPct(b.fromStep / STEPS)}%`,
                                width: `${xPct(b.toStep / STEPS) - xPct(b.fromStep / STEPS)}%`,
                                top: rhythmTop + 9,
                              }}
                            />
                          )}
                        </React.Fragment>
                      ))}

                      {/* Corchetes de corchea aislada */}
                      {measure.flags.map((step) => (
                        <div
                          key={`flag-${step}`}
                          className="sg-flag"
                          style={{ left: `${xPct(step / STEPS)}%`, top: rhythmTop + 9 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Panel flotante de control (estilo dock de Songsterr) */}
      <div className="sg-dock" onClick={(e) => e.stopPropagation()}>
        <div className="sg-dock-top">
          <div className="sg-select-wrap">
            <select
              value={tabTrack}
              onChange={(e) => setTabTrack(e.target.value as TabTrack)}
              className="sg-select"
            >
              <option value="guitar_lead">{TRACK_LABELS.guitar_lead}</option>
              <option value="guitar_chords">{TRACK_LABELS.guitar_chords}</option>
              <option value="bass">{TRACK_LABELS.bass}</option>
            </select>
            <ChevronDown size={14} className="sg-select-chevron" />
          </div>
        </div>

        <div className="sg-dock-grid">
          <button
            className={`sg-dock-btn ${isGuitarMuted ? 'on' : ''}`}
            onClick={toggleMuteGuitar}
            title="Silenciar guitarra (backing track)"
          >
            {isGuitarMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <small>Mute</small>
          </button>
          <button
            className={`sg-dock-btn ${isGuitarSolo ? 'on' : ''}`}
            onClick={toggleSoloGuitar}
            title="Escuchar solo la guitarra"
          >
            <Headphones size={16} />
            <small>Solo</small>
          </button>
          <button className="sg-dock-btn" onClick={cycleSpeed} title="Velocidad de reproducción">
            <Gauge size={16} />
            <small>{Math.round(playbackRate * 100)}%</small>
          </button>
          <button
            className={`sg-dock-btn ${hasLoop ? 'on' : ''}`}
            onClick={() => {
              if (hasLoop) {
                onClearLoop();
              } else {
                const m = measures[activeMeasureIndex];
                if (m) handleLoopMeasure(m.start, m.end);
              }
            }}
            title={hasLoop ? 'Quitar bucle' : 'Repetir compás actual'}
          >
            <Repeat size={16} />
            <small>Loop</small>
          </button>
          <button
            className={`sg-dock-play ${isPlaying ? 'playing' : ''}`}
            onClick={onPlayPause}
            title={isPlaying ? 'Pausa (Espacio)' : 'Reproducir (Espacio)'}
          >
            {isPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" style={{ marginLeft: 2 }} />}
          </button>

          <button
            className={`sg-dock-btn ${autoScroll ? 'on' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Seguir la reproducción automáticamente"
          >
            <Compass size={16} />
            <small>Seguir</small>
          </button>
          <button
            className="sg-dock-btn"
            onClick={() => setZoomLevel((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))}
            title="Reducir"
          >
            <ZoomOut size={16} />
            <small>{Math.round(zoomLevel * 100)}%</small>
          </button>
          <button
            className="sg-dock-btn"
            onClick={() => setZoomLevel((z) => Math.min(2.0, +(z + 0.15).toFixed(2)))}
            title="Ampliar"
          >
            <ZoomIn size={16} />
            <small>Zoom</small>
          </button>
          <button className="sg-dock-btn" onClick={copyAsciiTab} title="Copiar tablatura en texto ASCII">
            {copiedAscii ? <Check size={16} color="#1f9d55" /> : <Copy size={16} />}
            <small>{copiedAscii ? 'OK' : 'ASCII'}</small>
          </button>
          <div className="sg-dock-time">
            {formatTime(currentTime)}
          </div>
        </div>
      </div>
    </div>
  );
};

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

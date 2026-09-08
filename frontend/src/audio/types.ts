export interface TrackMetadata {
  title: string;
  duration_seconds: number;
  bpm: number;
  key: string;
  time_signature: string;
}

export interface ChordSegment {
  start: number;
  end: number;
  chord: string;
}

export interface NoteEvent {
  start: number;
  end: number;
  pitch_midi: number;
  note_name: string;
  string: number; // 1 to 6
  fret: number;   // 0 to 22
}

export interface SessionData {
  track_id: string;
  metadata: TrackMetadata;
  stems: Record<string, string>; // e.g. { drums: "/stems/...", ... }
  beat_grid: number[];
  chords: ChordSegment[];
  guitar_transcription: NoteEvent[];
}

export interface StemChannelState {
  id: string;
  name: string;
  volume: number; // 0.0 to 1.0
  pan: number;    // -1.0 to +1.0
  isMuted: boolean;
  isSolo: boolean;
  color: string;
}

export interface AudioEngineStatus {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  pitchShiftSemitones: number;
  metronomeActive: boolean;
  loopA: number | null;
  loopB: number | null;
}

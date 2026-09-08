import logging
from typing import List, Dict, Any, Optional
import numpy as np
import librosa
from pydantic import BaseModel

logger = logging.getLogger("transcription")

class NoteEvent(BaseModel):
    start: float
    end: float
    pitch_midi: int
    note_name: str
    string: int  # 1-indexed (1 is high E, 6 is low E for guitar)
    fret: int    # 0 to 22

class StringInstrumentTranscriber:
    """
    Transcribes monophonic/lead melodic lines from isolated guitar or bass stems
    and maps detected pitches into realistic guitar/bass tablatura coordinates.
    """
    NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    # Standard Guitar Tuning (Strings 1 to 6 from High to Low):
    # String 1: E4 (MIDI 64)
    # String 2: B3 (MIDI 59)
    # String 3: G3 (MIDI 55)
    # String 4: D3 (MIDI 50)
    # String 5: A2 (MIDI 45)
    # String 6: E2 (MIDI 40)
    GUITAR_OPEN_STRINGS = [64, 59, 55, 50, 45, 40]

    # Standard 4-String Bass Tuning (Strings 1 to 4):
    # String 1: G2 (MIDI 43)
    # String 2: D2 (MIDI 38)
    # String 3: A1 (MIDI 33)
    # String 4: E1 (MIDI 28)
    BASS_OPEN_STRINGS = [43, 38, 33, 28]

    @classmethod
    def midi_to_note_name(cls, midi_num: int) -> str:
        octave = (midi_num // 12) - 1
        note = cls.NOTE_NAMES[midi_num % 12]
        return f"{note}{octave}"

    @classmethod
    def map_to_guitar_tab(cls, midi_num: int, previous_fret: int = 5) -> Optional[Dict[str, int]]:
        """
        Finds the most ergonomic (string, fret) combination on a guitar.
        Penalizes huge jumps from the previous hand position.
        """
        candidates = []
        for string_idx, open_midi in enumerate(cls.GUITAR_OPEN_STRINGS, start=1):
            fret = midi_num - open_midi
            if 0 <= fret <= 22:
                # Calculate ergonomic cost (prefer lower frets, closer to previous_fret)
                distance_penalty = abs(fret - previous_fret)
                # Slight preference for middle frets (fret 3 to 9)
                fret_weight = 0 if (3 <= fret <= 12) else 3
                cost = distance_penalty + fret_weight
                candidates.append((cost, string_idx, fret))

        if not candidates:
            return None

        candidates.sort(key=lambda x: x[0])
        _, best_string, best_fret = candidates[0]
        return {"string": best_string, "fret": best_fret}

    @classmethod
    def transcribe(cls, audio_path: str, instrument: str = "guitar") -> List[NoteEvent]:
        """
        Runs pitch tracking (pYIN) on the audio file and produces NoteEvents with Tab coordinates.
        """
        logger.info(f"Transcribiendo notas para {instrument} desde {audio_path}")
        try:
            y, sr = librosa.load(audio_path, sr=22050, mono=True)
        except Exception as e:
            logger.error(f"Error cargando audio para transcripción: {e}")
            return []

        # Usar pYIN para estimación probabilística de F0
        fmin = librosa.note_to_hz('E2') if instrument == "guitar" else librosa.note_to_hz('E1')
        fmax = librosa.note_to_hz('E6') if instrument == "guitar" else librosa.note_to_hz('G4')

        f0, voiced_flag, voiced_prob = librosa.pyin(
            y,
            fmin=fmin,
            fmax=fmax,
            sr=sr,
            frame_length=2048,
            hop_length=512
        )

        times = librosa.times_like(f0, sr=sr, hop_length=512)
        note_events: List[NoteEvent] = []

        current_midi: Optional[int] = None
        start_time: float = 0.0
        last_fret: int = 5

        for i, (pitch, is_voiced) in enumerate(zip(f0, voiced_flag)):
            if is_voiced and not np.isnan(pitch) and pitch > 0:
                midi_val = int(round(librosa.hz_to_midi(pitch)))

                if current_midi is None:
                    current_midi = midi_val
                    start_time = float(times[i])
                elif midi_val != current_midi:
                    # Finalizar nota anterior si duró más de 50ms
                    duration = float(times[i]) - start_time
                    if duration >= 0.05 and current_midi is not None:
                        tab = cls.map_to_guitar_tab(current_midi, previous_fret=last_fret)
                        if tab:
                            last_fret = tab["fret"]
                            note_events.append(NoteEvent(
                                start=round(start_time, 3),
                                end=round(float(times[i]), 3),
                                pitch_midi=current_midi,
                                note_name=cls.midi_to_note_name(current_midi),
                                string=tab["string"],
                                fret=tab["fret"]
                            ))
                    current_midi = midi_val
                    start_time = float(times[i])
            else:
                if current_midi is not None:
                    duration = float(times[i]) - start_time
                    if duration >= 0.05:
                        tab = cls.map_to_guitar_tab(current_midi, previous_fret=last_fret)
                        if tab:
                            last_fret = tab["fret"]
                            note_events.append(NoteEvent(
                                start=round(start_time, 3),
                                end=round(float(times[i]), 3),
                                pitch_midi=current_midi,
                                note_name=cls.midi_to_note_name(current_midi),
                                string=tab["string"],
                                fret=tab["fret"]
                            ))
                    current_midi = None

        return note_events

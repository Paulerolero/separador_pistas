import logging
from typing import List, Dict, Any, Tuple
import numpy as np
import librosa
from pydantic import BaseModel

logger = logging.getLogger("mir_analyzer")

class ChordSegment(BaseModel):
    start: float
    end: float
    chord: str

class MirAnalysisResult(BaseModel):
    duration: float
    bpm: float
    key: str
    time_signature: str
    beat_grid: List[float]
    chords: List[ChordSegment]

class MirAnalyzer:
    """
    Music Information Retrieval (MIR) analyzer.
    Extracts BPM, Beat Grid timestamps, Musical Key, and Timeline-aligned Chords.
    """
    NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    # Chord templates for triadic and seventh harmonic profiling
    CHORD_TEMPLATES = {
        '':    np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]),  # Major
        'm':   np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]),  # Minor
        '7':   np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),  # Dominant 7
        'm7':  np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0]),  # Minor 7
        'maj7':np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1]),  # Major 7
    }

    # Krumhansl-Schmuckler key profiles
    MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

    @classmethod
    def estimate_key(cls, chroma_mean: np.ndarray) -> str:
        """Determines musical key by correlating average chromagram with Krumhansl profiles."""
        best_score = -float('inf')
        detected_key = "C Major"

        for root in range(12):
            rotated = np.roll(chroma_mean, -root)
            corr_maj = np.corrcoef(rotated, cls.MAJOR_PROFILE)[0, 1]
            corr_min = np.corrcoef(rotated, cls.MINOR_PROFILE)[0, 1]

            if not np.isnan(corr_maj) and corr_maj > best_score:
                best_score = corr_maj
                detected_key = f"{cls.NOTE_NAMES[root]} Major"
            if not np.isnan(corr_min) and corr_min > best_score:
                best_score = corr_min
                detected_key = f"{cls.NOTE_NAMES[root]} Minor"

        return detected_key

    @classmethod
    def match_chord(cls, chroma_vec: np.ndarray) -> str:
        """Classifies a normalized chroma vector into standard chord names."""
        norm = np.linalg.norm(chroma_vec)
        if norm < 1e-4:
            return "N"  # No chord / silence

        c_norm = chroma_vec / norm
        best_score = -1.0
        best_chord = "N"

        for root_idx, root_name in enumerate(cls.NOTE_NAMES):
            for suffix, template in cls.CHORD_TEMPLATES.items():
                t_rot = np.roll(template, root_idx)
                score = np.dot(c_norm, t_rot) / np.linalg.norm(t_rot)
                if score > best_score:
                    best_score = score
                    best_chord = f"{root_name}{suffix}"

        return best_chord

    @classmethod
    def analyze(cls, audio_path: str) -> MirAnalysisResult:
        """Runs full analysis on the provided audio file path."""
        logger.info(f"Iniciando análisis MIR de: {audio_path}")
        # Cargar audio a 22050 Hz para procesamiento eficiente
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        duration = float(librosa.get_duration(y=y, sr=sr))

        # 1. Beat Tracking & BPM
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=False)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
        bpm = float(tempo[0]) if isinstance(tempo, np.ndarray) else float(tempo)

        # Fallback si no detecta beats suficientes
        if len(beat_times) < 2:
            bpm = 120.0 if bpm <= 0 else bpm
            interval = 60.0 / bpm
            beat_times = list(np.arange(0, duration, interval))

        # 2. Separación armónico-percusiva para cromas limpios
        y_harmonic, _ = librosa.effects.hpss(y)

        # 3. Cromagrama CQT (Constant-Q Transform)
        chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr, hop_length=512)
        chroma_mean = np.mean(chroma, axis=1)

        # 4. Key Detection
        key = cls.estimate_key(chroma_mean)

        # 5. Beat-Synchronous Chords
        # Sincronizar cromas con los instantes de cada beat
        valid_frames = [f for f in beat_frames if f < chroma.shape[1]]
        if len(valid_frames) > 1:
            beat_chroma = librosa.util.sync(chroma, valid_frames, aggregate=np.median)
        else:
            beat_chroma = chroma

        chords: List[ChordSegment] = []
        num_intervals = min(len(beat_times), beat_chroma.shape[1])

        for i in range(num_intervals):
            start_t = beat_times[i]
            end_t = beat_times[i + 1] if i + 1 < len(beat_times) else duration
            c_vec = beat_chroma[:, i]
            chord_name = cls.match_chord(c_vec)

            # Compactar acordes contiguos idénticos
            if chords and chords[-1].chord == chord_name:
                chords[-1].end = round(end_t, 3)
            else:
                chords.append(ChordSegment(
                    start=round(start_t, 3),
                    end=round(end_t, 3),
                    chord=chord_name
                ))

        # Si el último acorde no llega al final de la pista, extenderlo
        if chords and chords[-1].end < duration:
            chords[-1].end = round(duration, 3)

        return MirAnalysisResult(
            duration=round(duration, 2),
            bpm=round(bpm, 1),
            key=key,
            time_signature="4/4",
            beat_grid=[round(b, 3) for b in beat_times],
            chords=chords
        )

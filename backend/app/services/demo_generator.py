import math
from pathlib import Path
import numpy as np
import soundfile as sf
import json
from app.core.config import STEMS_DIR, SESSIONS_DIR

def create_demo_session_if_needed():
    demo_id = "demo-session"
    demo_stems_dir = STEMS_DIR / demo_id
    demo_session_file = SESSIONS_DIR / f"{demo_id}.json"

    if demo_session_file.exists() and all((demo_stems_dir / f"{s}.wav").exists() for s in ["drums", "bass", "guitar", "vocals", "piano", "other"]):
        return demo_id

    demo_stems_dir.mkdir(parents=True, exist_ok=True)

    sr = 44100
    bpm = 110.0
    beat_duration = 60.0 / bpm
    bars = 8
    total_beats = bars * 4
    total_duration = total_beats * beat_duration
    num_samples = int(total_duration * sr)
    t = np.linspace(0, total_duration, num_samples, endpoint=False)

    # 1. DRUMS SYNTHESIS
    drums = np.zeros(num_samples)
    for b in range(total_beats):
        beat_start = int(b * beat_duration * sr)
        beat_in_bar = b % 4

        # Kick on 1 and 3
        if beat_in_bar in (0, 2):
            kick_len = int(0.25 * sr)
            if beat_start + kick_len < num_samples:
                kt = np.linspace(0, 0.25, kick_len)
                freq = 140 * np.exp(-18 * kt) + 45
                kick = np.sin(2 * np.pi * freq * kt) * np.exp(-10 * kt)
                drums[beat_start:beat_start + kick_len] += kick * 0.8

        # Snare on 2 and 4
        if beat_in_bar in (1, 3):
            snare_len = int(0.22 * sr)
            if beat_start + snare_len < num_samples:
                st = np.linspace(0, 0.22, snare_len)
                tone = np.sin(2 * np.pi * 185 * st) * np.exp(-15 * st)
                noise = (np.random.rand(snare_len) * 2 - 1) * np.exp(-16 * st)
                drums[beat_start:beat_start + snare_len] += (tone * 0.4 + noise * 0.5)

        # Hi-hat on every 8th note
        for sub in [0, 0.5]:
            hh_start = int((b + sub) * beat_duration * sr)
            hh_len = int(0.06 * sr)
            if hh_start + hh_len < num_samples:
                ht = np.linspace(0, 0.06, hh_len)
                hh_noise = (np.random.rand(hh_len) * 2 - 1) * np.exp(-55 * ht)
                drums[hh_start:hh_start + hh_len] += hh_noise * 0.25

    # 2. BASS SYNTHESIS (A minor progression: Am - F - C - G)
    chord_roots = [
        ('A', 55.0, 45),    # A1 (55Hz, MIDI 45 / A2)
        ('F', 43.65, 41),   # F1 (43.65Hz, MIDI 41 / F2)
        ('C', 65.41, 48),   # C2 (65.41Hz, MIDI 48 / C3)
        ('G', 49.00, 43)    # G1 (49Hz, MIDI 43 / G2)
    ]
    bass = np.zeros(num_samples)
    for bar in range(bars):
        chord_info = chord_roots[bar % 4]
        root_hz = chord_info[1]
        for b in range(4):
            beat_idx = bar * 4 + b
            b_start = int(beat_idx * beat_duration * sr)
            b_len = int(beat_duration * 0.85 * sr)
            if b_start + b_len < num_samples:
                bt = np.linspace(0, beat_duration * 0.85, b_len)
                f = root_hz if b in (0, 1, 2) else root_hz * 1.5 # 5th on 4th beat
                bass_note = (np.sin(2 * np.pi * f * bt) +
                             0.5 * np.sin(2 * np.pi * f * 2 * bt) +
                             0.2 * np.sin(2 * np.pi * f * 3 * bt)) * np.exp(-2.5 * bt)
                bass[b_start:b_start + b_len] += bass_note * 0.65

    # 3. GUITAR SYNTHESIS (Arpeggios)
    guitar = np.zeros(num_samples)
    chord_guitar_arps = [
        [220.0, 261.63, 329.63, 440.0],  # Am (A3, C4, E4, A4)
        [174.61, 220.0, 261.63, 349.23],  # F  (F3, A3, C4, F4)
        [261.63, 329.63, 392.00, 523.25],  # C  (C4, E4, G4, C5)
        [196.00, 246.94, 293.66, 392.00],  # G  (G3, B3, D4, G4)
    ]
    for bar in range(bars):
        arp = chord_guitar_arps[bar % 4]
        for note_step in range(8): # 8th notes
            g_time = (bar * 4 + note_step * 0.5) * beat_duration
            g_start = int(g_time * sr)
            g_len = int(0.7 * sr)
            if g_start + g_len < num_samples:
                gt = np.linspace(0, 0.7, g_len)
                note_freq = arp[note_step % len(arp)]
                # Karplus-strong-like plucked tone
                gtr_note = (np.sin(2 * np.pi * note_freq * gt) +
                            0.4 * np.sin(2 * np.pi * note_freq * 2 * gt) +
                            0.2 * np.sin(2 * np.pi * note_freq * 3 * gt)) * np.exp(-5.0 * gt)
                guitar[g_start:g_start + g_len] += gtr_note * 0.45

    # 4. PIANO SYNTHESIS (Chords on each bar)
    piano = np.zeros(num_samples)
    for bar in range(bars):
        p_start = int(bar * 4 * beat_duration * sr)
        p_len = int(4 * beat_duration * sr)
        if p_start + p_len <= num_samples:
            pt = np.linspace(0, 4 * beat_duration, p_len)
            arp = chord_guitar_arps[bar % 4]
            chord_sound = sum(np.sin(2 * np.pi * f * pt) for f in arp) * np.exp(-0.8 * pt)
            piano[p_start:p_start + p_len] += chord_sound * 0.3

    # 5. VOCALS / LEAD SYNTH
    vocals = np.zeros(num_samples)
    lead_notes = [440.0, 523.25, 587.33, 659.25, 523.25, 440.0, 392.0, 440.0]
    for bar in range(bars):
        for b in range(2):
            v_start = int((bar * 4 + b * 2) * beat_duration * sr)
            v_len = int(1.4 * sr)
            if v_start + v_len < num_samples:
                vt = np.linspace(0, 1.4, v_len)
                vf = lead_notes[(bar * 2 + b) % len(lead_notes)]
                vibrato = 1.0 + 0.015 * np.sin(2 * np.pi * 5.5 * vt)
                vocal_tone = (np.sin(2 * np.pi * vf * vibrato * vt) +
                              0.3 * np.sin(2 * np.pi * vf * 2 * vt)) * np.sin(np.pi * vt / 1.4)
                vocals[v_start:v_start + v_len] += vocal_tone * 0.4

    # 6. OTHER / AMBIENT PAD
    other = np.zeros(num_samples)
    for bar in range(bars):
        o_start = int(bar * 4 * beat_duration * sr)
        o_len = int(4 * beat_duration * sr)
        if o_start + o_len <= num_samples:
            ot = np.linspace(0, 4 * beat_duration, o_len)
            pad = (np.sin(2 * np.pi * 110 * ot) + np.sin(2 * np.pi * 220 * ot) + np.sin(2 * np.pi * 330 * ot)) * 0.15
            other[o_start:o_start + o_len] += pad

    # Guardar archivos WAV
    stems_files = {
        "drums": drums,
        "bass": bass,
        "guitar": guitar,
        "piano": piano,
        "vocals": vocals,
        "other": other
    }
    stems_urls = {}
    for name, data in stems_files.items():
        peak = np.max(np.abs(data))
        if peak > 0:
            data = data / peak * 0.9
        sf.write(str(demo_stems_dir / f"{name}.wav"), data, sr)
        stems_urls[name] = f"/stems/{demo_id}/{name}.wav"

    # Beat Grid & Chords
    beat_grid = [round(b * beat_duration, 3) for b in range(total_beats)]
    chord_names = ["Am", "F", "C", "G"]
    chords = []
    for bar in range(bars):
        c_name = chord_names[bar % 4]
        start_t = round(bar * 4 * beat_duration, 3)
        end_t = round((bar + 1) * 4 * beat_duration, 3)
        chords.append({
            "start": start_t,
            "end": end_t,
            "chord": c_name
        })

    # Guitar Transcription / Tab
    guitar_notes = []
    guitar_tab_map = {
        220.0: {"pitch": 57, "note": "A3", "string": 4, "fret": 7},
        261.63: {"pitch": 60, "note": "C4", "string": 3, "fret": 5},
        329.63: {"pitch": 64, "note": "E4", "string": 2, "fret": 5},
        440.0: {"pitch": 69, "note": "A4", "string": 1, "fret": 5},
        174.61: {"pitch": 53, "note": "F3", "string": 4, "fret": 3},
        349.23: {"pitch": 65, "note": "F4", "string": 2, "fret": 6},
        392.00: {"pitch": 67, "note": "G4", "string": 1, "fret": 3},
        523.25: {"pitch": 72, "note": "C5", "string": 1, "fret": 8},
        196.00: {"pitch": 55, "note": "G3", "string": 3, "fret": 0},
        246.94: {"pitch": 59, "note": "B3", "string": 2, "fret": 0},
        293.66: {"pitch": 62, "note": "D4", "string": 3, "fret": 7},
    }

    for bar in range(bars):
        arp = chord_guitar_arps[bar % 4]
        for note_step in range(8):
            g_time = (bar * 4 + note_step * 0.5) * beat_duration
            note_freq = arp[note_step % len(arp)]
            tab_info = guitar_tab_map.get(note_freq, {"pitch": 60, "note": "C4", "string": 3, "fret": 5})
            guitar_notes.append({
                "start": round(g_time, 3),
                "end": round(g_time + 0.35, 3),
                "pitch_midi": tab_info["pitch"],
                "note_name": tab_info["note"],
                "string": tab_info["string"],
                "fret": tab_info["fret"]
            })

    session_data = {
        "track_id": demo_id,
        "metadata": {
            "title": "A Minor Guitar Groove (Demo Jam)",
            "duration_seconds": round(total_duration, 2),
            "bpm": bpm,
            "key": "A Minor",
            "time_signature": "4/4"
        },
        "stems": stems_urls,
        "beat_grid": beat_grid,
        "chords": chords,
        "guitar_transcription": guitar_notes
    }

    with open(demo_session_file, "w", encoding="utf-8") as f:
        json.dump(session_data, f, indent=2)

    return demo_id

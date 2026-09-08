import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MultiTrackEngine } from './audio/MultiTrackEngine';
import type { SessionData } from './audio/types';
import { Header } from './components/Header';
import { PracticeControls } from './components/PracticeControls';
import { StudioWorkspace } from './components/StudioWorkspace';
import { FretboardView } from './components/FretboardView';
import { UploadModal } from './components/UploadModal';
import { UserLibraryModal } from './components/UserLibraryModal';
import { SettingsModal } from './components/SettingsModal';
import { useAuth } from './firebase/useAuth';
import {
  saveUserTrack,
  getUserTracks,
  deleteUserTrack,
  saveUserPreferences,
  getUserPreferences,
  type SavedTrackItem,
  type UserPreferences,
} from './firebase/firestore';

const DEFAULT_API_URL = 'http://127.0.0.1:8000';
const STORAGE_API_KEY = 'stemlab_api_url';

export const App: React.FC = () => {
  const { user } = useAuth();
  const [engine] = useState(() => new MultiTrackEngine());
  const engineRef = useRef<MultiTrackEngine>(engine);

  const [apiUrl, setApiUrl] = useState<string>(() => {
    return localStorage.getItem(STORAGE_API_KEY) || DEFAULT_API_URL;
  });

  const [session, setSession] = useState<SessionData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [metronomeActive, setMetronomeActive] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  // Modales
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  // Biblioteca y preferencias
  const [savedTracks, setSavedTracks] = useState<SavedTrackItem[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  // Carga de sesión en el motor
  const applySessionData = useCallback(async (newSession: SessionData) => {
    const eng = engineRef.current;
    if (!eng) return;

    setSession(newSession);
    setDuration(newSession.metadata.duration_seconds);
    eng.setBeatGrid(newSession.beat_grid);

    await eng.loadStems(newSession.stems, apiUrl);
    setDuration(eng.getDuration() || newSession.metadata.duration_seconds);
    eng.seek(0);
    setCurrentTime(0);

    // Guardar automáticamente en el perfil del usuario si hay sesión activa o local
    const uid = user ? user.uid : 'guest';
    await saveUserTrack(uid, newSession);
    // Recargar lista
    const updated = await getUserTracks(uid);
    setSavedTracks(updated);
  }, [apiUrl, user]);

  // Carga de sesión de demostración
  const loadDemoSession = useCallback(async () => {
    setIsLoadingDemo(true);
    try {
      const resp = await fetch(`${apiUrl}/api/v1/tracks/demo-session/session`);
      if (resp.ok) {
        const demoData: SessionData = await resp.json();
        await applySessionData(demoData);
      }
    } catch (err) {
      console.warn('No se pudo cargar la demo desde el backend:', err);
    } finally {
      setIsLoadingDemo(false);
    }
  }, [apiUrl, applySessionData]);

  // Sincronizar reloj de animación UI a 60 FPS
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (engineRef.current) {
        const t = engineRef.current.getCurrentTime();
        setCurrentTime(t);
        setIsPlaying(engineRef.current.getIsPlaying());
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Cargar demo inicial
    loadDemoSession();

    return () => {
      cancelAnimationFrame(rafId);
      engine.stop();
    };
  }, [engine, loadDemoSession]);

  // Cargar canciones guardadas y preferencias cuando cambie el usuario
  useEffect(() => {
    const uid = user ? user.uid : 'guest';
    getUserTracks(uid).then((tracks) => setSavedTracks(tracks));
    getUserPreferences(uid).then((prefs) => {
      if (prefs) {
        setUserPreferences(prefs);
        if (typeof prefs.playbackRate === 'number') {
          setPlaybackRate(prefs.playbackRate);
          engineRef.current.setPlaybackRate(prefs.playbackRate);
        }
        if (typeof prefs.metronomeActive === 'boolean') {
          setMetronomeActive(prefs.metronomeActive);
          engineRef.current.setMetronome(prefs.metronomeActive);
        }
      }
    });
  }, [user]);

  const handleSaveApiUrl = (newUrl: string) => {
    setApiUrl(newUrl);
    localStorage.setItem(STORAGE_API_KEY, newUrl);
  };

  // Controles de Transporte
  const handlePlayPause = useCallback(() => {
    const eng = engineRef.current;
    if (isPlaying) {
      eng.pause();
    } else {
      eng.play();
    }
    setIsPlaying(eng.getIsPlaying());
  }, [isPlaying]);

  const handleStop = () => {
    const eng = engineRef.current;
    eng.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (timeSec: number) => {
    const eng = engineRef.current;
    eng.seek(timeSec);
    setCurrentTime(timeSec);
  };

  const handleSetPlaybackRate = (rate: number) => {
    const eng = engineRef.current;
    eng.setPlaybackRate(rate);
    setPlaybackRate(rate);
  };

  const handleToggleMetronome = useCallback(() => {
    const eng = engineRef.current;
    const next = !metronomeActive;
    eng.setMetronome(next);
    setMetronomeActive(next);
  }, [metronomeActive]);

  const handleSetLoopA = () => {
    const eng = engineRef.current;
    const pos = eng.getCurrentTime();
    eng.setLoopA(pos);
    setLoopA(pos);
  };

  const handleSetLoopB = () => {
    const eng = engineRef.current;
    const pos = eng.getCurrentTime();
    eng.setLoopB(pos);
    setLoopB(pos);
  };

  const handleClearLoop = () => {
    const eng = engineRef.current;
    eng.clearLoop();
    setLoopA(null);
    setLoopB(null);
  };

  // Guardar preferencias de mezcla al perfil
  const handleSaveMixPreferences = async (prefs: UserPreferences) => {
    const uid = user ? user.uid : 'guest';
    const merged: UserPreferences = {
      ...userPreferences,
      ...prefs,
      metronomeActive,
      playbackRate,
    };
    await saveUserPreferences(uid, merged);
    setUserPreferences(merged);
  };

  const handleDeleteSavedTrack = async (trackId: string) => {
    const uid = user ? user.uid : 'guest';
    await deleteUserTrack(uid, trackId);
    const updated = await getUserTracks(uid);
    setSavedTracks(updated);
  };

  // Atajos de teclado para flujo de práctica rápido
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'KeyM') {
        handleToggleMetronome();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(Math.min(duration, currentTime + 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleToggleMetronome, currentTime, duration]);

  // Encontrar acorde activo en tiempo real
  const activeChordSegment = session?.chords.find(
    (c) => currentTime >= c.start && currentTime < c.end
  );
  const currentChord = activeChordSegment?.chord || (session?.chords[0]?.chord ?? '--');

  return (
    <div className="single-screen-app">
      {/* 1. Barra Superior Compacta con Perfil Google y Metadatos */}
      <Header
        onOpenUpload={() => setIsUploadOpen(true)}
        onLoadDemo={loadDemoSession}
        isLoadingDemo={isLoadingDemo}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        savedTracksCount={savedTracks.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        trackTitle={session?.metadata.title}
        keyName={session?.metadata.key}
        bpm={session?.metadata.bpm}
        currentChord={currentChord}
      />

      {/* 2. Barra de Transporte & Práctica Ultra-Compacta */}
      <PracticeControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        metronomeActive={metronomeActive}
        loopA={loopA}
        loopB={loopB}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onSetPlaybackRate={handleSetPlaybackRate}
        onToggleMetronome={handleToggleMetronome}
        onSetLoopA={handleSetLoopA}
        onSetLoopB={handleSetLoopB}
        onClearLoop={handleClearLoop}
      />

      {/* 3. Área Central: Mixer Compacto Acoplado a un Costado de la Línea de Tiempo */}
      <StudioWorkspace
        engine={engine}
        stems={session?.stems || {}}
        isPlaying={isPlaying}
        duration={duration}
        currentTime={currentTime}
        beatGrid={session?.beat_grid || []}
        chords={session?.chords || []}
        loopA={loopA}
        loopB={loopB}
        onSeek={handleSeek}
        onSaveMixPreferences={handleSaveMixPreferences}
        initialPreferences={userPreferences}
      />

      {/* 4. Mástil Interactivo para Cuerdas en la Base (Compacto) */}
      <FretboardView
        currentTime={currentTime}
        notes={session?.guitar_transcription || []}
        initialInstrument={userPreferences?.instrument || 'guitar'}
        onInstrumentChange={(inst) => {
          const uid = user ? user.uid : 'guest';
          saveUserPreferences(uid, { ...userPreferences, instrument: inst });
        }}
      />

      {/* 5. Modal de Carga con Demucs & Telemetría */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSessionLoaded={applySessionData}
        apiUrl={apiUrl}
      />

      {/* 6. Modal de Biblioteca de Canciones Guardadas */}
      <UserLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        tracks={savedTracks}
        onSelectTrack={applySessionData}
        onDeleteTrack={handleDeleteSavedTrack}
        userName={user?.displayName}
      />

      {/* 7. Modal de Ajustes (Backend IA y Credenciales Firebase) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiUrl={apiUrl}
        onSaveApiUrl={handleSaveApiUrl}
      />
    </div>
  );
};

export default App;

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { SessionData } from '../audio/types';

export interface UserPreferences {
  masterVolume?: number;
  channelVolumes?: Record<string, number>;
  channelPans?: Record<string, number>;
  instrument?: 'guitar' | 'bass';
  metronomeActive?: boolean;
  playbackRate?: number;
}

export interface SavedTrackItem {
  track_id: string;
  title: string;
  duration_seconds: number;
  bpm: number;
  key: string;
  time_signature: string;
  saved_at?: string;
  session_data: SessionData;
}

const LOCAL_PREFS_KEY = 'stemlab_local_preferences';
const LOCAL_TRACKS_KEY = 'stemlab_local_tracks';

// ---- PREFERENCIAS DE USUARIO ----

export const saveUserPreferences = async (userId: string, prefs: UserPreferences): Promise<void> => {
  // Guardar siempre en local para sincronización rápida
  try {
    localStorage.setItem(`${LOCAL_PREFS_KEY}_${userId}`, JSON.stringify(prefs));
  } catch {
    // Ignore error
  }

  if (!db || !userId) return;

  try {
    const ref = doc(db, 'users', userId, 'settings', 'preferences');
    await setDoc(ref, {
      ...prefs,
      updated_at: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('No se pudo sincronizar preferencias con Firestore:', err);
  }
};

export const getUserPreferences = async (userId: string): Promise<UserPreferences | null> => {
  // Leer primero Firestore si está disponible
  if (db && userId) {
    try {
      const ref = doc(db, 'users', userId, 'settings', 'preferences');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data() as UserPreferences;
      }
    } catch (err) {
      console.warn('Error leyendo preferencias de Firestore:', err);
    }
  }

  // Fallback a localStorage
  try {
    const raw = localStorage.getItem(`${LOCAL_PREFS_KEY}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore error
  }
  return null;
};

// ---- BIBLIOTECA DE CANCIONES DEL USUARIO ----

export const saveUserTrack = async (userId: string, session: SessionData): Promise<void> => {
  const trackId = session.track_id;
  const item: SavedTrackItem = {
    track_id: trackId,
    title: session.metadata.title || 'Canción sin título',
    duration_seconds: session.metadata.duration_seconds || 0,
    bpm: session.metadata.bpm || 0,
    key: session.metadata.key || '--',
    time_signature: session.metadata.time_signature || '4/4',
    saved_at: new Date().toISOString(),
    session_data: session,
  };

  // Guardar en local storage para disponibilidad inmediata
  try {
    const rawList = localStorage.getItem(`${LOCAL_TRACKS_KEY}_${userId}`);
    const list: SavedTrackItem[] = rawList ? JSON.parse(rawList) : [];
    const filtered = list.filter((t) => t.track_id !== trackId);
    filtered.unshift(item);
    localStorage.setItem(`${LOCAL_TRACKS_KEY}_${userId}`, JSON.stringify(filtered.slice(0, 50)));
  } catch {
    // Ignore error
  }

  if (!db || !userId) return;

  try {
    const ref = doc(db, 'users', userId, 'tracks', trackId);
    await setDoc(ref, {
      ...item,
      created_at: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo guardar la pista en Firestore:', err);
  }
};

export const getUserTracks = async (userId: string): Promise<SavedTrackItem[]> => {
  if (db && userId) {
    try {
      const colRef = collection(db, 'users', userId, 'tracks');
      const q = query(colRef, orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as SavedTrackItem);
      }
    } catch (err) {
      console.warn('Error recuperando canciones desde Firestore, usando respaldo local:', err);
    }
  }

  // Fallback a localStorage
  try {
    const raw = localStorage.getItem(`${LOCAL_TRACKS_KEY}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore error
  }

  return [];
};

export const deleteUserTrack = async (userId: string, trackId: string): Promise<void> => {
  // Eliminar en local
  try {
    const raw = localStorage.getItem(`${LOCAL_TRACKS_KEY}_${userId}`);
    if (raw) {
      const list: SavedTrackItem[] = JSON.parse(raw);
      const filtered = list.filter((t) => t.track_id !== trackId);
      localStorage.setItem(`${LOCAL_TRACKS_KEY}_${userId}`, JSON.stringify(filtered));
    }
  } catch {
    // Ignore error
  }

  if (!db || !userId) return;

  try {
    const ref = doc(db, 'users', userId, 'tracks', trackId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('No se pudo eliminar la pista en Firestore:', err);
  }
};

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseCustomConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const STORAGE_KEY = 'stemlab_firebase_config';

export const getStoredFirebaseConfig = (): FirebaseCustomConfig | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore error
  }
  return null;
};

export const getEffectiveFirebaseConfig = (): FirebaseCustomConfig | null => {
  const custom = getStoredFirebaseConfig();
  if (custom && custom.apiKey && custom.projectId) {
    return custom;
  }

  // Fallback a variables de entorno de Vite
  const envConfig: FirebaseCustomConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };

  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  return null;
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export const initFirebase = (): { app: FirebaseApp | null; auth: Auth | null; db: Firestore | null } => {
  const config = getEffectiveFirebaseConfig();
  if (!config) {
    return { app: null, auth: null, db: null };
  }

  try {
    if (!getApps().length) {
      appInstance = initializeApp(config);
    } else {
      appInstance = getApps()[0];
    }
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
  } catch (err) {
    console.warn('Error inicializando Firebase:', err);
    return { app: null, auth: null, db: null };
  }

  return { app: appInstance, auth: authInstance, db: dbInstance };
};

// Inicialización inicial
const instances = initFirebase();
export const app = instances.app;
export const auth = instances.auth;
export const db = instances.db;

export const saveCustomFirebaseConfig = (cfg: FirebaseCustomConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  window.location.reload();
};

export const clearCustomFirebaseConfig = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
};

export const isFirebaseConfigured = (): boolean => {
  return !!getEffectiveFirebaseConfig();
};

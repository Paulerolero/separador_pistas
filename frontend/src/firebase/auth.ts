import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './config';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const loginWithGoogle = async (): Promise<User | null> => {
  if (!auth) {
    throw new Error('Firebase no está configurado aún. Configura tus credenciales de Firebase en Ajustes.');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

export const logoutUser = async (): Promise<void> => {
  if (!auth) return;
  await signOut(auth);
};

export const onUserChange = (callback: (user: User | null) => void): (() => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

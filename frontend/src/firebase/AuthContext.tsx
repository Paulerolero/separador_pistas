import React, { createContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { loginWithGoogle, logoutUser, onUserChange } from './auth';
import { isFirebaseConfigured } from './config';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  login: () => Promise<User | null>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  isConfigured: false,
  login: async () => null,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;

    const unsubscribe = onUserChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [configured]);

  const handleLogin = async () => {
    try {
      const u = await loginWithGoogle();
      setUser(u);
      return u;
    } catch (err) {
      console.error('Error al iniciar sesión con Google:', err);
      throw err;
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
    } catch (err) {
      console.error('Error cerrando sesión:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: configured,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AuthUser = {
  user_id: string;
  username: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  register: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem('ventore-auth-user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // components/AuthProvider.tsx
// ... di dalam useEffect inisialisasi ...

  useEffect(() => {
    const init = async () => {
      const stored = readStoredUser();
      if (stored) {
        setUser(stored);
        // FORCE FETCH: Ambil data terbaru dari cloud agar device sinkron
        // Kamu bisa memanggil fungsi fetch data (misal getSalesHistory) di sini
      }
      setLoading(false);
    };
    void init();
  }, []);

  const persistUser = (nextUser: AuthUser | null) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (nextUser) {
      window.localStorage.setItem('ventore-auth-user', JSON.stringify(nextUser));
      return;
    }

    window.localStorage.removeItem('ventore-auth-user');
  };

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.user) {
      return { ok: false, message: data.message || 'Login gagal' };
    }

    setUser(data.user);
    persistUser(data.user);
    return { ok: true };
  };

  const register = async (username: string, password: string) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.user) {
      return { ok: false, message: data.message || 'Registrasi gagal' };
    }

    setUser(data.user);
    persistUser(data.user);
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    persistUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

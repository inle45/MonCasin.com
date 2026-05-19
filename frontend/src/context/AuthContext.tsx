'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types';
import api from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, pseudo: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  isLoading: boolean;
  serverWaking: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchMe(retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await api.get('/auth/me', { timeout: 40000 });
      return res.data.user;
    } catch (err: any) {
      if (err?.response?.status === 401) throw err;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
      else throw err;
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('casino_token');
    if (savedToken) {
      setToken(savedToken);
      const wakingTimer = setTimeout(() => setServerWaking(true), 4000);
      fetchMe()
        .then(u => setUser(u))
        .catch(() => {
          localStorage.removeItem('casino_token');
          setToken(null);
        })
        .finally(() => {
          clearTimeout(wakingTimer);
          setServerWaking(false);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser, streakBonus } = res.data;
    localStorage.setItem('casino_token', newToken);
    setToken(newToken);
    setUser(newUser);
    if (newUser.streak > 1) {
      const msg = streakBonus > 0
        ? `🔥 Streak jour ${newUser.streak} ! +${streakBonus.toLocaleString('fr-FR')} F€`
        : `🔥 Streak jour ${newUser.streak} ! Continue comme ça`;
      import('react-hot-toast').then(({ default: toast }) => toast.success(msg, { duration: 5000 }));
    }
  };

  const register = async (email: string, pseudo: string, password: string) => {
    const res = await api.post('/auth/register', { email, pseudo, password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('casino_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('casino_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (data: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, isLoading, serverWaking }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

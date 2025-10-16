import { create } from 'zustand';
import type { User } from '../types';

const AUTH_TOKEN_KEY = import.meta.env.VITE_AUTH_TOKEN_KEY;

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(AUTH_TOKEN_KEY),
  
  setAuth: (user, token) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    set({ user, token });
  },
  
  logout: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    set({ user: null, token: null });
  },
  
  isAuthenticated: () => {
    return !!get().token;
  },
}));
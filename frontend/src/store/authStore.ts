import { create } from 'zustand';
import type { User } from '../types';

const AUTH_TOKEN_KEY = import.meta.env.VITE_AUTH_TOKEN_KEY || 'sleeper_auth_token';
const AUTH_USER_KEY = 'sleeper_auth_user';

// Initialize from localStorage immediately
const getInitialAuth = () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const userStr = localStorage.getItem(AUTH_USER_KEY);
  
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      return { user, token };
    } catch (e) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }
  
  return { user: null, token: null };
};

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...getInitialAuth(), // Initialize state immediately
  
  setAuth: (user, token) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    set({ user, token });
  },
  
  logout: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    set({ user: null, token: null });
  },
  
  isAuthenticated: () => {
    return !!get().token;
  },
}));
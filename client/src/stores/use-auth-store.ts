import { create } from 'zustand';
import { useAppStore } from './use-app-store';

export interface AuthUser {
  id: number;
  mt5Login: number;
  readOnly: boolean; // investor-password session: view only, no trading
  name: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  loginModalOpen: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setLoginModalOpen: (open: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,
  loginModalOpen: false,
  setUser: (user) => {
    // Watchlists are kept per MT5 login in this browser
    if (user) useAppStore.getState().loadWatchlistFor(String(user.mt5Login));
    set({ user });
  },
  setLoading: (loading) => set({ loading }),
  setLoginModalOpen: (open) => set({ loginModalOpen: open }),
}));

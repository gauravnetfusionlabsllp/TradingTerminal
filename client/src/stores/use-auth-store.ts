import { create } from 'zustand';
import { useAppStore } from './use-app-store';

export interface AuthUser {
  id: number;
  email: string | null;
  mt5Login: number;
  readOnly: boolean; // investor-password session: view only, no trading
  name: string | null;
  avatarUrl: string | null;
  plan: string;
  planExpiresAt: string | null;
  hasAlpaca: boolean;
  alpacaPaper: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  loginModalOpen: boolean;
  upgradeModalOpen: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setLoginModalOpen: (open: boolean) => void;
  setUpgradeModalOpen: (open: boolean) => void;
  isPro: () => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  loading: true,
  loginModalOpen: false,
  upgradeModalOpen: false,
  setUser: (user) => {
    // Watchlists are kept per MT5 login in this browser
    if (user) useAppStore.getState().loadWatchlistFor(String(user.mt5Login));
    set({ user });
  },
  setLoading: (loading) => set({ loading }),
  setLoginModalOpen: (open) => set({ loginModalOpen: open }),
  setUpgradeModalOpen: (open) => set({ upgradeModalOpen: open }),
  isPro: () => {
    const { user } = get();
    if (!user || user.plan !== 'pro') return false;
    if (!user.planExpiresAt) return true;
    return new Date(user.planExpiresAt) > new Date();
  },
}));

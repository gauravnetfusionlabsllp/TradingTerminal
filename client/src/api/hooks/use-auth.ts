import { useEffect, useCallback } from 'react';
import { useAuthStore, type AuthUser } from '../../stores/use-auth-store';
import { API_BASE as BASE } from '../client';

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

// ?login= / ?sso= come from the client portal's "Trade" button, read once at load.
const bootParams = new URLSearchParams(window.location.search);
const portalLogin = bootParams.get('login');
const portalSso = bootParams.get('sso');

// One boot per page load (React StrictMode runs effects twice in dev; a second
// run must not try to redeem the single-use token again).
let bootPromise: Promise<AuthUser | null> | null = null;

function bootSession(): Promise<AuthUser | null> {
  if (bootPromise) return bootPromise;

  // Strip the one-time token from the address bar right away (history, bookmarks, screenshots).
  if (portalSso) {
    const params = new URLSearchParams(window.location.search);
    params.delete('sso');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  }

  const me = () => fetchJSON<{ user: AuthUser | null }>('/auth/me').then((d) => d.user);
  bootPromise = portalSso
    ? fetchJSON<{ user: AuthUser }>('/auth/sso', { method: 'POST', body: JSON.stringify({ token: portalSso }) })
        .then((d) => d.user)
        // Expired/used/unavailable: keep an existing session only if it's the account the
        // portal asked for; otherwise the caller opens the login modal (?login= prefilled).
        .catch(() => me().then((user) =>
          user && (!portalLogin || String(user.mt5Login) === portalLogin) ? user : Promise.reject(new Error('sso failed'))))
    : me();
  return bootPromise;
}

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);

  useEffect(() => {
    bootSession()
      .then((user) => setUser(user))
      .catch(() => {
        setUser(null);
        if (portalSso || portalLogin) setLoginModalOpen(true);
      })
      .finally(() => setLoading(false));
  }, [setUser, setLoading, setLoginModalOpen]);
}

export function useAuthActions() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);

  const login = useCallback(async (mt5Login: number, password: string, investor: boolean) => {
    const { user } = await fetchJSON<{ user: AuthUser; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: mt5Login, password, investor }),
    });
    setUser(user);
    setLoginModalOpen(false);
  }, [setUser, setLoginModalOpen]);

  const logout = useCallback(async () => {
    await fetchJSON('/auth/logout', { method: 'POST' });
    setUser(null);
  }, [setUser]);

  return { login, logout };
}


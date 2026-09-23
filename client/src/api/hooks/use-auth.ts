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

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    fetchJSON<{ user: AuthUser | null }>('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [setUser, setLoading]);
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


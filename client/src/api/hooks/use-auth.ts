import { useEffect, useCallback } from 'react';
import { useAuthStore, type AuthUser } from '../../stores/use-auth-store';
import { API_BASE as BASE } from '../client';

function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.stripe.com');
  } catch {
    return false;
  }
}

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

  const openCheckout = useCallback(async () => {
    const data = await fetchJSON<{ url: string }>('/billing/checkout', { method: 'POST' });
    if (data.url && isSafeRedirectUrl(data.url)) window.location.href = data.url;
  }, []);

  const openPortal = useCallback(async () => {
    const data = await fetchJSON<{ url: string }>('/billing/portal', { method: 'POST' });
    if (data.url && isSafeRedirectUrl(data.url)) window.location.href = data.url;
  }, []);

  return { login, logout, openCheckout, openPortal };
}

/**
 * Detects ?billing=success in URL after Stripe checkout redirect.
 * Calls /api/billing/sync to update the user's plan, refreshes user data,
 * then cleans the URL.
 */
export function useBillingSync() {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') !== 'success') return;

    // Clean URL immediately
    const url = new URL(window.location.href);
    url.searchParams.delete('billing');
    window.history.replaceState({}, '', url.pathname + url.search);

    // Sync billing status then refresh user
    (async () => {
      try {
        await fetchJSON('/billing/sync', { method: 'POST' });
        const data = await fetchJSON<{ user: AuthUser | null }>('/auth/me');
        if (data.user) setUser(data.user);
      } catch {
        // Silent fail — user can manually refresh
      }
    })();
  }, [setUser]);
}

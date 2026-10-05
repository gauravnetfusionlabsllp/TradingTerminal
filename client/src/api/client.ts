import { useAuthStore } from '../stores/use-auth-store';

// The browser calls the API server directly (no dev proxy). Dev defaults to the local server; production builds
// stay same-origin because the server serves the client. VITE_API_URL overrides both.
// `?.`: import.meta.env is undefined outside Vite (tsx self-checks)
export const API_URL = (import.meta.env?.VITE_API_URL || (import.meta.env?.DEV ? 'http://192.168.15.77:3001' : '')).replace(/\/$/, '');
export const API_BASE = `${API_URL}/api`;
const BASE_URL = API_BASE;
const REQUEST_TIMEOUT = 30_000; // 30s timeout for all API requests

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Abort controller with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      // Live trading data: bypass copies browsers stored when /mt5 was still sent with max-age=3600
      ...(path.startsWith('/mt5') && { cache: 'no-store' as const }),
      ...init,
      credentials: 'include',
      signal: init?.signal || controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!res.ok) {
      // JWT expired or revoked while logged in → drop the user and ask for MT5 login again
      const auth = useAuthStore.getState();
      if (res.status === 401 && auth.user) {
        auth.setUser(null);
        auth.setLoginModalOpen(true);
      }
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(res.status, body.error || res.statusText);
    }

    return res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new ApiError(408, 'Request timeout');
    }
    throw new ApiError(0, (err as Error).message || 'Network error');
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Open the login modal (call explicitly from user-initiated actions only) */
export function openLoginModal() {
  useAuthStore.getState().setLoginModalOpen(true);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../stores/use-app-store';
import { API_URL } from '../api/client';
import { useAuthStore } from '../stores/use-auth-store';
import { useMt5Live, wantedMt5Symbols, type Mt5Quote } from '../api/hooks/use-mt5';

function getWsUrl() {
  // Same server as the REST API (called directly, no dev proxy)
  if (API_URL) return `${API_URL.replace(/^http/, 'ws')}/ws`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const HEARTBEAT_TIMEOUT = 60_000; // must be > server's 25s ping interval (generous buffer)

// The one app-wide socket, so hooks elsewhere (MT5 quote subscriptions) can send on it
let socket: WebSocket | null = null;

export function sendWs(msg: object) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setWsConnected = useAppStore((s) => s.setWsConnected);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const authLoading = useAuthStore((s) => s.loading);
  const lastUserRef = useRef<number | null | undefined>(undefined);

  const resetHeartbeat = useCallback(() => {
    clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(() => {
      // No ping/message received from server in 35s → connection is dead
      const ws = wsRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(); // triggers onclose → reconnect
      }
    }, HEARTBEAT_TIMEOUT);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;
      socket = ws;

      ws.onopen = () => {
        const isReconnect = reconnectAttemptRef.current > 0;
        reconnectAttemptRef.current = 0;
        setWsConnected(true);
        resetHeartbeat();
        // Re-subscribe realtime MT5 quotes (fresh socket = fresh server-side subscriptions)
        const symbols = wantedMt5Symbols();
        if (symbols.length) ws.send(JSON.stringify({ type: 'mt5-subscribe', symbols }));
        useAppStore.getState().addLogEntry({
          type: 'info',
          message: isReconnect ? 'WebSocket reconnected' : 'WebSocket connected',
        });
      };

      ws.onclose = (event) => {
        clearTimeout(heartbeatTimerRef.current);
        setWsConnected(false);
        useMt5Live.setState({ live: false }); // quotes fall back to REST polling until we're back
        // Only log unexpected disconnects (code 1000 = normal closure)
        if (event.code !== 1000) {
          useAppStore.getState().addLogEntry({ type: 'alert', message: `WebSocket disconnected (code ${event.code})` });
        }
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        resetHeartbeat(); // any message = connection alive
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch {
          // ignore malformed messages (including ping frames parsed as text)
        }
      };
    } catch {
      scheduleReconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleReconnect = useCallback(() => {
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptRef.current),
      RECONNECT_MAX_DELAY,
    );
    reconnectAttemptRef.current++;
    reconnectTimerRef.current = setTimeout(() => connect(), delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMessage = useCallback(
    (msg: { type: string; data: any }) => {
      const addLog = useAppStore.getState().addLogEntry;

      switch (msg.type) {
        case 'ping':
          // Server heartbeat — just reset timer (already done above)
          break;
        case 'news': {
          queryClient.invalidateQueries({ queryKey: ['news'] });
          queryClient.invalidateQueries({ queryKey: ['map-events'] });

          // Trigger breaking news flash + add notification for new articles
          if (msg.data && msg.data.id) {
            const article = msg.data;
            const symbols = article.recommendations?.map((r: any) => r.symbol) || [];
            const title = (article.title || '').slice(0, 60);

            window.dispatchEvent(new CustomEvent('breaking-news', {
              detail: {
                id: article.id,
                title: article.title,
                titleTranslations: article.titleTranslations || null,
                sentiment: article.sentiment,
                symbols,
              }
            }));

            // Push to notification store
            useAppStore.getState().addNotification({
              id: article.id,
              title: article.title,
              titleTranslations: article.titleTranslations || null,
              sentiment: article.sentiment,
              symbols,
              time: new Date(),
            });

            addLog({ type: 'ws', message: `News — "${title}..."` });
          }
          break;
        }
        case 'mt5-quotes': {
          const batch = msg.data as Mt5Quote[];
          useMt5Live.setState((s) => ({ quotes: { ...s.quotes, ...Object.fromEntries(batch.map((q) => [q.symbol, q])) } }));
          break;
        }
        case 'mt5-feed':
          useMt5Live.setState({ live: !!msg.data?.live });
          break;
        case 'quotes':
          queryClient.invalidateQueries({ queryKey: ['stocks'] });
          addLog({ type: 'trade', message: 'Quote data refreshed' });
          break;
        case 'recommendation': {
          queryClient.invalidateQueries({ queryKey: ['recommendations'] });
          const sym = msg.data?.symbol || '';
          const act = msg.data?.action || '';
          addLog({ type: 'alert', message: `New signal — ${sym} ${act}` });
          break;
        }
        case 'calendar-release': {
          queryClient.invalidateQueries({ queryKey: ['calendar'] });
          const eventName = msg.data?.event || 'Economic data';
          addLog({ type: 'alert', message: `Calendar — ${eventName} released` });
          break;
        }
        case 'alert-triggered': {
          queryClient.invalidateQueries({ queryKey: ['alerts'] });
          const alertName = msg.data?.name || 'Alert';
          const alertMsg = msg.data?.message || '';
          addLog({ type: 'alert', message: `Alert — ${alertName}: ${alertMsg}` });
          useAppStore.getState().addNotification({
            id: Date.now(),
            title: `${alertName}: ${alertMsg}`,
            sentiment: null,
            symbols: msg.data?.symbol ? [msg.data.symbol] : [],
            time: new Date(),
          });
          break;
        }
      }
    },
    [queryClient],
  );

  // The socket authenticates from the JWT cookie at connect time — reconnect when the user logs in or out
  useEffect(() => {
    if (authLoading) return;
    if (lastUserRef.current !== undefined && lastUserRef.current !== userId) wsRef.current?.close(1000);
    lastUserRef.current = userId;
  }, [userId, authLoading]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      clearTimeout(heartbeatTimerRef.current);
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

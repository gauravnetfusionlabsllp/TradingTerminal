import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../stores/use-app-store';
import { API_URL } from '../api/client';
import { useAuthStore } from '../stores/use-auth-store';
import { useMt5Live, wantedMt5Symbols, applyTradeEvent, resyncTrades, type Mt5Quote } from '../api/hooks/use-mt5';
import { createQuoteThrottle } from '../lib/quote-throttle';
import { setSocket } from './socket';

function getWsUrl() {
  // Same server as the REST API (called directly, no dev proxy)
  if (API_URL) return `${API_URL.replace(/^http/, 'ws')}/ws`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const HEARTBEAT_TIMEOUT = 60_000; // must be > server's 25s ping interval (generous buffer)

// Settings → Display: throttle off = every batch hits the store on arrival; on = ≤1 store write per quoteThrottleMs
const queueQuotes = createQuoteThrottle<Mt5Quote>(
  (q) => useMt5Live.setState((s) => ({ quotes: { ...s.quotes, ...q } })),
  () => { const s = useAppStore.getState().settings; return s.quoteThrottle ? s.quoteThrottleMs : 0; },
);

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
      setSocket(ws);

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
        // Quotes and positions / orders / deals fall back to REST polling until we're back; the next
        // mt5-trade-feed { live: true } then counts as a gap and resyncs
        useMt5Live.setState({ live: false, trades: false });
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
        case 'mt5-quotes':
          queueQuotes(msg.data as Mt5Quote[]);
          break;
        case 'mt5-error':
          addLog({ type: 'alert', message: `Live prices — ${msg.data?.error ?? 'subscription refused'}` });
          break;
        case 'mt5-feed':
          useMt5Live.setState({ live: !!msg.data?.live });
          break;
        case 'mt5-trade':
          applyTradeEvent(queryClient, msg.data);
          break;
        case 'mt5-trade-feed': {
          const was = useMt5Live.getState().trades;
          const live = !!msg.data?.live;
          if (live === was) break;
          useMt5Live.setState({ trades: live });
          if (live) {
            resyncTrades(queryClient); // nothing is replayed: anything that happened while down is only in REST
            addLog({ type: 'info', message: 'Live trade updates on' });
          } else {
            addLog({ type: 'alert', message: 'Live trade updates off — refreshing positions every 5s' });
          }
          break;
        }
        case 'quotes':
          queryClient.invalidateQueries({ queryKey: ['stocks'] });
          addLog({ type: 'trade', message: 'Quote data refreshed' });
          break;
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

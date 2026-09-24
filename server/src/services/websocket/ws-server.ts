import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import { verifyJwt, type JwtPayload } from '../../lib/jwt.js';
import { allowedSymbols } from '../../routes/mt5.js';
import * as feed from '../market-feed.js';
import * as tradeFeed from '../trade-feed.js';

let wss: WebSocketServer;
let pingInterval: ReturnType<typeof setInterval> | undefined;
let flushInterval: ReturnType<typeof setInterval> | undefined;

const PING_INTERVAL = 20_000; // 20s — keep connection alive through NAT/proxies
const MAX_SYMBOLS_PER_CLIENT = 100;
// ponytail: 10ms conflation ≈ per-tick (FXCubic ticks on a ~100ms grid); the client throttles per user setting
const FLUSH_INTERVAL = 10;

interface Client {
  auth: JwtPayload | null;  // from the `token` cookie at upgrade; null = anonymous (public broadcasts only)
  symbols: Set<string>;     // realtime MT5 symbols this socket subscribed to
}
const clients = new Map<WebSocket, Client>();
const pending = new Map<string, feed.Quote>(); // latest quote per symbol since the last flush
// Trade events route by the JWT's MT5 login — a socket only ever receives its own account's events
const byLogin = new Map<number, Set<WebSocket>>();

function relayTradeEvent(event: string, login: number, data: unknown) {
  const sockets = byLogin.get(login);
  if (!sockets) return;
  const message = JSON.stringify({ type: 'mt5-trade', data: { event, data } }); // once, not per socket
  const now = Date.now() / 1000;
  for (const ws of sockets) {
    if (ws.readyState !== WebSocket.OPEN || clients.get(ws)!.auth!.exp < now) continue; // expired session: stop
    try {
      ws.send(message);
    } catch {
      // Connection may have closed between readyState check and send
    }
  }
}

function authFromCookie(req: IncomingMessage): JwtPayload | null {
  const token = req.headers.cookie?.match(/(?:^|;\s*)token=([^;]+)/)?.[1];
  return token ? verifyJwt(decodeURIComponent(token)) : null;
}

function sendTo(ws: WebSocket, type: string, data: unknown) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify({ type, data }));
  } catch {
    // Connection may have closed between readyState check and send
  }
}

async function handleClientMessage(ws: WebSocket, client: Client, raw: WebSocket.RawData) {
  let msg: any;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (msg?.type !== 'mt5-subscribe' && msg?.type !== 'mt5-unsubscribe') return;
  const requested: string[] = Array.isArray(msg.symbols)
    ? msg.symbols.filter((s: unknown): s is string => typeof s === 'string').slice(0, MAX_SYMBOLS_PER_CLIENT)
    : [];

  if (msg.type === 'mt5-unsubscribe') {
    for (const s of requested) {
      if (client.symbols.delete(s)) feed.release(s);
    }
    return;
  }

  const auth = client.auth;
  if (!auth || auth.exp < Date.now() / 1000) {
    return sendTo(ws, 'mt5-error', { error: 'Authentication required' });
  }
  let allowed: Set<string>;
  try {
    allowed = new Set((await allowedSymbols(auth.login)).map((s) => s.symbol));
  } catch {
    return sendTo(ws, 'mt5-error', { error: 'Trading server unavailable' });
  }
  if (!clients.has(ws)) return; // closed while we waited on the bridge

  const cached: feed.Quote[] = [];
  for (const s of requested) {
    if (!allowed.has(s) || client.symbols.has(s) || client.symbols.size >= MAX_SYMBOLS_PER_CLIENT) continue;
    client.symbols.add(s);
    feed.acquire(s);
    const q = feed.lastQuote(s);
    if (q) cached.push(q);
  }
  if (cached.length) sendTo(ws, 'mt5-quotes', cached);
}

function flushQuotes() {
  if (!pending.size) return;
  for (const [ws, client] of clients) {
    if (!client.symbols.size) continue;
    const batch: feed.Quote[] = [];
    for (const s of client.symbols) {
      const q = pending.get(s);
      if (q) batch.push(q);
    }
    if (batch.length) sendTo(ws, 'mt5-quotes', batch);
  }
  pending.clear();
}

export function startWebSocketServer(server: Server) {
  try {
    wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: 64 * 1024,
      perMessageDeflate: {
        zlibDeflateOptions: { level: 3 }, // Fast compression (good ratio for JSON)
        threshold: 1024, // Only compress messages > 1KB
      },
    });

    feed.setHandlers({
      onQuote: (q) => pending.set(q.symbol, q),
      onStatus: (live) => broadcast('mt5-feed', { live }),
    });
    tradeFeed.setHandlers({
      onEvent: relayTradeEvent,
      onStatus: (live) => broadcast('mt5-trade-feed', { live }),
    });

    wss.on('connection', (ws, req) => {
      const client: Client = { auth: authFromCookie(req), symbols: new Set() };
      clients.set(ws, client);
      console.log(`[WS] Client connected${client.auth ? ` (MT5 #${client.auth.login})` : ''}`);
      const login = client.auth?.login;
      if (login) {
        const sockets = byLogin.get(login) ?? new Set();
        byLogin.set(login, sockets.add(ws));
        tradeFeed.acquire(login); // first socket for this login joins its hub group
      }
      (ws as any).isAlive = true;

      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

      ws.on('message', (raw) => {
        handleClientMessage(ws, client, raw).catch((err) => console.error('[WS] message error:', err?.message));
      });

      ws.on('close', () => {
        for (const s of client.symbols) feed.release(s);
        if (login) {
          const sockets = byLogin.get(login);
          sockets?.delete(ws);
          if (!sockets?.size) byLogin.delete(login);
          tradeFeed.release(login); // last socket leaves the hub group
        }
        clients.delete(ws);
        console.log('[WS] Client disconnected');
      });

      sendTo(ws, 'mt5-feed', { live: feed.isLive() });
      if (login) sendTo(ws, 'mt5-trade-feed', { live: tradeFeed.isLive() });
    });

    wss.on('error', (err: Error) => {
      console.error('[WS] Server error:', err.message);
    });

    // Heartbeat: ping all clients, terminate dead ones
    pingInterval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          return ws.terminate(); // dead connection, clean up
        }
        (ws as any).isAlive = false;
        ws.ping(); // Binary ping is sufficient — no redundant text message
      });
    }, PING_INTERVAL);
    flushInterval = setInterval(flushQuotes, FLUSH_INTERVAL);

    wss.on('close', () => {
      clearInterval(pingInterval);
      clearInterval(flushInterval);
    });

    console.log('[WS] WebSocket server attached to HTTP server on /ws');
    return wss;
  } catch (err) {
    console.error('[WS] Failed to start WebSocket server:', err);
    return null;
  }
}

function broadcast(type: string, data: unknown) {
  if (!wss) return;
  const message = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch {
        // Connection may have closed between readyState check and send
      }
    }
  });
}

export function broadcastQuotes(quotes: unknown[]) {
  broadcast('quotes', quotes);
}

export function broadcastCalendarRelease(event: unknown) {
  broadcast('calendar-release', event);
}

export function broadcastAlertTriggered(alert: unknown) {
  broadcast('alert-triggered', alert);
}

export function getClientCount(): number {
  return wss ? wss.clients.size : 0;
}

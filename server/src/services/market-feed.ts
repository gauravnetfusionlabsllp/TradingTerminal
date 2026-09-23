import WebSocket from 'ws';
import { env } from '../config/env.js';

/**
 * Single upstream client of the Python FXCubic FIX bridge (D:\apps\MarketData, ws_server.py).
 * Browsers never talk to it directly: ws-server.ts acquires/releases symbols here and
 * we keep one upstream subscription per symbol, however many browsers want it.
 */

export interface Quote { symbol: string; bid: number; ask: number; ts: number } // ts = epoch ms the bridge received it

// Bridge stamps snapshots with FIX UTCTimestamp (YYYYMMDD-HH:MM:SS.sss). Its replayed cache can be weeks old.
function fixTime(s: string): number {
  const m = /^(\d{4})(\d\d)(\d\d)-(\d\d):(\d\d):(\d\d)(?:\.(\d{3}))?/.exec(s ?? '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] ?? 0)) : Date.now();
}

interface Handlers { onQuote(q: Quote): void; onStatus(live: boolean): void }

let socket: WebSocket | null = null;
let handlers: Handlers = { onQuote() {}, onStatus() {} };
let live = false;
let stopped = false;
let attempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
const counts = new Map<string, number>();
const last = new Map<string, Quote>();

export const setHandlers = (h: Handlers) => { handlers = h; };
export const isLive = () => live;
export const lastQuote = (symbol: string) => last.get(symbol);

function setLive(value: boolean) {
  if (live === value) return;
  live = value;
  console.log(`[MarketFeed] ${value ? 'live' : 'down'}`);
  handlers.onStatus(value);
}

function send(action: 'subscribe' | 'unsubscribe', symbols: string[]) {
  if (symbols.length && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action, symbols }));
  }
}

export function acquire(symbol: string) {
  const n = counts.get(symbol) ?? 0;
  counts.set(symbol, n + 1);
  if (n === 0) send('subscribe', [symbol]);
}

export function release(symbol: string) {
  const n = counts.get(symbol) ?? 0;
  if (n <= 1) {
    counts.delete(symbol);
    last.delete(symbol); // bridge replays its own cached snapshot on the next subscribe
    if (n === 1) send('unsubscribe', [symbol]);
  } else {
    counts.set(symbol, n - 1);
  }
}

function handleMessage(raw: WebSocket.RawData) {
  let msg: any;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }

  if (msg.type === 'snapshot' && counts.has(msg.symbol)) {
    // Snapshots may carry one side only — merge onto the previous quote
    const prev = last.get(msg.symbol);
    const bid = msg.entries?.find((e: any) => e.type === 'bid')?.price ?? prev?.bid;
    const ask = msg.entries?.find((e: any) => e.type === 'ask')?.price ?? prev?.ask;
    if (typeof bid !== 'number' || typeof ask !== 'number') return;
    const q: Quote = { symbol: msg.symbol, bid, ask, ts: fixTime(msg.ts) };
    last.set(q.symbol, q);
    handlers.onQuote(q);
  } else if (msg.type === 'status') {
    // Bridge only broadcasts status on change; md_reject is broadcast for every bridge client's symbols
    if (msg.state === 'logged_on') setLive(true);
    else if (msg.state === 'disconnected') setLive(false);
    else if (msg.state === 'md_reject' && counts.has(msg.symbol)) {
      console.warn(`[MarketFeed] ${msg.symbol} rejected upstream: ${msg.reason} ${msg.text ?? ''}`);
    }
  } else if (msg.type === 'error') {
    console.warn('[MarketFeed] bridge error:', msg.message);
  }
}

function connect() {
  const ws = new WebSocket(env.MARKET_FEED_URL, { handshakeTimeout: 10_000 });
  socket = ws;

  ws.on('open', () => {
    attempt = 0;
    console.log(`[MarketFeed] connected to ${env.MARKET_FEED_URL}`);
    setLive(true); // bridge sends no status on connect; assume its FIX session is up until told otherwise
    send('subscribe', [...counts.keys()]);
  });
  ws.on('message', handleMessage);
  ws.on('error', (err) => console.warn('[MarketFeed] socket error:', err.message));
  ws.on('close', () => {
    socket = null;
    setLive(false);
    if (stopped) return;
    const delay = Math.min(1000 * 2 ** attempt++, 30_000);
    reconnectTimer = setTimeout(connect, delay);
  });
}

export function startMarketFeed() {
  if (!env.MARKET_FEED_URL) {
    console.log('[MarketFeed] MARKET_FEED_URL not set — realtime quotes disabled (REST polling only)');
    return;
  }
  stopped = false;
  connect();
}

export function stopMarketFeed() {
  stopped = true;
  clearTimeout(reconnectTimer);
  socket?.close();
}

import WebSocket from 'ws';
import { env } from '../config/env.js';

/**
 * Single upstream client of the MT5 bridge's SignalR hub (/hubs/trade): position, deal and order events.
 * Joins one hub group per MT5 login that has a browser connected (SubscribeAccount), so the bridge only ever
 * sends events for those accounts. Never SubscribeAll — that streams every account the manager can see.
 *
 * ponytail: hand-rolled subset of the SignalR JSON protocol (handshake, invocations, ping, close) over ws with
 * negotiate skipped (allowed for WebSocket-only clients). Swap for @microsoft/signalr if we ever need streaming,
 * MessagePack or non-WebSocket transports.
 */

const RS = '\x1e'; // SignalR record separator
const PING_MS = 15_000; // server times a client out after 30s of silence
const SILENCE_MS = 35_000; // server keepalive is 15s: this long with nothing = dead link
const EVENTS = new Set([
  'PositionAdded', 'PositionUpdated', 'PositionDeleted',
  'DealAdded', 'DealUpdated', 'DealDeleted',
  'OrderAdded', 'OrderUpdated', 'OrderDeleted',
]);

interface Handlers { onEvent(event: string, login: number, data: unknown): void; onStatus(live: boolean): void }

let socket: WebSocket | null = null;
let handlers: Handlers = { onEvent() {}, onStatus() {} };
let live = false; // handshake done: events flow and invocations are accepted
let stopped = false;
let attempt = 0;
let invocationId = 0;
let lastSeen = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;
const counts = new Map<number, number>(); // login → browser sockets wanting it

export const setHandlers = (h: Handlers) => { handlers = h; };
export const isLive = () => live;

function setLive(value: boolean) {
  if (live === value) return;
  live = value;
  console.log(`[TradeFeed] ${value ? 'live' : 'down'}`);
  handlers.onStatus(value);
}

const send = (msg: object) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg) + RS);
};

function invoke(target: 'SubscribeAccount' | 'UnsubscribeAccount', login: number) {
  if (live) send({ type: 1, invocationId: String(++invocationId), target, arguments: [login] });
}

export function acquire(login: number) {
  const n = counts.get(login) ?? 0;
  counts.set(login, n + 1);
  if (n === 0) invoke('SubscribeAccount', login);
}

export function release(login: number) {
  const n = counts.get(login) ?? 0;
  if (n <= 1) {
    counts.delete(login);
    if (n === 1) invoke('UnsubscribeAccount', login);
  } else {
    counts.set(login, n - 1);
  }
}

function handleRecord(msg: any) {
  if (!live) {
    // First record is the handshake reply: {} or { error }
    if (msg.error) {
      console.warn('[TradeFeed] handshake refused:', msg.error);
      return socket?.close();
    }
    attempt = 0;
    setLive(true);
    for (const login of counts.keys()) invoke('SubscribeAccount', login);
    return;
  }
  switch (msg.type) {
    case 1: { // invocation = an event
      const data = msg.arguments?.[0];
      const login = Number(data?.login);
      // Groups already filter at the bridge; this drops stragglers that raced an UnsubscribeAccount
      if (EVENTS.has(msg.target) && counts.has(login)) handlers.onEvent(msg.target, login, data);
      break;
    }
    case 3: // completion of our Subscribe/Unsubscribe
      if (msg.error) console.warn(`[TradeFeed] invocation ${msg.invocationId} failed:`, msg.error);
      break;
    case 7: // server closing
      console.warn('[TradeFeed] hub closed the connection', msg.error ?? '');
      socket?.close();
      break;
  }
}

function connect() {
  const url = `${env.MT5_BRIDGE_URL.replace(/^http/, 'ws')}/hubs/trade`;
  const ws = new WebSocket(url, { headers: { 'X-API-Key': env.MT5_BRIDGE_API_KEY }, handshakeTimeout: 10_000 });
  socket = ws;

  ws.on('open', () => {
    console.log(`[TradeFeed] connected to ${url}`);
    lastSeen = Date.now();
    ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RS);
    pingTimer = setInterval(() => {
      if (Date.now() - lastSeen > SILENCE_MS) return ws.terminate();
      send({ type: 6 });
    }, PING_MS);
  });
  ws.on('message', (raw) => {
    lastSeen = Date.now();
    // One WebSocket message carries one or more complete records
    for (const rec of raw.toString().split(RS)) {
      if (!rec) continue;
      try {
        handleRecord(JSON.parse(rec));
      } catch (err: any) {
        console.warn('[TradeFeed] bad record:', err?.message);
      }
    }
  });
  ws.on('error', (err) => console.warn('[TradeFeed] socket error:', err.message)); // a refused key reads "Unexpected server response: 403"
  ws.on('close', () => {
    clearInterval(pingTimer);
    socket = null;
    setLive(false); // group memberships die with the connection; re-subscribed after the next handshake
    if (stopped) return;
    const delay = Math.min(1000 * 2 ** attempt++, 30_000);
    reconnectTimer = setTimeout(connect, delay);
  });
}

export function startTradeFeed() {
  stopped = false;
  connect();
}

export function stopTradeFeed() {
  stopped = true;
  clearTimeout(reconnectTimer);
  socket?.close();
}

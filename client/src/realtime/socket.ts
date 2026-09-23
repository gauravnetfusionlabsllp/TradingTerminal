// The one app-wide /ws socket, so hooks elsewhere (MT5 quote subscriptions) can send on it.
// Its own module so use-mt5.ts needn't import use-ws.ts: that cycle made a hot update of use-ws.ts re-run use-mt5.ts too,
// handing the page a fresh quotes store (live:false, nothing subscribed) until a manual reload.
let socket: WebSocket | null = null;

export const setSocket = (ws: WebSocket | null) => { socket = ws; };

export function sendWs(msg: object) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

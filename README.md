# SGFX Terminal

Web trading terminal for SGFX MT5 accounts: log in with an MT5 login, watch live prices, chart, and trade. It also has a drag-and-drop panel layout with market-data panels.

## Requirements

- Node.js 20+
- **MT5 bridge** (`MT5_BRIDGE_URL`, default `http://localhost:5050`): verifies logins and handles trading, positions, orders, symbols and chart bars.
- **Market feed** (`MARKET_FEED_URL`, default `ws://localhost:8765`): the FIX price bridge WebSocket that streams live quotes. If it's empty, the terminal falls back to REST polling.

## Setup

```bash
npm install
cp .env.example .env        # fill in MT5_BRIDGE_API_KEY and JWT_SECRET
cd server && npx prisma migrate deploy && cd ..
npm run dev
```

Frontend: `http://localhost:5174` · API: `http://localhost:3001`

Production: `npm run build && npm start`. The server also serves the built client. Set `NODE_ENV=production`, `JWT_SECRET`, `MT5_BRIDGE_API_KEY` and `ALLOWED_ORIGINS`.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file (users, alerts, calendar cache) |
| `PORT` | API port |
| `MT5_BRIDGE_URL`, `MT5_BRIDGE_API_KEY` | MT5 bridge (required) |
| `MARKET_FEED_URL` | Realtime price WebSocket |
| `JWT_SECRET` | Session signing (required in production) |
| `ALLOWED_ORIGINS` | CORS allowlist (production) |
| `VITE_API_URL` | Only if the client calls an API on another host |
| `GCS_BUCKET`, `GCS_BACKUP_INTERVAL_MINUTES` | Optional SQLite backup to Google Cloud Storage |

## Layout

```
client/   React 19 + Vite + Tailwind; panels in src/components/panels, MT5 hooks in src/api/hooks/use-mt5.ts
server/   Express 5 + Prisma (SQLite); MT5 bridge client in src/routes/mt5.ts, live feed in src/services/market-feed.ts
```

## License

Business Source License 1.1. See [LICENSE](LICENSE).

Trading forex and CFDs carries a high level of risk. Market data in this terminal is for information only and is not investment advice.

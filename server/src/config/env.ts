import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().default('file:./prisma/prod.db'),
  PORT: z.coerce.number().default(8080),

  // CORS — comma-separated allowed origins for production
  ALLOWED_ORIGINS: z.string().default(''),

  // GCS backup (optional)
  GCS_BUCKET: z.string().default(''),
  GCS_BACKUP_INTERVAL_MINUTES: z.coerce.number().default(5),

  // MT5 bridge (login verification + trading) and JWT signing
  MT5_BRIDGE_URL: z.string().default('http://localhost:5050'),
  MT5_BRIDGE_API_KEY: z.string().default(''),
  JWT_SECRET: z.string().default(''),

  // Realtime prices: the Python FXCubic FIX bridge's WebSocket (empty = disabled, REST polling only)
  MARKET_FEED_URL: z.string().default('ws://localhost:8765'),
});

export const env = envSchema.parse(process.env);

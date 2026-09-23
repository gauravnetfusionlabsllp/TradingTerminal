import crypto from 'crypto';
import { env } from '../config/env.js';

// Dev fallback: random per-process secret (tokens die on restart). index.ts refuses to start without JWT_SECRET in production.
const SECRET = env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export interface JwtPayload {
  sub: number;   // User.id
  login: number; // MT5 login
  ro: boolean;   // investor (read-only) session
  iat: number;
  exp: number;
}

function sign(data: string) {
  return crypto.createHmac('sha256', SECRET).update(data).digest();
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, ttlSec: number): string {
  const iat = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat, exp: iat + ttlSec })).toString('base64url');
  return `${HEADER}.${body}.${sign(`${HEADER}.${body}`).toString('base64url')}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  const [header, body, sig] = token.split('.');
  // Only our exact HS256 header is accepted — rules out alg:none / algorithm confusion
  if (header !== HEADER || !body || !sig) return null;
  const expected = sign(`${header}.${body}`);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload;
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

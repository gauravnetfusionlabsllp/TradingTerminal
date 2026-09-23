import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { decrypt, isEncrypted } from '../lib/crypto.js';
import { verifyJwt } from '../lib/jwt.js';

export interface AuthUser {
  id: number;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  plan: string;
  planExpiresAt: Date | null;
  alpacaApiKey: string | null;
  alpacaSecretKey: string | null;
  alpacaPaper: boolean;
  mt5Login: number;
  readOnly: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Global middleware: reads JWT (`token` cookie or `Authorization: Bearer`) → verifies → loads user → attaches req.user
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    const token = req.cookies?.token || (auth?.startsWith('Bearer ') ? auth.slice(7) : undefined);
    if (!token) return next();

    const claims = verifyJwt(token);
    if (!claims) return next();

    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    // Token must still match the account it was issued for
    if (!user || user.mt5Login !== String(claims.login)) return next();

    // Decrypt Alpaca credentials if they exist and are encrypted
    let alpacaApiKey = user.alpacaApiKey;
    let alpacaSecretKey = user.alpacaSecretKey;
    try {
      if (alpacaApiKey && isEncrypted(alpacaApiKey)) alpacaApiKey = decrypt(alpacaApiKey);
      if (alpacaSecretKey && isEncrypted(alpacaSecretKey)) alpacaSecretKey = decrypt(alpacaSecretKey);
    } catch {
      // If decryption fails, treat as no credentials
      alpacaApiKey = null;
      alpacaSecretKey = null;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      alpacaApiKey,
      alpacaSecretKey,
      alpacaPaper: user.alpacaPaper,
      mt5Login: claims.login,
      readOnly: claims.ro,
    };
  } catch (err) {
    console.error('[Auth] Session lookup failed:', (err as any)?.code || (err as any)?.message);
  }
  next();
}

/**
 * Route-level middleware: 401 if not logged in
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Route-level middleware: 401 if not logged in, 403 for investor (read-only) sessions
 */
export function requireTrader(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.readOnly) {
    res.status(403).json({ error: 'Read-only (investor) session' });
    return;
  }
  next();
}

/**
 * Route-level middleware: 401/403 if not logged in or not Pro
 */
export function requirePro(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const isPro = req.user.plan === 'pro' &&
    (!req.user.planExpiresAt || req.user.planExpiresAt > new Date());
  if (!isPro) {
    res.status(403).json({ error: 'Pro subscription required' });
    return;
  }
  next();
}

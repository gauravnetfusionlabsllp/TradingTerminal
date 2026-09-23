import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signJwt } from '../lib/jwt.js';
import { requireAuth, type AuthUser } from '../middleware/auth.js';
import { bridge } from './mt5.js';

const router = Router();

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many export requests, please try again later' },
});

// Brute-force protection: track failed login attempts per IP
const verifyAttempts = new Map<string, { count: number; resetAt: number }>();
const VERIFY_MAX_ATTEMPTS = 5;
const VERIFY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isVerifyBlocked(ip: string): boolean {
  const entry = verifyAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    verifyAttempts.delete(ip);
    return false;
  }
  return entry.count >= VERIFY_MAX_ATTEMPTS;
}

function recordVerifyAttempt(ip: string) {
  const entry = verifyAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    verifyAttempts.set(ip, { count: 1, resetAt: Date.now() + VERIFY_WINDOW_MS });
  } else {
    entry.count++;
  }
}

function clearVerifyAttempts(ip: string) {
  verifyAttempts.delete(ip);
}

// Periodic cleanup of expired entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of verifyAttempts) {
    if (now > entry.resetAt) verifyAttempts.delete(ip);
  }
}, VERIFY_WINDOW_MS);
const TOKEN_TTL_SEC = 12 * 60 * 60; // 12h, then the client re-prompts for MT5 login
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: TOKEN_TTL_SEC * 1000,
  path: '/',
};

function publicUser(u: AuthUser) {
  return {
    id: u.id,
    name: u.name,
    mt5Login: u.mt5Login,
    readOnly: u.readOnly,
  };
}

const LoginBody = z.object({
  login: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  password: z.string().min(1).max(64),
  investor: z.boolean().default(false),
});

interface VerifyResult { valid: boolean; reason: string; name: string | null }

// Bridge verify reasons worth telling the user; everything else (incl. ACCOUNT_NOT_FOUND) is a generic 401
const REJECTIONS: Record<string, [number, string]> = {
  ACCOUNT_DISABLED: [403, 'This MT5 account is disabled'],
  PASSWORD_RESET_REQUIRED: [403, 'Password change required — change it in your MT5 terminal first'],
  TOO_FREQUENT: [429, 'Too many attempts, please wait a minute'],
};

// POST /api/auth/login — MT5 login + password (main or investor) verified by the bridge → JWT
router.post('/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (isVerifyBlocked(ip)) {
    return res.status(429).json({ error: 'Too many failed logins, please try again later' });
  }

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'MT5 login and password required' });
  }
  const { login, password, investor } = parsed.data;

  let result: VerifyResult;
  try {
    result = await bridge<VerifyResult>('/api/account/verify', {
      login,
      password,
      passwordType: investor ? 'INVESTOR' : 'MAIN',
    });
  } catch {
    return res.status(503).json({ error: 'Trading server unavailable, please try again' });
  }

  if (!result.valid) {
    recordVerifyAttempt(ip);
    const [status, error] = REJECTIONS[result.reason] ?? [401, 'Invalid login or password'];
    return res.status(status).json({ error });
  }
  clearVerifyAttempts(ip);

  try {
    const user = await prisma.user.upsert({
      where: { mt5Login: String(login) },
      update: { name: result.name ?? undefined },
      create: { mt5Login: String(login), name: result.name },
    });
    const token = signJwt({ sub: user.id, login, ro: investor }, TOKEN_TTL_SEC);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: publicUser({ ...user, mt5Login: login, readOnly: investor }), token });
  } catch (err: any) {
    console.error('[Auth] MT5 login error:', err?.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me — Current user info
router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

// POST /api/auth/logout
// ponytail: stateless JWT — logout only clears the cookie; add a User.tokenVersion claim if server-side revocation is needed
router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

// GET /api/auth/me/export — Export all user data (GDPR data portability)
router.get('/me/export', exportLimiter, requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [user, alerts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, mt5Login: true, name: true, createdAt: true, updatedAt: true },
      }),
      prisma.alert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      user,
      alerts,
    });
  } catch (err: any) {
    console.error('[Auth] Data export error:', err?.message);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// DELETE /api/auth/me — Delete account and all associated data (GDPR right to erasure)
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Delete all user data in a transaction
    await prisma.$transaction([
      prisma.alertTrigger.deleteMany({
        where: { alert: { userId } },
      }),
      prisma.alert.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.clearCookie('token', { path: '/' });
    res.json({ ok: true, message: 'Account deleted' });
  } catch (err: any) {
    console.error('[Auth] Account deletion error:', err?.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;

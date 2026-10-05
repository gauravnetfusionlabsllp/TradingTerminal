import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { syncAlerts } from '../services/alerts/alert-evaluator.js';
import { conditionMet } from '../services/alerts/alert-types.js';
import { allowedSymbols, currentTick, HttpError } from './mt5.js';

const router = Router();

// All alerts routes require authentication
router.use(requireAuth);

const name = z.string().trim().min(1, 'Name is required').max(200);
const symbol = z.string().min(1, 'Pick a symbol').max(32);
// The server builds Alert.condition JSON from these fields — clients never send raw JSON
const createAlertSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('price_cross'), name, symbol, direction: z.enum(['above', 'below']), price: z.number().positive('Price must be greater than 0') }),
  z.object({ type: z.literal('price_change_pct'), name, symbol, pct: z.number().positive('Change % must be greater than 0').max(100, 'Change % must be at most 100') }),
]);

const updateAlertSchema = z.object({ enabled: z.boolean() });

const zodError = (e: z.ZodError) => {
  const issue = e.issues[0];
  return issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request';
};

function sendError(res: Response, err: unknown, what: string) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(`[Alerts] Failed to ${what} alert:`, err);
  res.status(500).json({ error: `Failed to ${what} alert` });
}

/** Checks the symbol against the account's MT5 list and snapshots the live bid into the condition. */
async function arm(login: number, type: string, sym: string, condition: any) {
  if (!(await allowedSymbols(login)).some((s) => s.symbol === sym)) {
    throw new HttpError(400, `${sym} is not available on this account`);
  }
  const bid = (await currentTick(sym).catch(() => null))?.bid ?? 0;
  if (!(bid > 0)) throw new HttpError(400, `No live price for ${sym}`);
  if (type === 'price_change_pct') return { ...condition, basePrice: bid };
  if (conditionMet(type, condition, bid)) {
    throw new HttpError(400, `${sym} bid is already ${condition.direction} ${condition.price} (now ${bid})`);
  }
  return condition;
}

// GET /api/alerts - list user's alerts with trigger count
router.get('/', async (req, res) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { userId: req.user!.id },
      include: {
        _count: { select: { triggers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = alerts.map(alert => ({
      ...alert,
      triggerCount: alert._count.triggers,
      _count: undefined,
    }));

    res.json(result);
  } catch (err) {
    console.error('[Alerts] Error fetching alerts:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/alerts - create alert
router.post('/', async (req, res) => {
  const parsed = createAlertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodError(parsed.error) });
    return;
  }
  const { type, name, symbol, ...fields } = parsed.data; // fields: {direction, price} | {pct}

  try {
    const condition = await arm(req.user!.mt5Login, type, symbol, fields);
    const alert = await prisma.alert.create({
      data: { userId: req.user!.id, name, type, symbol, condition: JSON.stringify(condition) },
    });

    syncAlerts();
    res.status(201).json(alert);
  } catch (err) {
    sendError(res, err, 'create');
  }
});

// PUT /api/alerts/:id - enable/disable. Re-enabling re-arms against the current bid.
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid alert ID' });
    return;
  }

  const parsed = updateAlertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodError(parsed.error) });
    return;
  }

  try {
    const existing = await prisma.alert.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    if (existing.userId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const data: { enabled: boolean; condition?: string } = { enabled: parsed.data.enabled };
    if (data.enabled && !existing.enabled && existing.symbol) {
      data.condition = JSON.stringify(await arm(req.user!.mt5Login, existing.type, existing.symbol, JSON.parse(existing.condition)));
    }
    const alert = await prisma.alert.update({ where: { id }, data });

    syncAlerts();
    res.json(alert);
  } catch (err) {
    sendError(res, err, 'update');
  }
});

// DELETE /api/alerts/:id - delete alert
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid alert ID' });
      return;
    }

    const existing = await prisma.alert.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    if (existing.userId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await prisma.alert.delete({ where: { id } });

    syncAlerts();
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    console.error('[Alerts] Error deleting alert:', err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;

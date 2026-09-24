import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from './mt5.js';

// Dock layouts per user. Built-in presets live in the client; a row with `preset` stores the user's
// edited copy of one (delete it = reset). Rows with preset = null are user-created workspaces.

const MAX_CUSTOM = 20;
const MAX_LAYOUT_BYTES = 64 * 1024;

const layoutSchema = z
  .object({ layout: z.object({ type: z.literal('row') }).passthrough() })
  .passthrough()
  .transform((v, ctx) => {
    const json = JSON.stringify(v);
    if (json.length > MAX_LAYOUT_BYTES) ctx.addIssue({ code: 'custom', message: 'Layout too large' });
    return json;
  });
const nameSchema = z.string().trim().min(1).max(40);
const createSchema = z.object({ name: nameSchema, layout: layoutSchema });
const updateSchema = z.object({ name: nameSchema.optional(), layout: layoutSchema.optional() });
const presetSchema = z.string().regex(/^[a-z]{1,20}$/);

type Row = { id: number; preset: string | null; name: string; layout: string; updatedAt: Date };
const out = (w: Row) => ({ id: w.id, preset: w.preset, name: w.name, layout: JSON.parse(w.layout), updatedAt: w.updatedAt });

async function owned(req: Request) {
  const id = Number(req.params.id);
  const w = Number.isInteger(id) ? await prisma.workspace.findUnique({ where: { id } }) : null;
  if (!w) throw new HttpError(404, 'Workspace not found');
  if (w.userId !== req.user!.id) throw new HttpError(403, 'Forbidden');
  return w;
}

const router = Router();
router.use(requireAuth); // investor (read-only) logins may keep layouts too

const h = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response) => {
  try {
    res.status(status).json(await fn(req));
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (err instanceof z.ZodError) {
      const issue = err.issues[0];
      res.status(400).json({ error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request' });
    } else {
      console.error('[Workspaces]', (err as Error)?.message);
      res.status(500).json({ error: 'Internal error' });
    }
  }
};

router.get('/', h(async (req) => {
  const rows = await prisma.workspace.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'asc' } });
  return rows.map(out);
}));

router.post('/', h(async (req) => {
  const { name, layout } = createSchema.parse(req.body);
  const userId = req.user!.id;
  const count = await prisma.workspace.count({ where: { userId, preset: null } });
  if (count >= MAX_CUSTOM) throw new HttpError(400, `Workspace limit reached (${MAX_CUSTOM})`);
  return out(await prisma.workspace.create({ data: { userId, name, layout } }));
}, 201));

router.put('/preset/:preset', h(async (req) => {
  const preset = presetSchema.parse(req.params.preset);
  const layout = layoutSchema.parse(req.body?.layout);
  const userId = req.user!.id;
  return out(await prisma.workspace.upsert({
    where: { userId_preset: { userId, preset } },
    create: { userId, preset, name: preset, layout },
    update: { layout },
  }));
}));

router.put('/:id', h(async (req) => {
  const data = updateSchema.parse(req.body);
  const w = await owned(req);
  if (data.name && w.preset) throw new HttpError(400, 'Built-in workspaces cannot be renamed');
  return out(await prisma.workspace.update({ where: { id: w.id }, data }));
}));

// Deletes a custom workspace, or resets a preset to the shipped layout
router.delete('/:id', h(async (req) => {
  const w = await owned(req);
  await prisma.workspace.delete({ where: { id: w.id } });
  return { ok: true };
}));

export default router;

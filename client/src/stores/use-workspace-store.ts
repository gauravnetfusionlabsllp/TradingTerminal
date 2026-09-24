import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { IJsonModel } from 'flexlayout-react';
import { api } from '../api/client';
import { useAuthStore } from './use-auth-store';
import { PRESETS, presetLayout, type PresetId } from '../components/layout/presets';
import type { TranslationKey } from '../i18n/translations';

// Dock workspaces. Kept per owner ('guest' or MT5 login) in this browser, like watchlists; for a logged-in
// owner the server (/api/workspaces) is the source of truth and this is its cache. Active workspace is per device.

export interface Workspace {
  key: string;         // preset id | 's:<serverId>' | 'l:<uuid>' — stable on this device
  preset?: PresetId;
  name: string;        // custom workspaces only; presets are named by translation
  layout?: IJsonModel; // preset without layout = untouched, renders the shipped one
  id?: number;         // server row
  dirty?: boolean;     // local change the server hasn't confirmed yet
}
export interface ServerWorkspace { id: number; preset: string | null; name: string; layout: IJsonModel }
interface Space { list: Workspace[]; active: string }

export const GUEST = 'guest';
export const MAX_CUSTOM = 20; // mirrors the server cap
const OLD_KEYS = ['terminal-layout', 'terminal-layout-version', 'terminal-layout-reset'];

export const layoutOf = (w: Workspace): IJsonModel => w.layout ?? presetLayout(w.preset!);
export const isModified = (w: Workspace) => !!w.preset && !!w.layout;
export const wsLabel = (w: Workspace, t: (k: TranslationKey) => string) =>
  w.preset ? t(PRESETS.find((p) => p.id === w.preset)!.nameKey) : w.name;
const fresh = (): Space => ({ list: PRESETS.map((p) => ({ key: p.id, preset: p.id, name: p.id })), active: 'trade' });

/** Server rows win; local edits the server hasn't seen (dirty, or never uploaded) win over them and get pushed. */
export function reconcile(local: Workspace[], rows: ServerWorkspace[]): Workspace[] {
  const presets = PRESETS.map(({ id }): Workspace => {
    const mine = local.find((w) => w.preset === id);
    const row = rows.find((r) => r.preset === id);
    if (mine?.dirty) return { ...mine, id: row?.id };
    return row ? { key: id, preset: id, name: id, layout: row.layout, id: row.id } : { key: id, preset: id, name: id };
  });
  const customs = rows.filter((r) => !r.preset).map((r): Workspace => {
    const mine = local.find((w) => !w.preset && w.id === r.id);
    return mine?.dirty ? mine : { key: mine?.key ?? `s:${r.id}`, name: r.name, layout: r.layout, id: r.id };
  });
  const unsynced = local.filter((w) => !w.preset && w.id == null).map((w) => ({ ...w, dirty: true }));
  return [...presets, ...customs, ...unsynced];
}

/** What a first login uploads from the guest's workspaces: edited presets and customs */
export const importable = (guest: Workspace[]): Workspace[] =>
  guest.map((w) => (w.preset && !w.layout ? w : { ...w, id: undefined, dirty: true }));

/** Guest layout from before workspaces existed becomes the guest's Trade */
function initialGuest(): Space {
  const s = fresh();
  try {
    const old = localStorage.getItem(OLD_KEYS[0]);
    if (old && localStorage.getItem(OLD_KEYS[1]) === '36') s.list[0].layout = JSON.parse(old);
  } catch { /* no storage / corrupt: start fresh */ }
  return s;
}

interface WorkspaceState {
  owner: string;
  byOwner: Record<string, Space>;
  rev: number; // bumped when the active layout is replaced underneath the dock (sync, reset) → remount
  setOwner: (owner: string) => void;
  switchTo: (key: string) => void;
  saveLayout: (layout: IJsonModel, selectionOnly: boolean) => void;
  create: (name: string, layout: IJsonModel) => void;
  rename: (key: string, name: string) => void;
  reset: (key: string) => void;
  remove: (key: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => {
      const space = () => get().byOwner[get().owner] ?? fresh();
      const put = (owner: string, s: Space, bump = false) =>
        set((st) => ({ byOwner: { ...st.byOwner, [owner]: s }, rev: bump ? st.rev + 1 : st.rev }));
      const patch = (key: string, p: Partial<Workspace>, bump = false) => {
        const { owner } = get();
        const s = space();
        put(owner, { ...s, list: s.list.map((w) => (w.key === key ? { ...w, ...p, dirty: true } : w)) }, bump);
        schedule(owner, key);
      };

      return {
        owner: GUEST,
        byOwner: { [GUEST]: initialGuest() },
        rev: 0,

        setOwner: (owner) => {
          if (!get().byOwner[owner]) put(owner, fresh());
          set({ owner });
          if (owner !== GUEST) void sync(owner);
        },

        switchTo: (key) => {
          const s = space();
          if (s.list.some((w) => w.key === key)) put(get().owner, { ...s, active: key });
        },

        // Just clicking tabs in an untouched preset doesn't make it "modified"
        saveLayout: (layout, selectionOnly) => {
          const s = space();
          const w = s.list.find((x) => x.key === s.active);
          if (!w || (selectionOnly && w.preset && !w.layout)) return;
          patch(w.key, { layout });
        },

        create: (name, layout) => {
          const { owner } = get();
          const s = space();
          const key = `l:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          put(owner, { list: [...s.list, { key, name, layout, dirty: true }], active: key });
          void push(owner, key);
        },

        rename: (key, name) => patch(key, { name }),
        reset: (key) => patch(key, { layout: undefined }, key === space().active),

        remove: (key) => {
          const { owner } = get();
          const s = space();
          const w = s.list.find((x) => x.key === key);
          if (!w || w.preset) return;
          put(owner, { list: s.list.filter((x) => x.key !== key), active: s.active === key ? 'trade' : s.active });
          if (owner !== GUEST && w.id != null) api.delete(`/workspaces/${w.id}`).catch(() => { /* comes back on next sync */ });
        },
      };
    },
    {
      name: 'terminal-workspaces',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ owner: s.owner, byOwner: s.byOwner }),
      merge: (persisted, current) => {
        if (persisted) OLD_KEYS.forEach((k) => localStorage.removeItem(k)); // migration already captured
        return { ...current, ...(persisted as object) };
      },
    },
  ),
);

// ── Server sync (logged-in owners only) ──

const find = (owner: string, key: string) => useWorkspaceStore.getState().byOwner[owner]?.list.find((w) => w.key === key);

function update(owner: string, key: string, p: Partial<Workspace>) {
  useWorkspaceStore.setState((st) => {
    const s = st.byOwner[owner];
    if (!s) return st;
    return { byOwner: { ...st.byOwner, [owner]: { ...s, list: s.list.map((w) => (w.key === key ? { ...w, ...p } : w)) } } };
  });
}

// ponytail: 1s debounce per workspace keeps splitter drags well under the 120 req/min limit
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function schedule(owner: string, key: string) {
  if (owner === GUEST) return;
  const tk = `${owner}|${key}`;
  clearTimeout(timers.get(tk));
  timers.set(tk, setTimeout(() => { timers.delete(tk); void push(owner, key); }, 1000));
}

const inflight = new Map<string, boolean>(); // key → another push requested while this one runs
async function push(owner: string, key: string): Promise<void> {
  if (owner === GUEST) return;
  const tk = `${owner}|${key}`;
  if (inflight.has(tk)) { inflight.set(tk, true); return; }
  inflight.set(tk, false);
  let again = false;
  try {
    const w = find(owner, key);
    if (!w?.dirty) return;
    let id: number | undefined;
    if (w.preset) {
      if (w.layout) id = (await api.put<ServerWorkspace>(`/workspaces/preset/${w.preset}`, { layout: w.layout })).id;
      else if (w.id != null) await api.delete(`/workspaces/${w.id}`); // reset
    } else {
      const body = { name: w.name, layout: w.layout };
      id = (w.id != null ? await api.put<ServerWorkspace>(`/workspaces/${w.id}`, body) : await api.post<ServerWorkspace>('/workspaces', body)).id;
    }
    const now = find(owner, key);
    if (!now) {
      if (id != null && !w.preset) void api.delete(`/workspaces/${id}`).catch(() => {}); // deleted while uploading
      return;
    }
    again = now.layout !== w.layout || now.name !== w.name; // edited during the request
    update(owner, key, { id, dirty: again });
  } catch {
    // stays dirty — retried on the next edit or the next login
  } finally {
    again ||= inflight.get(tk) === true;
    inflight.delete(tk);
    if (again) void push(owner, key);
  }
}

async function sync(owner: string) {
  let rows: ServerWorkspace[];
  try { rows = await api.get<ServerWorkspace[]>('/workspaces'); } catch { return; }
  const st = useWorkspaceStore.getState();
  if (st.owner !== owner) return; // logged out meanwhile
  const s = st.byOwner[owner] ?? fresh();
  // Empty server + nothing pending here = first login for this account → bring the guest's workspaces along
  const local = rows.length || s.list.some((w) => w.dirty) ? s.list : importable(st.byOwner[GUEST]?.list ?? []);
  const list = reconcile(local, rows);
  const active = list.some((w) => w.key === s.active) ? s.active : 'trade';
  const before = s.list.find((w) => w.key === s.active)?.layout;
  const after = list.find((w) => w.key === active)?.layout;
  const replaced = active !== s.active || JSON.stringify(before) !== JSON.stringify(after);
  useWorkspaceStore.setState((cur) => ({ byOwner: { ...cur.byOwner, [owner]: { list, active } }, rev: replaced ? cur.rev + 1 : cur.rev }));
  list.filter((w) => w.dirty).forEach((w) => void push(owner, w.key));
}

// Follow the logged-in account: the server's copy for a logged-in user, this browser's for a guest.
// Subscribing here (not calling us from the auth store) keeps the stores free of circular imports,
// which Vite's HMR can't keep in sync — it ends up serving two copies of a store.
useAuthStore.subscribe((s, prev) => {
  if (s.loading) return; // wait for /auth/me, then act once
  if (!prev.loading && s.user?.mt5Login === prev.user?.mt5Login) return;
  useWorkspaceStore.getState().setOwner(s.user ? String(s.user.mt5Login) : GUEST);
});

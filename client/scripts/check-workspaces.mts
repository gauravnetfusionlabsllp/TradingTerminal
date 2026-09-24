// Self-check for dock workspaces: presets, layout sanitizing, server reconcile, guest→login import. Run: npx tsx scripts/check-workspaces.mts
import assert from 'node:assert/strict';
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) };

// Fake /api/workspaces: records calls, hands out ids
const calls: string[] = [];
const serverRows: any[] = [];
let nextId = 1;
(globalThis as any).fetch = async (url: string, init?: RequestInit) => {
  const path = url.replace(/^.*\/api/, '');
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push(`${method} ${path}`);
  let out: unknown = { ok: true };
  if (method === 'GET') out = serverRows;
  else if (method === 'POST') out = { id: nextId++, preset: null, ...body };
  else if (method === 'PUT' && path.startsWith('/workspaces/preset/')) out = { id: nextId++, preset: path.split('/').pop(), name: '', ...body };
  else if (method === 'PUT') out = { id: Number(path.split('/').pop()), preset: null, ...body };
  return new Response(JSON.stringify(out), { status: method === 'POST' ? 201 : 200 });
};

const { PRESETS, BLANK, GLOBAL, sanitizeLayout } = await import('../src/components/layout/presets.ts');
const { ALL_PANEL_IDS, UNDER_DEVELOPMENT } = await import('../src/components/layout/panels.ts');
const { useWorkspaceStore, reconcile } = await import('../src/stores/use-workspace-store.ts');

const tabsOf = (n: any): string[] => (n.type === 'tab' ? [n.component] : (n.children ?? []).flatMap(tabsOf));
const tabset = (ids: string[], selected?: number) => ({ type: 'tabset', weight: 50, selected, children: ids.map((id) => ({ type: 'tab', name: id, component: id, id })) });
const model = (...children: any[]) => ({ global: {}, borders: [], layout: { type: 'row', weight: 100, children } }) as any;

// Presets: real, working, unique panels — and already clean
for (const p of PRESETS) {
  const ids = tabsOf(p.layout.layout);
  assert.ok(ids.length > 0, p.id);
  assert.equal(new Set(ids).size, ids.length, `${p.id}: duplicate panel`);
  for (const id of ids) {
    assert.ok(ALL_PANEL_IDS.includes(id as any), `${p.id}: unknown panel ${id}`);
    assert.ok(!UNDER_DEVELOPMENT.has(id), `${p.id}: placeholder panel ${id}`);
  }
  assert.deepEqual(tabsOf(sanitizeLayout(p.layout).layout), ids, `${p.id} changed by sanitize`);
}
assert.deepEqual(PRESETS.map((p) => p.id), ['trade', 'chart', 'focus', 'research', 'macro']);

// Sanitize: unknown + duplicate tabs go, emptied tabsets/rows are pruned, the selected tab survives, GLOBAL applies
const dirty = model(
  tabset(['gone-panel', 'forex', 'bonds-rates'], 2),
  { type: 'row', weight: 50, children: [tabset(['gone-panel']), tabset(['forex', 'market-watch'])] },
);
const clean = sanitizeLayout(dirty);
assert.deepEqual(clean.global, GLOBAL);
assert.equal(clean.layout.children!.length, 2);
assert.deepEqual(tabsOf(clean.layout), ['forex', 'bonds-rates', 'market-watch']);
assert.equal((clean.layout.children![0] as any).selected, 1); // still bonds-rates
assert.equal((clean.layout.children![1] as any).children.length, 1); // emptied tabset pruned from the row
assert.deepEqual(sanitizeLayout(model(tabset(['gone-panel']))).layout, BLANK.layout);
assert.deepEqual(sanitizeLayout({} as any).layout, BLANK.layout);

// Reconcile: server wins, unsynced local edits win (keeping the server id), deletions elsewhere propagate
const L = (id: string) => model(tabset([id]));
const merged = reconcile(
  [
    { key: 'trade', preset: 'trade', name: 'trade', layout: L('forex'), dirty: true },
    { key: 'chart', preset: 'chart', name: 'chart', layout: L('forex') }, // reset on another device
    { key: 'l:a', name: 'Mine', layout: L('forex'), id: 7 },               // renamed on another device
    { key: 'l:b', name: 'Gone', layout: L('forex'), id: 8 },               // deleted on another device
    { key: 'l:c', name: 'Offline', layout: L('forex') },                   // never uploaded
  ],
  [
    { id: 1, preset: 'trade', name: 'trade', layout: L('bonds-rates') },
    { id: 7, preset: null, name: 'Renamed', layout: L('bonds-rates') },
    { id: 9, preset: null, name: 'Other device', layout: L('bonds-rates') },
    { id: 3, preset: 'retired', name: 'x', layout: L('forex') },          // preset no longer shipped
  ],
);
assert.deepEqual(merged.map((w) => w.key), ['trade', 'chart', 'focus', 'research', 'macro', 'l:a', 's:9', 'l:c']);
assert.equal(merged[0].id, 1);
assert.deepEqual(tabsOf(merged[0].layout!.layout), ['forex']);
assert.equal(merged[1].layout, undefined);
assert.equal(merged[5].name, 'Renamed');
assert.equal(merged[7].dirty, true);

// Store: clicking tabs in an untouched preset isn't an edit; rearranging is
const st = () => useWorkspaceStore.getState();
const space = () => st().byOwner[st().owner];
const settle = () => new Promise((r) => setTimeout(r, 20));
st().saveLayout(L('forex'), true);
assert.equal(space().list[0].layout, undefined);
st().saveLayout(L('forex'), false);
assert.ok(space().list[0].layout);

// Guest creates a workspace, then logs in to an empty account → both are uploaded and get server ids
st().create('Scalp', L('market-watch'));
assert.equal(space().active, space().list[5].key);
assert.equal(calls.length, 0); // guests never hit the server
st().setOwner('1001');
await settle();
assert.deepEqual(calls.sort(), ['GET /workspaces', 'POST /workspaces', 'PUT /workspaces/preset/trade']);
assert.ok(space().list.every((w) => !w.dirty));
assert.equal(space().list[5].name, 'Scalp');
assert.ok(space().list[5].id);

// Reset deletes the override; deleting a custom deletes its row; guest data untouched
calls.length = 0;
const tradeId = space().list[0].id;
const scalpId = space().list[5].id;
st().reset('trade');
st().remove(space().list[5].key);
await new Promise((r) => setTimeout(r, 1100)); // reset rides the 1s save debounce
assert.deepEqual(calls.sort(), [`DELETE /workspaces/${tradeId}`, `DELETE /workspaces/${scalpId}`].sort());
assert.equal(space().list.length, 5);
assert.equal(space().active, 'trade');
assert.equal(st().byOwner.guest.list.length, 6);

// Workspaces follow the auth store: nothing until /auth/me answers, then that account; logout → guest
const { useAuthStore } = await import('../src/stores/use-auth-store.ts');
useAuthStore.getState().setUser({ id: 2, mt5Login: 2002, readOnly: false, name: null });
assert.equal(st().owner, '1001'); // still loading
useAuthStore.getState().setLoading(false);
assert.equal(st().owner, '2002');
useAuthStore.getState().setUser(null);
assert.equal(st().owner, 'guest');
await settle();

console.log('check-workspaces: ok');

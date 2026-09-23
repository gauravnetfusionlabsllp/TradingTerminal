// Self-check for per-MT5-login watchlists. Run: npx tsx scripts/check-watchlist.mts
import assert from 'node:assert/strict';
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) };
const { useAppStore } = await import('../src/stores/use-app-store.ts');
const s = () => useAppStore.getState();

// Pre-MT5 list with no owner is dropped on first login
s().addSymbolToTab('AAPL', 'WATCHLIST');
s().loadWatchlistFor('1001');
assert.deepEqual(s().tabSymbols.WATCHLIST, []);

// Account A builds a list, B gets its own empty one, A's comes back intact
s().addSymbolToTab('EURUSD', 'WATCHLIST');
s().addWatchlistTab('fx');
s().addSymbolToTab('GBPUSD', 'FX');
s().setActiveWatchlistTab('FX');
s().loadWatchlistFor('2002');
assert.deepEqual(s().tabSymbols, { WATCHLIST: [], HOLDING: [] });
assert.equal(s().activeWatchlistTab, 'WATCHLIST');
s().addSymbolToTab('XAUUSD', 'WATCHLIST');
s().loadWatchlistFor('1001');
assert.deepEqual(s().tabSymbols.WATCHLIST, ['EURUSD']);
assert.deepEqual(s().tabSymbols.FX, ['GBPUSD']);
assert.equal(s().activeWatchlistTab, 'FX');
assert.deepEqual(s().watchlistTabs, ['WATCHLIST', 'HOLDING', 'FX']);
s().loadWatchlistFor('1001'); // same login = no-op
assert.deepEqual(s().tabSymbols.WATCHLIST, ['EURUSD']);
s().loadWatchlistFor('2002');
assert.deepEqual(s().tabSymbols.WATCHLIST, ['XAUUSD']);

// Persisted to storage (survives reload)
const saved = JSON.parse(mem.get('trading-terminal-storage')!).state;
assert.equal(saved.watchlistOwner, '2002');
assert.deepEqual(saved.watchlistsByLogin['1001'].tabSymbols.FX, ['GBPUSD']);
console.log('per-login watchlist: all assertions passed');

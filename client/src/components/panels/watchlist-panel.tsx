import { useState, useMemo, useCallback, useId } from 'react';
import {
  useWatchlist,
  useWatchlistSparks,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useTickerSearch,
  type WatchlistItem,
} from '../../api/hooks/use-watchlist';
import { useAppStore } from '../../stores/use-app-store';
import { useAuthStore } from '../../stores/use-auth-store';
import { useT } from '../../i18n';
import { Sparkline } from '../common/sparkline';
import { TickPrice } from './stock-panel';
import { ChevronDown, ChevronUp, RefreshCw, Search, X } from 'lucide-react';

type SortKey = 'symbol' | 'price' | 'changePercent' | 'volume' | 'marketCap';

// Columns join as the panel widens: Today ≥340px, Day range ≥480px, Volume + Mkt cap ≥600px
const COLS =
  'grid-cols-[minmax(0,1fr)_5rem_4.25rem] ' +
  '@min-[340px]:grid-cols-[minmax(0,1fr)_5rem_4.25rem_4.5rem] ' +
  '@min-[480px]:grid-cols-[minmax(0,1fr)_5rem_4.25rem_4.5rem_4.75rem] ' +
  '@min-[600px]:grid-cols-[minmax(0,1fr)_5rem_4.25rem_4.5rem_4.75rem_3.75rem_4.25rem]';
const AT_340 = 'hidden @min-[340px]:flex';
const AT_480 = 'hidden @min-[480px]:flex';
const AT_600 = 'hidden @min-[600px]:flex';
const STALE_MIN = 5;

function fmtVol(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

/** Yahoo prices are raw floats (NVDA 223.9645): stocks/indices 2 dp, FX-sized 4, sub-1 6 so changes don't round to 0.00 */
const decimals = (price: number) => (price >= 10 ? 2 : price >= 1 ? 4 : 6);
const signed = (n: number, dp: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(dp)}`;

function SortHeader({ k, label, sort, onSort, className = '' }: {
  k: SortKey;
  label: string;
  sort: { key: SortKey; asc: boolean };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === k;
  const Arrow = sort.asc ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className={`flex items-center gap-0.5 min-w-0 hover:text-fg transition-colors ${active ? 'text-fg' : ''} ${className}`}
    >
      <span className="truncate">{label}</span>
      {active && <Arrow className="w-3 h-3 shrink-0" />}
    </button>
  );
}

export function WatchlistPanel() {
  const t = useT();
  const { data: items, isLoading, isFetching, refetch, dataUpdatedAt } = useWatchlist();
  const { data: sparks, refetch: refetchSparks } = useWatchlistSparks();
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);
  const user = useAuthStore((s) => s.user);

  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'symbol', asc: true });
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const listId = useId();

  const q = query.trim();
  const { data: suggestions, isError: searchDown, isFetching: searching } = useTickerSearch(q);
  const matches = q ? suggestions ?? [] : [];
  const inList = useMemo(() => new Set(items?.map((i) => i.symbol)), [items]);

  const onSort = useCallback(
    (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key === 'symbol' })),
    [],
  );

  const sorted = useMemo(() => {
    const list = [...(items ?? [])];
    const val = (i: WatchlistItem) => i.quote?.[sort.key as Exclude<SortKey, 'symbol'>] ?? 0;
    list.sort((a, b) => {
      const cmp = sort.key === 'symbol' ? a.symbol.localeCompare(b.symbol) : val(a) - val(b);
      return sort.asc ? cmp : -cmp;
    });
    return list;
  }, [items, sort]);

  const add = (symbol: string) => {
    if (!inList.has(symbol)) addMutation.mutate(symbol);
    setQuery('');
    setOpen(false);
    setHighlight(-1);
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(Math.max(h + (e.key === 'ArrowDown' ? 1 : -1), 0), matches.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = matches[highlight];
      if (pick) {
        if (!inList.has(pick.symbol)) add(pick.symbol);
      } else if (q) add(q);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // ArrowUp/ArrowDown walk the rows and select as they go, so the chart follows
  const onRowKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-row]')];
    const cur = (e.target as HTMLElement).closest('li')?.querySelector<HTMLButtonElement>('button[data-row]');
    const next = rows[(cur ? rows.indexOf(cur) : -1) + (e.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
    next.click();
  };

  // Freshness from the quotes themselves; dataUpdatedAt moves on every refetch, so a dead tracker shows as stale
  const newest = useMemo(
    () => Math.max(0, ...(items ?? []).map((i) => (i.quote ? Date.parse(i.quote.updatedAt) : 0))),
    [items],
  );
  const ageMin = newest ? Math.floor((dataUpdatedAt - newest) / 60_000) : 0;

  const hint =
    open && q && matches.length === 0
      ? searchDown
        ? t('wlSearchDown')
        : searching
          ? null
          : t('wlNoMatch').replace('{q}', q.toUpperCase())
      : null;

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden font-mono">
      {/* Toolbar: the panel tab already carries the name */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        {user && (
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral pointer-events-none" />
            <input
              type="text"
              role="combobox"
              aria-label={t('addSymbol')}
              aria-expanded={open && (matches.length > 0 || !!hint)}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && matches[highlight] ? `${listId}-${highlight}` : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value.toUpperCase());
                setOpen(true);
                setHighlight(-1);
                if (addMutation.isError) addMutation.reset();
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onSearchKey}
              placeholder={t('addSymbol')}
              maxLength={32}
              className="w-full pl-7! text-mini"
            />

            {open && matches.length > 0 && (
              <ul
                id={listId}
                role="listbox"
                className="absolute inset-x-0 top-full mt-1 z-50 max-h-60 overflow-y-auto bg-raised border border-border shadow-lg animate-pop"
              >
                {matches.map((s, idx) => {
                  const added = inList.has(s.symbol);
                  return (
                    <li
                      key={s.symbol}
                      id={`${listId}-${idx}`}
                      role="option"
                      aria-selected={idx === highlight}
                      aria-disabled={added || undefined}
                      // mousedown + preventDefault so the input's blur doesn't close the list before the pick lands
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!added) add(s.symbol);
                      }}
                      onMouseEnter={() => setHighlight(idx)}
                      className={`flex items-center gap-2 px-2 py-1.5 ${added ? 'cursor-default' : 'cursor-pointer'} ${idx === highlight ? 'bg-hover' : ''}`}
                    >
                      <span className={`text-mini font-bold shrink-0 ${added ? 'text-neutral' : 'text-fg'}`}>{s.symbol}</span>
                      <span className="text-micro text-neutral truncate flex-1">{s.name}</span>
                      <span className="text-micro text-neutral shrink-0">{added ? t('wlAdded') : s.exchange}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {hint && (
              <p className="absolute inset-x-0 top-full mt-1 z-50 px-2 py-1.5 bg-raised border border-border text-micro text-neutral shadow-lg">
                {hint}
              </p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            refetch();
            refetchSparks();
          }}
          aria-label={t('refresh')}
          title={t('refresh')}
          className="ml-auto p-1 rounded-sm text-neutral hover:text-fg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'motion-safe:animate-spin' : ''}`} />
        </button>
      </div>

      {addMutation.isError && (
        <p role="alert" className="px-3 py-1 border-b border-border text-micro text-bearish shrink-0">
          {addMutation.error.message}
        </p>
      )}

      <div className="@container flex-1 min-h-0 flex flex-col">
        {/* Column headers */}
        <div className={`grid ${COLS} gap-x-2 px-3 py-1 border-b border-border text-micro text-neutral shrink-0`}>
          <SortHeader k="symbol" label={t('symbol')} sort={sort} onSort={onSort} />
          <SortHeader k="price" label={t('wlLast')} sort={sort} onSort={onSort} className="justify-end pr-1" />
          <SortHeader k="changePercent" label={t('wlChange')} sort={sort} onSort={onSort} className="justify-end" />
          <span className={`${AT_340} justify-end`}>{t('wlToday')}</span>
          <span className={`${AT_480} justify-end truncate`}>{t('wlDayRange')}</span>
          <SortHeader k="volume" label={t('volume')} sort={sort} onSort={onSort} className={`${AT_600} justify-end`} />
          <SortHeader k="marketCap" label={t('wlMktCap')} sort={sort} onSort={onSort} className={`${AT_600} justify-end`} />
        </div>

        <ul className="flex-1 overflow-y-auto no-scrollbar" onKeyDown={onRowKey}>
          {isLoading && !items &&
            Array.from({ length: 5 }, (_, i) => (
              <li key={i} className={`grid ${COLS} gap-x-2 items-center px-3 h-[38px] border-b border-border/50`}>
                <span className="h-2.5 w-14 rounded-sm bg-hover motion-safe:animate-pulse" />
                <span className="h-2.5 w-12 justify-self-end rounded-sm bg-hover motion-safe:animate-pulse" />
                <span className="h-2.5 w-10 justify-self-end rounded-sm bg-hover motion-safe:animate-pulse" />
              </li>
            ))}

          {!isLoading && sorted.length === 0 && (
            <li className="px-4 py-10 text-center text-mini text-neutral">
              {user ? t('wlEmpty') : t('addToWatchlist')}
            </li>
          )}

          {sorted.map((item) => {
            const quote = item.quote;
            const selected = item.symbol === selectedSymbol;
            const cp = quote?.changePercent ?? 0;
            const tone = !quote || !cp ? 'text-neutral' : cp > 0 ? 'text-bullish' : 'text-bearish';
            const dp = quote ? decimals(quote.price) : 2;
            const name = quote?.name ?? item.name;
            const series = sparks?.[item.symbol];

            return (
              <li
                key={item.symbol}
                className={`group relative grid ${COLS} gap-x-2 items-start px-3 py-1 border-b border-border/50 transition-colors ${
                  selected ? 'bg-accent/10 shadow-[inset_2px_0_0_var(--color-accent)]' : 'hover:bg-hover'
                }`}
              >
                {/* Stretched select button: the whole row is the hit target, the × stays a separate control */}
                <button
                  type="button"
                  data-row
                  onClick={() => setSelectedSymbol(item.symbol)}
                  aria-label={item.symbol}
                  aria-current={selected || undefined}
                  className="absolute inset-0 -outline-offset-2!"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-fg truncate">{item.symbol}</span>
                    {user && (
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(item.symbol)}
                        aria-label={t('wlRemove').replace('{symbol}', item.symbol)}
                        title={t('wlRemove').replace('{symbol}', item.symbol)}
                        className="relative z-10 shrink-0 p-0.5 rounded-sm text-neutral hover:text-bearish opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="text-micro text-neutral truncate">
                    {name && name !== item.symbol ? name : ' '}
                  </div>
                </div>

                <div className="flex justify-end">
                  <TickPrice value={quote?.price} dp={dp} />
                </div>

                <div className={`flex flex-col items-end tabular-nums ${tone}`}>
                  <span className="text-mini font-semibold">{quote ? `${signed(cp, 2)}%` : '—'}</span>
                  <span className="text-micro">{quote?.change != null ? signed(quote.change, dp) : ''}</span>
                </div>

                <div className={`${AT_340} justify-end self-center`}>
                  {series ? (
                    <Sparkline
                      data={series}
                      baseline={quote?.previousClose}
                      width={64}
                      height={24}
                      color={cp >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)'}
                    />
                  ) : (
                    <span className="text-micro text-neutral">—</span>
                  )}
                </div>

                <div className={`${AT_480} flex-col items-end tabular-nums text-neutral`}>
                  <span className="text-mini">{quote?.dayHigh != null ? quote.dayHigh.toFixed(dp) : '—'}</span>
                  <span className="text-micro">{quote?.dayLow != null ? quote.dayLow.toFixed(dp) : ''}</span>
                </div>

                <span className={`${AT_600} justify-end text-mini tabular-nums text-neutral`}>{fmtVol(quote?.volume)}</span>
                <span className={`${AT_600} justify-end text-mini tabular-nums text-neutral`}>{fmtVol(quote?.marketCap)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-1 border-t border-border text-micro text-neutral shrink-0">
        <span>{t('wlSymbols').replace('{n}', String(items?.length ?? 0))}</span>
        {newest > 0 &&
          (ageMin >= STALE_MIN ? (
            <span className="text-orange">{t('wlStale').replace('{n}', String(ageMin))}</span>
          ) : (
            <span>
              {t('wlUpdated').replace(
                '{time}',
                new Date(newest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              )}
            </span>
          ))}
      </div>
    </div>
  );
}

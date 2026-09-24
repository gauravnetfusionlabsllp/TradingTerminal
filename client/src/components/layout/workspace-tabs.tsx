import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { IJsonModel } from 'flexlayout-react';
import { ChevronDown, Plus } from 'lucide-react';
import { useT } from '../../i18n';
import { useWorkspaceStore, layoutOf, isModified, wsLabel, MAX_CUSTOM, type Workspace } from '../../stores/use-workspace-store';
import { PRESETS, BLANK } from './presets';
import { getModel } from './dock-layout';
import { LayoutThumb } from './layout-thumb';
import { ConfirmDialog } from '../common/confirm-dialog';
import { cn } from '../common/glass-card';

const NO_SPACE = { list: [] as Workspace[], active: 'trade' };
const TAB = 'relative shrink-0 flex items-center gap-1.5 px-3 text-[10px] font-mono font-bold uppercase tracking-widest whitespace-nowrap';

/** Close on outside mousedown or Escape */
function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [ref, open, close]);
}

/** Workspace switcher: one tab per workspace in the top bar, a menu on the active tab, and "+" to add one */
export function WorkspaceTabs() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const { list, active } = useWorkspaceStore((s) => s.byOwner[s.owner] ?? NO_SPACE);
  const { switchTo, rename, reset, remove, create } = useWorkspaceStore.getState();
  const customs = list.filter((w) => !w.preset).length;

  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [adding, setAdding] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const closeMenu = useMemo(() => () => setMenu(null), []);
  const closeAdd = useMemo(() => () => setAdding(false), []);
  useDismiss(menuRef, !!menu, closeMenu);
  useDismiss(addRef, adding, closeAdd);

  // Alt+N or the palette can pick a workspace that's scrolled out of view
  useEffect(() => {
    stripRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  useEffect(() => { menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); }, [menu]);

  const openMenu = (key: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setMenu({ key, x: Math.min(r.left, window.innerWidth - 200), y: r.bottom + 1 });
  };

  // Arrows move focus between tabs; Enter/Space switches (a switch remounts every panel, so no auto-activate)
  const onStripKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tabs = [...(stripRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
    const i = tabs.indexOf(document.activeElement as HTMLElement);
    tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]?.focus();
    e.preventDefault();
  };

  const menuWs = menu && list.find((w) => w.key === menu.key);

  return (
    <div className="flex items-stretch min-w-0 self-stretch">
      <div ref={stripRef} role="tablist" aria-label={t('wsWorkspaces')} onKeyDown={onStripKey} className="flex items-stretch min-w-0 overflow-x-auto no-scrollbar">
        {list.map((w, i) => {
          const on = w.key === active;
          const label = wsLabel(w, t);
          if (editing === w.key) {
            return <RenameInput key={w.key} initial={w.name} label={t('wsRename')} onDone={(name) => { if (name && name !== w.name) rename(w.key, name); setEditing(null); }} />;
          }
          return (
            <button
              key={w.key}
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              aria-haspopup={on ? 'menu' : undefined}
              title={i < 9 ? `${label} (Alt+${i + 1})` : label}
              onMouseDown={(e) => { if (menu?.key === w.key) e.stopPropagation(); }} // let the click below toggle the menu shut
              onClick={(e) => {
                if (!on) switchTo(w.key);
                else if (e.detail < 2) { if (menu?.key === w.key) setMenu(null); else openMenu(w.key, e.currentTarget); }
              }}
              onContextMenu={(e) => { e.preventDefault(); switchTo(w.key); openMenu(w.key, e.currentTarget); }}
              onDoubleClick={() => { if (!w.preset) { setMenu(null); setEditing(w.key); } }}
              className={cn(TAB, 'transition-colors', on ? 'text-white' : 'text-neutral/45 hover:text-neutral')}
            >
              <span className="max-w-[12rem] truncate">{label}</span>
              {isModified(w) && <span title={t('wsModified')} aria-label={t('wsModified')} className="w-1 h-1 bg-accent" />}
              {on && <ChevronDown aria-hidden className="w-3 h-3 -mr-1 text-neutral/50" />}
              {on && (
                <motion.span
                  layoutId="ws-active-bar"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div ref={addRef} className="relative shrink-0 flex items-center pl-1">
        <button
          onClick={() => setAdding(!adding)}
          aria-label={t('wsNew')}
          aria-expanded={adding}
          title={t('wsNew')}
          className={cn('p-1 border border-transparent hover:border-border hover:text-accent transition-colors', adding ? 'text-accent border-border' : 'text-neutral/50')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        {adding && <NewWorkspace full={customs >= MAX_CUSTOM} onCreate={(name, layout) => { create(name, layout); setAdding(false); }} />}
      </div>

      {menu && menuWs && (
        <div ref={menuRef} role="menu" onKeyDown={onMenuKey} style={{ left: menu.x, top: menu.y }} className="fixed z-50 min-w-[11rem] bg-black border border-border py-1 animate-pop">
          {!menuWs.preset && <MenuItem onClick={() => { setMenu(null); setEditing(menuWs.key); }}>{t('wsRename')}</MenuItem>}
          <MenuItem
            disabled={customs >= MAX_CUSTOM}
            title={customs >= MAX_CUSTOM ? t('wsLimit') : undefined}
            onClick={() => { setMenu(null); create(`${wsLabel(menuWs, t)} ${t('wsCopy')}`.slice(0, 40), structuredClone(layoutOf(menuWs))); }}
          >
            {t('wsDuplicate')}
          </MenuItem>
          {isModified(menuWs) && <MenuItem onClick={() => { setMenu(null); reset(menuWs.key); }}>{t('wsReset')}</MenuItem>}
          {!menuWs.preset && (
            <>
              <div className="my-1 h-px bg-border" />
              <MenuItem danger onClick={() => { setMenu(null); setDeleting(menuWs); }}>{t('wsDelete')}…</MenuItem>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `${t('wsDelete')} “${deleting.name}”?` : ''}
        description={t('wsDeleteBody')}
        confirmLabel={t('wsDelete')}
        onConfirm={() => { if (deleting) remove(deleting.key); setDeleting(null); }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
  const i = items.indexOf(document.activeElement as HTMLElement);
  items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  e.preventDefault();
}

function MenuItem({ children, danger, ...rest }: { children: ReactNode; danger?: boolean; disabled?: boolean; title?: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      {...rest}
      className={cn(
        'block w-full text-left px-3 py-1.5 text-[11px] font-mono whitespace-nowrap disabled:opacity-30 disabled:pointer-events-none',
        danger ? 'text-bearish hover:bg-bearish/10' : 'text-neutral hover:text-white hover:bg-white/5',
      )}
    >
      {children}
    </button>
  );
}

function RenameInput({ initial, label, onDone }: { initial: string; label: string; onDone: (name: string) => void }) {
  const cancelled = useRef(false);
  return (
    <input
      autoFocus
      defaultValue={initial}
      maxLength={40}
      aria-label={label}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => onDone(cancelled.current ? '' : e.currentTarget.value.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); }
      }}
      className="shrink-0 w-36 self-center mx-1 bg-black border border-accent px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-white outline-none"
    />
  );
}

function NewWorkspace({ full, onCreate }: { full: boolean; onCreate: (name: string, layout: IJsonModel) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const options = useMemo(() => {
    const current = getModel()?.toJson();
    return [
      ...(current ? [{ id: 'current', label: t('wsCurrent'), layout: current }] : []),
      ...PRESETS.map((p) => ({ id: p.id, label: t(p.nameKey), layout: p.layout })),
      { id: 'blank', label: t('wsBlank'), layout: BLANK },
    ];
  }, [t]);
  const [from, setFrom] = useState(options[0].id);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || full) return;
    onCreate(n, structuredClone(options.find((o) => o.id === from)!.layout));
  };

  return (
    <form onSubmit={submit} aria-label={t('wsNew')} className="absolute left-0 top-full mt-1 z-50 w-[26rem] max-w-[calc(100vw-1rem)] bg-black border border-border p-3 flex flex-col gap-3 animate-pop">
      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-accent">{t('wsNew')}</span>

      <label className="flex flex-col gap-1">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-neutral/60">{t('wsName')}</span>
        <input
          autoFocus
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('wsNamePlaceholder')}
          className="bg-black border border-border px-2 py-1.5 text-[11px] font-mono text-white placeholder:text-neutral/30 outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span id="ws-start-from" className="text-[9px] font-mono font-bold uppercase tracking-wider text-neutral/60">{t('wsStartFrom')}</span>
        <div role="radiogroup" aria-labelledby="ws-start-from" className="grid grid-cols-4 gap-2">
          {options.map((o) => {
            const on = from === o.id;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setFrom(o.id)} className="group flex flex-col gap-1 text-left">
                <LayoutThumb layout={o.layout} className={cn('h-14 w-full p-px gap-px border transition-colors', on ? 'border-accent' : 'border-border/40 group-hover:border-neutral/60')} />
                <span className={cn('text-[9px] font-mono font-bold uppercase tracking-wider truncate', on ? 'text-accent' : 'text-neutral/60')}>{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {full && <p className="text-[10px] font-mono text-bearish">{t('wsLimit')}</p>}

      <button
        type="submit"
        disabled={!name.trim() || full}
        className="self-end px-3 py-1.5 bg-accent text-black text-[10px] font-mono font-black uppercase tracking-widest disabled:opacity-30"
      >
        {t('wsCreate')}
      </button>
    </form>
  );
}

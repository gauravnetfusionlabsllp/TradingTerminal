import { useEffect } from 'react';
import { Actions, Orientation, RowNode, TabSetNode, type BorderNode, type ITabSetRenderValues, type Model, type Node, type TabNode } from 'flexlayout-react';
import { ChevronsLeftRight, ChevronsUpDown } from 'lucide-react';
import { useAppStore } from '../../stores/use-app-store';
import { getLocalizedPanelName } from './panels';
import { RAIL, OPEN_MIN, MANAGED, collapseSizes, expandSizes, toWeights, snapTarget, type Axis, type Side } from '../../lib/panel-collapse';

// Collapsing dock panels: drag a splitter past a panel's minimum and it folds — a column to a 28px rail of
// vertical names, a tabset to its tab strip. State lives on each tabset (attributes + config), so it saves
// with the workspace. Size math is in lib/panel-collapse.ts.

interface Collapsed { axis: Axis; share: number; prev: Record<string, unknown> }
type Open = (tabsetId: string, tabId?: string) => void;

const axisOf = (row: Node): Axis => (row.getOrientation() === Orientation.HORZ ? 'w' : 'h');
const len = (n: Node, axis: Axis) => (axis === 'w' ? n.getRect().width : n.getRect().height);
const minOf = (n: Node, axis: Axis) => {
  const s = n as RowNode | TabSetNode;
  return axis === 'w' ? s.getMinWidth() : s.getMinHeight();
};
const maxOf = (n: Node, axis: Axis) => {
  const s = n as RowNode | TabSetNode;
  return axis === 'w' ? s.getMaxWidth() : s.getMaxHeight();
};

/**
 * Can a row's children still stretch to fill it (`folding` = child about to collapse)? One open panel isn't
 * enough when it has a max size — the ticket stops at 360px and would leave the rest of its column empty.
 */
function fills(row: RowNode, axis: Axis, folding = -1) {
  const kids = row.getChildren();
  const reach = kids.reduce((sum, k, j) => sum + (j === folding ? RAIL : maxOf(k, axis)), 0);
  return reach + (kids.length - 1) * row.getModel().getSplitterSize() >= len(row, axis);
}

export const collapsedOf = (n: Node): Collapsed | undefined =>
  n instanceof TabSetNode ? n.getConfig()?.collapsed : undefined;

const tabsetsOf = (n: Node): TabSetNode[] => (n instanceof TabSetNode ? [n] : n.getChildren().flatMap(tabsetsOf));

/** Collapsed along `axis` = every tabset in it is */
function isCollapsed(n: Node, axis: Axis) {
  const sets = tabsetsOf(n);
  return sets.length > 0 && sets.every((t) => collapsedOf(t)?.axis === axis);
}

/** What collapses as one along `axis`: the tabset itself, or the row it sits across (a column, for width) */
const unitOf = (ts: TabSetNode, axis: Axis): Node => {
  const parent = ts.getParent()!;
  return axisOf(parent) === axis ? ts : parent;
};

/** A nested row running the same way would stack rails side by side and overflow the rail width */
const nestsSameAxis = (n: Node) => n instanceof RowNode && n.getChildren().some((c) => c instanceof RowNode);

function canCollapse(row: RowNode, i: number) {
  const axis = axisOf(row);
  const kids = row.getChildren();
  const n = kids[i];
  if (nestsSameAxis(n)) return false;
  // Already collapsed either way → no; except a column, which unfolds its folded tabsets before becoming a rail
  if (tabsetsOf(n).some((t) => collapsedOf(t)) && !(axis === 'w' && n instanceof RowNode && !isCollapsed(n, 'w'))) return false;
  return fills(row, axis, i);
}

/** The managed attributes as stored before collapsing; a missing one comes back undefined, which re-inherits GLOBAL */
const restoreAttrs = (prev: Record<string, unknown>) => Object.fromEntries(MANAGED.map((k) => [k, prev[k]]));

function snapshot(ts: TabSetNode) {
  const json: Record<string, unknown> = { ...ts.toJson() };
  return Object.fromEntries(MANAGED.filter((k) => json[k] !== undefined).map((k) => [k, json[k]]));
}

/** Reopen collapsed children of one row at the share they had, taking the space from the largest open siblings */
function reopenIn(model: Model, row: Node | undefined, units: Node[], axis: Axis) {
  if (row instanceof RowNode && axisOf(row) === axis) {
    const kids = row.getChildren();
    const mins = kids.map((k) => minOf(k, axis));
    const open = kids.map((k) => !isCollapsed(k, axis));
    let sizes = kids.map((k) => len(k, axis));
    const total = sizes.reduce((a, b) => a + b, 0);
    for (const u of units) {
      const i = kids.indexOf(u);
      if (i < 0) continue;
      const share = tabsetsOf(u).map(collapsedOf).find((c) => c?.axis === axis)?.share ?? 0;
      sizes = expandSizes(sizes, mins, open, i, Math.max(share * total, OPEN_MIN[axis]));
      open[i] = true;
    }
    model.doAction(Actions.adjustWeights(row.getId(), toWeights(sizes)));
  }
  for (const ts of units.flatMap(tabsetsOf)) {
    const c = collapsedOf(ts);
    if (c?.axis !== axis) continue;
    const { collapsed: _, ...config } = ts.getConfig() ?? {};
    model.doAction(Actions.updateNodeAttributes(ts.getId(), {
      ...restoreAttrs(c.prev),
      config: Object.keys(config).length ? config : undefined,
    }));
  }
}

/** Fold child i of `row` along the row's axis, giving the freed space to child `into` */
export function collapse(model: Model, row: RowNode, i: number, into: number) {
  const axis = axisOf(row);
  const n = row.getChildren()[i];
  // A column folding to a rail first unfolds its folded tabsets, so every rail segment has room for names
  if (axis === 'w' && n instanceof RowNode) {
    reopenIn(model, n, n.getChildren().filter((k) => isCollapsed(k, 'h')), 'h');
  }
  const sizes = row.getChildren().map((k) => len(k, axis));
  const share = sizes[i] / sizes.reduce((a, b) => a + b, 0);
  model.doAction(Actions.adjustWeights(row.getId(), toWeights(collapseSizes(sizes, i, into))));
  const attrs = axis === 'w'
    ? { minWidth: RAIL, maxWidth: RAIL, classNameTabStrip: 'sg-rail' }
    : { minHeight: 0, maxHeight: 0, classNameTabStrip: 'sg-fold' };
  for (const ts of tabsetsOf(n)) {
    const prev = snapshot(ts);
    model.doAction(Actions.updateNodeAttributes(ts.getId(), {
      ...attrs,
      config: { ...ts.getConfig(), collapsed: { axis, share, prev } satisfies Collapsed },
    }));
  }
}

/** Reopen the collapsed unit a tabset belongs to; false if it wasn't collapsed */
export function expand(model: Model, tabsetId: string) {
  const ts = model.getNodeById(tabsetId);
  const c = ts && collapsedOf(ts);
  if (!c) return false;
  const u = unitOf(ts as TabSetNode, c.axis);
  reopenIn(model, u.getParent(), [u], c.axis);
  return true;
}

/**
 * After a structural change (tab closed, moved, split…), reopen collapsed units that no longer make sense:
 * moved under a row running the other way, joined by an open tabset, or in a row its open panels can't fill.
 */
export function normalize(model: Model) {
  // Grouped per row: one weight pass per row, since rects stay stale until the next render
  const fix: { row: Node | undefined; axis: Axis; units: Node[] }[] = [];
  model.visitNodes((n) => {
    const c = collapsedOf(n);
    if (!c) return;
    const unit = unitOf(n as TabSetNode, c.axis);
    const row = unit.getParent();
    if (fix.some((f) => f.units.includes(unit))) return;
    const ok = row instanceof RowNode && axisOf(row) === c.axis && !nestsSameAxis(unit) && isCollapsed(unit, c.axis) && fills(row, c.axis);
    if (ok) return;
    const group = fix.find((f) => f.row === row && f.axis === c.axis);
    if (group) group.units.push(unit);
    else fix.push({ row, axis: c.axis, units: [unit] });
  });
  for (const f of fix) reopenIn(model, f.row, f.units, f.axis);
}

// ── Splitter drag: watch the pointer (flexlayout clamps its own outline at the minimum) ──

let pending: { rowId: string; i: number; into: number } | null = null;

/** The collapse armed by the splitter drag that just ended on `rowId`, if any — consumed once */
export function takeSnap(rowId: string) {
  const p = pending;
  pending = null;
  return p?.rowId === rowId ? p : null;
}

export function useSnapDrag(model: Model) {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      pending = null;
      const el = (e.target as Element).closest?.('.flexlayout__splitter');
      const root = el?.closest<HTMLElement>('.flexlayout__layout');
      if (!el || !root || e.button !== 0 || el.classList.contains('flexlayout__splitter_border')) return;
      const path = el.getAttribute('data-layout-path') ?? ''; // "<row path>/s<k>" sits between children k and k+1
      const cut = path.lastIndexOf('/s');
      const s = Number(path.slice(cut + 2)) + 1;
      let row: RowNode | undefined;
      model.visitNodes((n) => { if (n instanceof RowNode && n.getPath() === path.slice(0, cut)) row = n; });
      const r = row;
      if (!r || !(s > 0 && s < r.getChildren().length)) return;

      const axis = axisOf(r);
      const kids = r.getChildren();
      const side = (k: number): Side => {
        const rect = kids[k].getRect();
        return {
          start: axis === 'w' ? rect.x : rect.y,
          end: axis === 'w' ? rect.getRight() : rect.getBottom(),
          min: minOf(kids[k], axis),
          eligible: canCollapse(r, k),
        };
      };
      const before = side(s - 1);
      const after = side(s);
      if (!before.eligible && !after.eligible) return;
      const sr = el.getBoundingClientRect();
      const lr = root.getBoundingClientRect();
      const origin = axis === 'w' ? lr.x : lr.y;
      const grab = axis === 'w' ? e.clientX - sr.x : e.clientY - sr.y;
      const splitter = model.getSplitterSize();
      let at: 'before' | 'after' | null = null;
      let preview: HTMLDivElement | null = null;

      const onMove = (ev: PointerEvent) => {
        const next = snapTarget((axis === 'w' ? ev.clientX : ev.clientY) - origin - grab, before, after, splitter);
        if (next === at) return;
        at = next;
        root.classList.toggle('sg-snapping', next !== null);
        if (!next) {
          pending = null;
          preview?.remove();
          preview = null;
          return;
        }
        pending = next === 'before' ? { rowId: r.getId(), i: s - 1, into: s } : { rowId: r.getId(), i: s, into: s - 1 };
        preview ??= root.appendChild(document.createElement('div'));
        preview.className = 'sg-snap-preview';
        preview.dataset.axis = axis;
        preview.dataset.edge = next === 'before' ? 'start' : 'end';
        kids[pending.i].getRect().positionElement(preview);
      };
      // pending survives this: flexlayout's own pointerup listener (added after ours) applies the weights we intercept
      const onUp = () => {
        preview?.remove();
        root.classList.remove('sg-snapping');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [model]);
}

// ── Rendering ──

/** A width-collapsed tabset: its tab strip turned on its side, names reading down from the header line */
function Rail({ node, onOpen, label }: { node: TabSetNode; onOpen: Open; label: string }) {
  useAppStore((s) => s.locale); // names re-render on a language switch
  return (
    <div className="sg-rail-list">
      <button type="button" className="sg-rail-open" title={label} aria-label={label} onClick={() => onOpen(node.getId())}>
        <ChevronsLeftRight size={12} aria-hidden />
      </button>
      {(node.getChildren() as TabNode[]).map((tab, i) => {
        const name = getLocalizedPanelName(tab.getComponent() ?? '');
        return (
          <button
            key={tab.getId()}
            type="button"
            className="sg-rail-tab"
            title={name}
            aria-current={i === node.getSelected() || undefined}
            onClick={() => onOpen(node.getId(), tab.getId())}
          >
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** onRenderTabSet: a rail replaces a width-collapsed strip; a folded strip gets an Expand button */
export function renderCollapsed(node: TabSetNode | BorderNode, rv: ITabSetRenderValues, onOpen: Open, label: string) {
  const c = collapsedOf(node);
  if (!c) return;
  if (c.axis === 'w') {
    rv.leading = <Rail node={node as TabSetNode} onOpen={onOpen} label={label} />;
    rv.buttons.length = 0;
    rv.stickyButtons.length = 0;
    return;
  }
  rv.buttons.push(
    <button key="sg-expand" type="button" className="flexlayout__tab_toolbar_button" title={label} aria-label={label} onClick={() => onOpen(node.getId())}>
      <ChevronsUpDown size={12} aria-hidden />
    </button>,
  );
}

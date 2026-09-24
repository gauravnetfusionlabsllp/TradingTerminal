import type { IJsonModel, IJsonRowNode, IJsonTabSetNode, IJsonTabNode } from 'flexlayout-react';
import type { TranslationKey } from '../../i18n/translations';
import { PANEL_IDS, PANEL_NAMES, ALL_PANEL_IDS } from './panels';

// Built-in workspaces. A preset the user never touched renders straight from here, so improving one
// here reaches everyone who hasn't customised it. Root row is horizontal; nested rows alternate.

export type PresetId = 'trade' | 'chart' | 'focus' | 'research' | 'macro';

/** Shared by every workspace — applied on load, so changing it here reaches saved layouts too */
export const GLOBAL: IJsonModel['global'] = {
  tabEnableClose: true,
  tabEnableRename: false,
  tabSetEnableMaximize: true,
  tabSetEnableClose: false,
  splitterSize: 2,
  splitterExtra: 6,
  tabSetMinHeight: 80,
  tabSetMinWidth: 80,
};

const P = PANEL_IDS;
type Child = IJsonRowNode | IJsonTabSetNode;
const tab = (id: string): IJsonTabNode => ({ type: 'tab', name: PANEL_NAMES[id], component: id, id });
const set = (weight: number, ids: string[], extra?: Partial<IJsonTabSetNode>): IJsonTabSetNode =>
  ({ type: 'tabset', weight, children: ids.map(tab), ...extra });
const row = (weight: number, children: Child[]): IJsonRowNode => ({ type: 'row', weight, children });
const model = (children: Child[]): IJsonModel => ({ global: GLOBAL, borders: [], layout: row(100, children) });
const TICKET = { maxHeight: 360 }; // stacked ticket needs ~354px; spare height goes to the panels below

const TRADE = model([
  row(16, [set(60, [P.STOCKS]), set(40, [P.LIVE_STREAMS])]),
  row(52, [set(70, [P.TECHNICAL_CHART, P.HEAT_MAP, P.MACRO_HEATMAP]), set(30, [P.ORDERS, P.POSITIONS, P.HISTORY])]),
  row(32, [
    set(32, [P.TRADING], TICKET),
    set(38, [P.ECON_CALENDAR, P.FOREX]),
    set(30, [P.CURRENCY_STRENGTH, P.GLOBAL_DASHBOARD, P.FUTURES, P.CORRELATIONS]),
  ]),
]);

const CHART = model([
  set(14, [P.STOCKS]),
  row(62, [set(76, [P.TECHNICAL_CHART]), set(24, [P.POSITIONS, P.ORDERS, P.HISTORY])]),
  row(24, [
    set(34, [P.TRADING], TICKET),
    set(36, [P.PIVOT_POINTS, P.FIBONACCI, P.CONFLUENCE]),
    set(30, [P.CURRENCY_STRENGTH, P.CORRELATIONS, P.SEASONALITY]),
  ]),
]);

const FOCUS = model([
  set(15, [P.STOCKS]),
  set(60, [P.TECHNICAL_CHART]),
  row(25, [set(40, [P.TRADING], TICKET), set(60, [P.POSITIONS, P.ORDERS, P.HISTORY, P.RISK])]),
]);

// Watchlist / Screener / Movers set selectedSymbol; profile, financials and the chart follow it
const RESEARCH = model([
  set(24, [P.WATCHLIST, P.SCREENER, P.MARKET_MOVERS]), // table panels: need the width
  row(44, [set(55, [P.COMPANY_PROFILE, P.FINANCIALS, P.VALUATION_MULTIPLES, P.RELATIVE_VALUATION]), set(45, [P.TECHNICAL_CHART])]),
  row(32, [
    set(50, [P.ANALYST, P.EARNINGS_ESTIMATES, P.EARNINGS_SURPRISE]),
    set(50, [P.INSIDERS, P.HOLDINGS, P.SHORT_INTEREST, P.DIVIDENDS]),
  ]),
]);

const MACRO = model([
  row(34, [set(50, [P.GLOBAL_DASHBOARD, P.MACRO_DASHBOARD, P.CROSS_ASSET]), set(50, [P.FOREX, P.COMMODITIES, P.FUTURES])]),
  row(36, [set(55, [P.MACRO_HEATMAP, P.HEAT_MAP, P.SECTOR_HEATMAP]), set(45, [P.YIELD_CURVE, P.BONDS, P.CREDIT_SPREADS])]),
  row(30, [
    set(50, [P.ECON_CALENDAR, P.ECONOMIC_SURPRISES, P.MARKET_HOURS]),
    set(50, [P.CURRENCY_STRENGTH, P.SENTIMENT_DASHBOARD, P.INTERMARKET]),
  ]),
]);

/** Start-from template only — never shown as a tab */
export const BLANK = model([set(100, [])]);

export const PRESETS: { id: PresetId; nameKey: TranslationKey; layout: IJsonModel }[] = [
  { id: 'trade', nameKey: 'wsTrade', layout: TRADE },
  { id: 'chart', nameKey: 'wsChart', layout: CHART },
  { id: 'focus', nameKey: 'wsFocus', layout: FOCUS },
  { id: 'research', nameKey: 'wsResearch', layout: RESEARCH },
  { id: 'macro', nameKey: 'wsMacro', layout: MACRO },
];

export const presetLayout = (id: PresetId): IJsonModel => PRESETS.find((p) => p.id === id)!.layout;

/**
 * Make any stored layout safe to load: drop tabs for panels that no longer exist (and duplicates),
 * prune the tabsets/rows left empty, keep each tabset's selected tab, and apply GLOBAL.
 * This is what lets saved layouts survive panel removals instead of being wiped.
 */
export function sanitizeLayout(json: IJsonModel): IJsonModel {
  const known = new Set<string>(ALL_PANEL_IDS);
  const seen = new Set<string>();
  const clean = (node: any): any => {
    if (node?.type === 'tab') {
      const id = node.component;
      if (!known.has(id) || seen.has(id)) return null;
      seen.add(id);
      return { ...node, id };
    }
    const kids: any[] = Array.isArray(node?.children) ? node.children : [];
    const selectedId = kids[node?.selected ?? 0]?.component;
    const children = kids.map(clean).filter(Boolean);
    if (!children.length) return null;
    if (node.type === 'tabset') return { ...node, children, selected: Math.max(0, children.findIndex((c) => c.id === selectedId)) };
    return { ...node, children };
  };
  const layout = json?.layout?.type === 'row' ? clean(json.layout) : null;
  return { global: GLOBAL, borders: [], layout: layout ?? structuredClone(BLANK.layout) };
}

import { useCallback, useEffect, useMemo } from 'react';
import { Layout, Model, TabNode, type TabSetNode, type BorderNode, type Action, Actions, DockLocation } from 'flexlayout-react';
// CSS imported via index.css to avoid duplication

import { lazy, Suspense } from 'react';
import { StockPanel } from '../panels/stock-panel';
import { TechnicalChartPanel } from '../panels/technical-chart-panel';
import { TerminalLog } from '../layout/terminal-log';
import { PanelErrorBoundary } from '../common/error-boundary';
import { useAppStore } from '../../stores/use-app-store';
import { translations } from '../../i18n/translations';
import { useWorkspaceStore, layoutOf } from '../../stores/use-workspace-store';
import { PANEL_IDS, PANEL_NAME_KEYS, ALL_PANEL_IDS, UNDER_DEVELOPMENT, getLocalizedPanelName } from './panels';
import { sanitizeLayout, presetLayout } from './presets';

// Lazy load heavy panels
const Mt5Ticket = lazy(() => import('../trading/mt5-trading').then(m => ({ default: m.Mt5Ticket })));
const Mt5Positions = lazy(() => import('../trading/mt5-trading').then(m => ({ default: m.Mt5Positions })));
const Mt5Orders = lazy(() => import('../trading/mt5-trading').then(m => ({ default: m.Mt5Orders })));
const Mt5History = lazy(() => import('../trading/mt5-trading').then(m => ({ default: m.Mt5History })));
const EconomicCalendarPanel = lazy(() => import('../panels/economic-calendar-panel').then(m => ({ default: m.EconomicCalendarPanel })));
const AlertsPanel = lazy(() => import('../panels/alerts-panel').then(m => ({ default: m.AlertsPanel })));
const RiskCalculator = lazy(() => import('../panels/risk-calculator').then(m => ({ default: m.RiskCalculator })));
const SectorRotationPanel = lazy(() => import('../panels/sector-rotation-panel').then(m => ({ default: m.SectorRotationPanel })));
const OptionsFlowPanel = lazy(() => import('../panels/options-flow-panel').then(m => ({ default: m.OptionsFlowPanel })));
const InsiderTradesPanel = lazy(() => import('../panels/insider-trades-panel').then(m => ({ default: m.InsiderTradesPanel })));
const CorrelationMatrixPanel = lazy(() => import('../panels/correlation-matrix-panel').then(m => ({ default: m.CorrelationMatrixPanel })));
const LiveStreamsPanel = lazy(() => import('../panels/live-streams-panel').then(m => ({ default: m.LiveStreamsPanel })));
const MarketMoversPanel = lazy(() => import('../panels/market-movers-panel').then(m => ({ default: m.MarketMoversPanel })));
const ForexPanel = lazy(() => import('../panels/forex-panel').then(m => ({ default: m.ForexPanel })));
const BondsPanel = lazy(() => import('../panels/bonds-panel').then(m => ({ default: m.BondsPanel })));
const CommoditiesPanel = lazy(() => import('../panels/commodities-panel').then(m => ({ default: m.CommoditiesPanel })));
const GlobalDashboardPanel = lazy(() => import('../panels/global-dashboard-panel').then(m => ({ default: m.GlobalDashboardPanel })));
const ScannerPanel = lazy(() => import('../panels/scanner-panel').then(m => ({ default: m.ScannerPanel })));
const ScreenerPanel = lazy(() => import('../panels/screener-panel').then(m => ({ default: m.ScreenerPanel })));
const HeatMapPanel = lazy(() => import('../panels/heat-map-panel').then(m => ({ default: m.HeatMapPanel })));
const ETFPanel = lazy(() => import('../panels/etf-panel').then(m => ({ default: m.ETFPanel })));
const DividendPanel = lazy(() => import('../panels/dividend-panel').then(m => ({ default: m.DividendPanel })));
const AnalystPanel = lazy(() => import('../panels/analyst-panel').then(m => ({ default: m.AnalystPanel })));
const BreadthPanel = lazy(() => import('../panels/breadth-panel').then(m => ({ default: m.BreadthPanel })));
const FinancialsPanel = lazy(() => import('../panels/financials-panel').then(m => ({ default: m.FinancialsPanel })));
const FuturesPanel = lazy(() => import('../panels/futures-panel').then(m => ({ default: m.FuturesPanel })));
const ComparisonPanel = lazy(() => import('../panels/comparison-panel').then(m => ({ default: m.ComparisonPanel })));
const ShortInterestPanel = lazy(() => import('../panels/short-interest-panel').then(m => ({ default: m.ShortInterestPanel })));
const OptionsCalcPanel = lazy(() => import('../panels/options-calc-panel').then(m => ({ default: m.OptionsCalcPanel })));
const FXConverterPanel = lazy(() => import('../panels/fx-converter-panel').then(m => ({ default: m.FXConverterPanel })));
const BondCalcPanel = lazy(() => import('../panels/bond-calc-panel').then(m => ({ default: m.BondCalcPanel })));
const CompanyProfilePanel = lazy(() => import('../panels/company-profile-panel').then(m => ({ default: m.CompanyProfilePanel })));
const PivotPointsPanel = lazy(() => import('../panels/pivot-points-panel').then(m => ({ default: m.PivotPointsPanel })));
const MarketHoursPanel = lazy(() => import('../panels/market-hours-panel').then(m => ({ default: m.MarketHoursPanel })));
const MarketCalendarPanel = lazy(() => import('../panels/market-calendar-panel').then(m => ({ default: m.MarketCalendarPanel })));
const PairsPanel = lazy(() => import('../panels/pairs-panel').then(m => ({ default: m.PairsPanel })));
const VolatilityPanel = lazy(() => import('../panels/volatility-panel').then(m => ({ default: m.VolatilityPanel })));
const FibonacciPanel = lazy(() => import('../panels/fibonacci-panel').then(m => ({ default: m.FibonacciPanel })));
const MortgageCalcPanel = lazy(() => import('../panels/mortgage-calc-panel').then(m => ({ default: m.MortgageCalcPanel })));
const InvestmentCalcPanel = lazy(() => import('../panels/investment-calc-panel').then(m => ({ default: m.InvestmentCalcPanel })));
const RelativeStrengthPanel = lazy(() => import('../panels/relative-strength-panel').then(m => ({ default: m.RelativeStrengthPanel })));
const WatchlistPanel = lazy(() => import('../panels/watchlist-panel').then(m => ({ default: m.WatchlistPanel })));
const FXCrossPanel = lazy(() => import('../panels/fx-cross-panel').then(m => ({ default: m.FxCrossPanel })));
const YieldCurvePanel = lazy(() => import('../panels/yield-curve-panel').then(m => ({ default: m.YieldCurvePanel })));
const CurrencyStrengthPanel = lazy(() => import('../panels/currency-strength-panel').then(m => ({ default: m.CurrencyStrengthPanel })));
const MoneyFlowPanel = lazy(() => import('../panels/money-flow-panel').then(m => ({ default: m.MoneyFlowPanel })));
const EarningsEstimatesPanel = lazy(() => import('../panels/earnings-estimates-panel').then(m => ({ default: m.EarningsEstimatesPanel })));
const CrossAssetPanel = lazy(() => import('../panels/cross-asset-panel').then(m => ({ default: m.CrossAssetPanel })));
const HoldingsPanel = lazy(() => import('../panels/holdings-panel').then(m => ({ default: m.HoldingsPanel })));
const SectorPerformancePanel = lazy(() => import('../panels/sector-performance-panel').then(m => ({ default: m.SectorPerformancePanel })));
const ETFHoldingsPanel = lazy(() => import('../panels/etf-holdings-panel').then(m => ({ default: m.ETFHoldingsPanel })));
const DrawdownPanel = lazy(() => import('../panels/drawdown-panel').then(m => ({ default: m.DrawdownPanel })));
const MarketRegimePanel = lazy(() => import('../panels/market-regime-panel').then(m => ({ default: m.MarketRegimePanel })));
const RelativeValuationPanel = lazy(() => import('../panels/relative-valuation-panel').then(m => ({ default: m.RelativeValuationPanel })));
const ConfluencePanel = lazy(() => import('../panels/confluence-panel').then(m => ({ default: m.ConfluencePanel })));
const IVSurfacePanel = lazy(() => import('../panels/iv-surface-panel').then(m => ({ default: m.IVSurfacePanel })));
const SeasonalityPanel = lazy(() => import('../panels/seasonality-panel').then(m => ({ default: m.SeasonalityPanel })));
const OrderFlowPanel = lazy(() => import('../panels/order-flow-panel').then(m => ({ default: m.OrderFlowPanel })));
const PortfolioOptimizerPanel = lazy(() => import('../panels/portfolio-optimizer-panel').then(m => ({ default: m.PortfolioOptimizerPanel })));
const BacktestPanel = lazy(() => import('../panels/backtest-panel').then(m => ({ default: m.BacktestPanel })));
const MacroDashboardPanel = lazy(() => import('../panels/macro-dashboard-panel').then(m => ({ default: m.MacroDashboardPanel })));
const EarningsSurprisePanel = lazy(() => import('../panels/earnings-surprise-panel').then(m => ({ default: m.EarningsSurprisePanel })));
const FuturesCurvePanel = lazy(() => import('../panels/futures-curve-panel').then(m => ({ default: m.FuturesCurvePanel })));
const CreditSpreadsPanel = lazy(() => import('../panels/credit-spreads-panel').then(m => ({ default: m.CreditSpreadsPanel })));
const IntermarketPanel = lazy(() => import('../panels/intermarket-panel').then(m => ({ default: m.IntermarketPanel })));
const SectorHeatmapPanel = lazy(() => import('../panels/sector-heatmap-panel').then(m => ({ default: m.SectorHeatmapPanel })));
const EconomicSurprisesPanel = lazy(() => import('../panels/economic-surprises-panel').then(m => ({ default: m.EconomicSurprisesPanel })));
const DispersionPanel = lazy(() => import('../panels/dispersion-panel').then(m => ({ default: m.DispersionPanel })));
const FundFlowsPanel = lazy(() => import('../panels/fund-flows-panel').then(m => ({ default: m.FundFlowsPanel })));
const VolTermStructurePanel = lazy(() => import('../panels/vol-term-structure-panel').then(m => ({ default: m.VolTermStructurePanel })));
const MacroHeatmapPanel = lazy(() => import('../panels/macro-heatmap-panel').then(m => ({ default: m.MacroHeatmapPanel })));
const FactorExposurePanel = lazy(() => import('../panels/factor-exposure-panel').then(m => ({ default: m.FactorExposurePanel })));
const CapitalFlowsPanel = lazy(() => import('../panels/capital-flows-panel').then(m => ({ default: m.CapitalFlowsPanel })));
const TailRiskPanel = lazy(() => import('../panels/tail-risk-panel').then(m => ({ default: m.TailRiskPanel })));
const LiquidityPanel = lazy(() => import('../panels/liquidity-panel').then(m => ({ default: m.LiquidityPanel })));
const SentimentDashboardPanel = lazy(() => import('../panels/sentiment-dashboard-panel').then(m => ({ default: m.SentimentDashboardPanel })));
const MarketAnomaliesPanel = lazy(() => import('../panels/market-anomalies-panel').then(m => ({ default: m.MarketAnomaliesPanel })));
const CarryTradePanel = lazy(() => import('../panels/carry-trade-panel').then(m => ({ default: m.CarryTradePanel })));
const IvRankPanel = lazy(() => import('../panels/iv-rank-panel').then(m => ({ default: m.IvRankPanel })));
const PositioningPanel = lazy(() => import('../panels/positioning-panel').then(m => ({ default: m.PositioningPanel })));
const StyleBoxPanel = lazy(() => import('../panels/style-box-panel').then(m => ({ default: m.StyleBoxPanel })));
const ValuationMultiplesPanel = lazy(() => import('../panels/valuation-multiples-panel').then(m => ({ default: m.ValuationMultiplesPanel })));
const InsiderSentimentPanel = lazy(() => import('../panels/insider-sentiment-panel').then(m => ({ default: m.InsiderSentimentPanel })));
const EarningsWhisperPanel = lazy(() => import('../panels/earnings-whisper-panel').then(m => ({ default: m.EarningsWhisperPanel })));
const GlobalSupplyChainPanel = lazy(() => import('../panels/global-supply-chain-panel').then(m => ({ default: m.GlobalSupplyChainPanel })));



function LazyWrap({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-full bg-black gap-2">
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent animate-spin" />
        <span className="text-[10px] font-mono text-neutral/40 uppercase tracking-widest">{translations[useAppStore.getState().locale]?.loading ?? 'Loading...'}</span>
      </div>
    }>
      {children}
    </Suspense>
  );
}

/** Panels whose data will come from MT5 once the bridge exposes it */
function UnderDevelopment() {
  const locale = useAppStore((s) => s.locale);
  return (
    <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest text-center px-4">
      {translations[locale]?.underDevelopment ?? translations.en.underDevelopment}
    </div>
  );
}

// The live model of the active workspace, for the Panels menu and "new workspace from current layout"
let _modelRef: Model | null = null;

export function getModel(): Model | null {
  return _modelRef;
}

/** Hidden panels are whatever the active layout doesn't contain */
function syncHiddenPanels(model: Model) {
  useAppStore.setState({ hiddenPanels: ALL_PANEL_IDS.filter((id) => !model.getNodeById(id)) });
}

/** Show a panel: select its tab if it's in the layout, otherwise add it to the active (or first) tabset */
export function showPanelInLayout(panelId: string) {
  const model = _modelRef;
  if (!model) return;
  if (model.getNodeById(panelId)) {
    model.doAction(Actions.selectTab(panelId));
    return;
  }
  const tabset = model.getActiveTabset() ?? model.getFirstTabSet();
  model.doAction(Actions.addNode(
    { type: 'tab', name: getLocalizedPanelName(panelId), component: panelId, id: panelId },
    tabset.getId(),
    DockLocation.CENTER,
    -1,
  ));
}

/** Hide a panel: remove its tab from the model */
export function hidePanelInLayout(panelId: string) {
  const model = _modelRef;
  if (model?.getNodeById(panelId)) model.doAction(Actions.deleteTab(panelId));
}

const SELECTION_ACTIONS = new Set([Actions.SELECT_TAB, Actions.SET_ACTIVE_TABSET]);

export function DockLayout() {
  const owner = useWorkspaceStore((s) => s.owner);
  const active = useWorkspaceStore((s) => s.byOwner[s.owner]?.active ?? 'trade');
  const rev = useWorkspaceStore((s) => s.rev);
  const locale = useAppStore((s) => s.locale);

  // Rebuilt only on switch / external replace — reading the layout via getState keeps our own saves from rebuilding it
  const model = useMemo(() => {
    const s = useWorkspaceStore.getState();
    const ws = s.byOwner[s.owner]?.list.find((w) => w.key === active);
    return Model.fromJson(sanitizeLayout(ws ? layoutOf(ws) : presetLayout('trade')));
  }, [owner, active, rev]);

  useEffect(() => {
    _modelRef = model;
    syncHiddenPanels(model);
    return () => { if (_modelRef === model) _modelRef = null; };
  }, [model]);

  const onModelChange = useCallback((m: Model, action: Action) => {
    syncHiddenPanels(m);
    useWorkspaceStore.getState().saveLayout(m.toJson(), SELECTION_ACTIONS.has(action.type));
  }, []);

  // Middle-click closes a tab, as in browsers and editors; the × stays for mouse, touch and keyboard users alike
  const onAuxMouseClick = useCallback((node: TabNode | TabSetNode | BorderNode, e: React.MouseEvent) => {
    if (e.button !== 1 || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
    if (!(node instanceof TabNode) || !node.isEnableClose()) return;
    e.preventDefault();
    model.doAction(Actions.deleteTab(node.getId()));
  }, [model]);

  // Windows starts auto-scroll on a middle press; on a tab that press means close
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button === 1 && (e.target as Element).closest?.('.flexlayout__tab_button, .flexlayout__border_button')) e.preventDefault();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const factory = useCallback((node: TabNode) => {
    const component = node.getComponent() ?? '';
    if (UNDER_DEVELOPMENT.has(component)) return <PanelErrorBoundary><UnderDevelopment /></PanelErrorBoundary>;
    let content: React.ReactNode;
    switch (component) {
      case PANEL_IDS.STOCKS: content = <StockPanel />; break;
      case PANEL_IDS.LOG: content = <TerminalLog />; break;
      case PANEL_IDS.TRADING: content = <LazyWrap><Mt5Ticket /></LazyWrap>; break;
      case PANEL_IDS.POSITIONS: content = <LazyWrap><Mt5Positions /></LazyWrap>; break;
      case PANEL_IDS.ORDERS: content = <LazyWrap><Mt5Orders /></LazyWrap>; break;
      case PANEL_IDS.HISTORY: content = <LazyWrap><Mt5History /></LazyWrap>; break;
      case PANEL_IDS.ECON_CALENDAR: content = <LazyWrap><EconomicCalendarPanel /></LazyWrap>; break;
      case PANEL_IDS.ALERTS: content = <LazyWrap><AlertsPanel /></LazyWrap>; break;
      case PANEL_IDS.RISK: content = <LazyWrap><RiskCalculator /></LazyWrap>; break;
      case PANEL_IDS.SECTORS: content = <LazyWrap><SectorRotationPanel /></LazyWrap>; break;
      case PANEL_IDS.OPTIONS: content = <LazyWrap><OptionsFlowPanel /></LazyWrap>; break;
      case PANEL_IDS.INSIDERS: content = <LazyWrap><InsiderTradesPanel /></LazyWrap>; break;
      case PANEL_IDS.CORRELATIONS: content = <LazyWrap><CorrelationMatrixPanel /></LazyWrap>; break;
      case PANEL_IDS.LIVE_STREAMS: content = <LazyWrap><LiveStreamsPanel /></LazyWrap>; break;
      case PANEL_IDS.MARKET_MOVERS: content = <LazyWrap><MarketMoversPanel /></LazyWrap>; break;
      case PANEL_IDS.FOREX: content = <LazyWrap><ForexPanel /></LazyWrap>; break;
      case PANEL_IDS.BONDS: content = <LazyWrap><BondsPanel /></LazyWrap>; break;
      case PANEL_IDS.COMMODITIES: content = <LazyWrap><CommoditiesPanel /></LazyWrap>; break;
      case PANEL_IDS.GLOBAL_DASHBOARD: content = <LazyWrap><GlobalDashboardPanel /></LazyWrap>; break;
      case PANEL_IDS.SCANNER: content = <LazyWrap><ScannerPanel /></LazyWrap>; break;
      case PANEL_IDS.SCREENER: content = <LazyWrap><ScreenerPanel /></LazyWrap>; break;
      case PANEL_IDS.HEAT_MAP: content = <LazyWrap><HeatMapPanel /></LazyWrap>; break;
      case PANEL_IDS.ETF: content = <LazyWrap><ETFPanel /></LazyWrap>; break;
      case PANEL_IDS.DIVIDENDS: content = <LazyWrap><DividendPanel /></LazyWrap>; break;
      case PANEL_IDS.ANALYST: content = <LazyWrap><AnalystPanel /></LazyWrap>; break;
      case PANEL_IDS.BREADTH: content = <LazyWrap><BreadthPanel /></LazyWrap>; break;
      case PANEL_IDS.FINANCIALS: content = <LazyWrap><FinancialsPanel /></LazyWrap>; break;
      case PANEL_IDS.FUTURES: content = <LazyWrap><FuturesPanel /></LazyWrap>; break;
      case PANEL_IDS.PERFORMANCE: content = <LazyWrap><ComparisonPanel /></LazyWrap>; break;
      case PANEL_IDS.SHORT_INTEREST: content = <LazyWrap><ShortInterestPanel /></LazyWrap>; break;
      case PANEL_IDS.OPTIONS_CALC: content = <LazyWrap><OptionsCalcPanel /></LazyWrap>; break;
      case PANEL_IDS.FX_CONVERTER: content = <LazyWrap><FXConverterPanel /></LazyWrap>; break;
      case PANEL_IDS.BOND_CALC: content = <LazyWrap><BondCalcPanel /></LazyWrap>; break;
      case PANEL_IDS.COMPANY_PROFILE: content = <LazyWrap><CompanyProfilePanel /></LazyWrap>; break;
      case PANEL_IDS.PIVOT_POINTS: content = <LazyWrap><PivotPointsPanel /></LazyWrap>; break;
      case PANEL_IDS.MARKET_HOURS: content = <LazyWrap><MarketHoursPanel /></LazyWrap>; break;
      case PANEL_IDS.MARKET_CALENDAR: content = <LazyWrap><MarketCalendarPanel /></LazyWrap>; break;
      case PANEL_IDS.PAIRS_TRADING: content = <LazyWrap><PairsPanel /></LazyWrap>; break;
      case PANEL_IDS.VOLATILITY: content = <LazyWrap><VolatilityPanel /></LazyWrap>; break;
      case PANEL_IDS.FIBONACCI: content = <LazyWrap><FibonacciPanel /></LazyWrap>; break;
      case PANEL_IDS.MORTGAGE_CALC: content = <LazyWrap><MortgageCalcPanel /></LazyWrap>; break;
      case PANEL_IDS.INVESTMENT_CALC: content = <LazyWrap><InvestmentCalcPanel /></LazyWrap>; break;
      case PANEL_IDS.RELATIVE_STRENGTH: content = <LazyWrap><RelativeStrengthPanel /></LazyWrap>; break;
      case PANEL_IDS.WATCHLIST: content = <LazyWrap><WatchlistPanel /></LazyWrap>; break;
      case PANEL_IDS.FX_CROSS: content = <LazyWrap><FXCrossPanel /></LazyWrap>; break;
      case PANEL_IDS.YIELD_CURVE: content = <LazyWrap><YieldCurvePanel /></LazyWrap>; break;
      case PANEL_IDS.CURRENCY_STRENGTH: content = <LazyWrap><CurrencyStrengthPanel /></LazyWrap>; break;
      case PANEL_IDS.MONEY_FLOW: content = <LazyWrap><MoneyFlowPanel /></LazyWrap>; break;
      case PANEL_IDS.TECHNICAL_CHART: content = <TechnicalChartPanel />; break;
      case PANEL_IDS.EARNINGS_ESTIMATES: content = <LazyWrap><EarningsEstimatesPanel /></LazyWrap>; break;
      case PANEL_IDS.CROSS_ASSET: content = <LazyWrap><CrossAssetPanel /></LazyWrap>; break;
      case PANEL_IDS.HOLDINGS: content = <LazyWrap><HoldingsPanel /></LazyWrap>; break;
      case PANEL_IDS.SECTOR_PERFORMANCE: content = <LazyWrap><SectorPerformancePanel /></LazyWrap>; break;
      case PANEL_IDS.ETF_HOLDINGS: content = <LazyWrap><ETFHoldingsPanel /></LazyWrap>; break;
      case PANEL_IDS.DRAWDOWN: content = <LazyWrap><DrawdownPanel /></LazyWrap>; break;
      case PANEL_IDS.MARKET_REGIME: content = <LazyWrap><MarketRegimePanel /></LazyWrap>; break;
      case PANEL_IDS.RELATIVE_VALUATION: content = <LazyWrap><RelativeValuationPanel /></LazyWrap>; break;
      case PANEL_IDS.CONFLUENCE: content = <LazyWrap><ConfluencePanel /></LazyWrap>; break;
      case PANEL_IDS.IV_SURFACE: content = <LazyWrap><IVSurfacePanel /></LazyWrap>; break;
      case PANEL_IDS.SEASONALITY: content = <LazyWrap><SeasonalityPanel /></LazyWrap>; break;
      case PANEL_IDS.ORDER_FLOW: content = <LazyWrap><OrderFlowPanel /></LazyWrap>; break;
      case PANEL_IDS.PORTFOLIO_OPTIMIZER: content = <LazyWrap><PortfolioOptimizerPanel /></LazyWrap>; break;
      case PANEL_IDS.BACKTEST: content = <LazyWrap><BacktestPanel /></LazyWrap>; break;
      case PANEL_IDS.MACRO_DASHBOARD: content = <LazyWrap><MacroDashboardPanel /></LazyWrap>; break;
      case PANEL_IDS.EARNINGS_SURPRISE: content = <LazyWrap><EarningsSurprisePanel /></LazyWrap>; break;
      case PANEL_IDS.FUTURES_CURVE: content = <LazyWrap><FuturesCurvePanel /></LazyWrap>; break;
      case PANEL_IDS.CREDIT_SPREADS: content = <LazyWrap><CreditSpreadsPanel /></LazyWrap>; break;
      case PANEL_IDS.INTERMARKET: content = <LazyWrap><IntermarketPanel /></LazyWrap>; break;
      case PANEL_IDS.SECTOR_HEATMAP: content = <LazyWrap><SectorHeatmapPanel /></LazyWrap>; break;
      case PANEL_IDS.ECONOMIC_SURPRISES: content = <LazyWrap><EconomicSurprisesPanel /></LazyWrap>; break;
      case PANEL_IDS.DISPERSION: content = <LazyWrap><DispersionPanel /></LazyWrap>; break;
      case PANEL_IDS.FUND_FLOWS: content = <LazyWrap><FundFlowsPanel /></LazyWrap>; break;
      case PANEL_IDS.VOL_TERM_STRUCTURE: content = <LazyWrap><VolTermStructurePanel /></LazyWrap>; break;
      case PANEL_IDS.MACRO_HEATMAP: content = <LazyWrap><MacroHeatmapPanel /></LazyWrap>; break;
      case PANEL_IDS.FACTOR_EXPOSURE: content = <LazyWrap><FactorExposurePanel /></LazyWrap>; break;
      case PANEL_IDS.CAPITAL_FLOWS: content = <LazyWrap><CapitalFlowsPanel /></LazyWrap>; break;
      case PANEL_IDS.TAIL_RISK: content = <LazyWrap><TailRiskPanel /></LazyWrap>; break;
      case PANEL_IDS.LIQUIDITY: content = <LazyWrap><LiquidityPanel /></LazyWrap>; break;
      case PANEL_IDS.SENTIMENT_DASHBOARD: content = <LazyWrap><SentimentDashboardPanel /></LazyWrap>; break;
      case PANEL_IDS.MARKET_ANOMALIES: content = <LazyWrap><MarketAnomaliesPanel /></LazyWrap>; break;
      case PANEL_IDS.CARRY_TRADE: content = <LazyWrap><CarryTradePanel /></LazyWrap>; break;
      case PANEL_IDS.IV_RANK: content = <LazyWrap><IvRankPanel /></LazyWrap>; break;
      case PANEL_IDS.POSITIONING: content = <LazyWrap><PositioningPanel /></LazyWrap>; break;
      case PANEL_IDS.STYLE_BOX: content = <LazyWrap><StyleBoxPanel /></LazyWrap>; break;
      case PANEL_IDS.VALUATION_MULTIPLES: content = <LazyWrap><ValuationMultiplesPanel /></LazyWrap>; break;
      case PANEL_IDS.INSIDER_SENTIMENT: content = <LazyWrap><InsiderSentimentPanel /></LazyWrap>; break;
      case PANEL_IDS.EARNINGS_WHISPER: content = <LazyWrap><EarningsWhisperPanel /></LazyWrap>; break;
      case PANEL_IDS.GLOBAL_SUPPLY_CHAIN: content = <LazyWrap><GlobalSupplyChainPanel /></LazyWrap>; break;
      default:
        return <div className="flex items-center justify-center h-full text-neutral text-xs font-mono uppercase">Unknown panel: {component}</div>;
    }
    return <PanelErrorBoundary>{content}</PanelErrorBoundary>;
  }, []);

  const onRenderTab = useCallback((node: TabNode, renderValues: { leading: React.ReactNode; content: React.ReactNode; buttons: React.ReactNode[] }) => {
    const key = PANEL_NAME_KEYS[node.getComponent() ?? ''];
    if (key) renderValues.content = translations[locale]?.[key] ?? translations.en[key];
  }, [locale]);

  return (
    <Layout
      key={`${owner}|${active}|${rev}`}
      model={model}
      factory={factory}
      onRenderTab={onRenderTab}
      onModelChange={onModelChange}
      onAuxMouseClick={onAuxMouseClick}
    />
  );
}

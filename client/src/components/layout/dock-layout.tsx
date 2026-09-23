import { useCallback, useRef, useEffect } from 'react';
import { Layout, Model, type IJsonModel, type TabNode, type Action, Actions, DockLocation } from 'flexlayout-react';
// CSS imported via index.css to avoid duplication

import { lazy, Suspense } from 'react';
import { StockPanel } from '../panels/stock-panel';
import { TechnicalChartPanel } from '../panels/technical-chart-panel';
import { TerminalLog } from '../layout/terminal-log';
import { PanelErrorBoundary } from '../common/error-boundary';
import { useAppStore } from '../../stores/use-app-store';
import { translations, type TranslationKey } from '../../i18n/translations';

// Lazy load heavy panels
const Mt5Ticket = lazy(() => import('../trading/mt5-trading').then(m => ({ default: m.Mt5Ticket })));
const Mt5Positions = lazy(() => import('../trading/mt5-trading').then(m => ({ default: m.Mt5Positions })));
const Mt5Orders = lazy(() => import('../trading/mt5-trading').then(m => ({ default: m.Mt5Orders })));
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

const STORAGE_KEY = 'terminal-layout';
const LAYOUT_VERSION_KEY = 'terminal-layout-version';
const LAYOUT_VERSION = 36; // bump this when default layout changes to force reset

export const PANEL_IDS = {
  STOCKS: 'market-watch',
  LOG: 'terminal-log',
  TRADING: 'trading',
  POSITIONS: 'mt5-positions',
  ORDERS: 'mt5-orders',
  ECON_CALENDAR: 'econ-calendar',
  ALERTS: 'alerts',
  RISK: 'risk-calculator',
  SECTORS: 'sector-rotation',
  OPTIONS: 'options-flow',
  INSIDERS: 'insider-trades',
  CORRELATIONS: 'correlation-matrix',
  LIVE_STREAMS: 'live-streams',
  MARKET_MOVERS: 'market-movers',
  FOREX: 'forex',
  BONDS: 'bonds-rates',
  COMMODITIES: 'commodities',
  GLOBAL_DASHBOARD: 'global-dashboard',
  SCANNER: 'tech-scanner',
  SCREENER: 'stock-screener',
  HEAT_MAP: 'heat-map',
  ETF: 'etf-explorer',
  DIVIDENDS: 'dividends',
  ANALYST: 'analyst-ratings',
  BREADTH: 'market-breadth',
  FINANCIALS: 'financials',
  FUTURES: 'futures',
  PERFORMANCE: 'performance',
  SHORT_INTEREST: 'short-interest',
  OPTIONS_CALC: 'options-calc',
  FX_CONVERTER: 'fx-converter',
  BOND_CALC: 'bond-calc',
  COMPANY_PROFILE: 'company-profile',
  PIVOT_POINTS: 'pivot-points',
  MARKET_HOURS: 'market-hours',
  MARKET_CALENDAR: 'market-calendar',
  PAIRS_TRADING: 'pairs-trading',
  VOLATILITY: 'volatility',
  FIBONACCI: 'fibonacci',
  MORTGAGE_CALC: 'mortgage-calc',
  INVESTMENT_CALC: 'investment-calc',
  RELATIVE_STRENGTH: 'relative-strength',
  WATCHLIST: 'watchlist',
  FX_CROSS: 'fx-cross-rates',
  PORTFOLIO: 'portfolio-analytics',
  YIELD_CURVE: 'yield-curve',
  CURRENCY_STRENGTH: 'currency-strength',
  MONEY_FLOW: 'money-flow',
  TECHNICAL_CHART: 'technical-chart',
  EARNINGS_ESTIMATES: 'earnings-estimates',
  CROSS_ASSET: 'cross-asset',
  HOLDINGS: 'holdings',
  SECTOR_PERFORMANCE: 'sector-performance',
  ETF_HOLDINGS: 'etf-holdings',
  DRAWDOWN: 'drawdown',
  MARKET_REGIME: 'market-regime',
  RELATIVE_VALUATION: 'relative-valuation',
  CONFLUENCE: 'technical-confluence',
  IV_SURFACE: 'iv-surface',
  SEASONALITY: 'seasonality',
  ORDER_FLOW: 'order-flow',
  PORTFOLIO_OPTIMIZER: 'portfolio-optimizer',
  BACKTEST: 'backtest',
  MACRO_DASHBOARD: 'macro-dashboard',
  EARNINGS_SURPRISE: 'earnings-surprise',
  FUTURES_CURVE: 'futures-curve',
  CREDIT_SPREADS: 'credit-spreads',
  INTERMARKET: 'intermarket',
  SECTOR_HEATMAP: 'sector-heatmap',
  ECONOMIC_SURPRISES: 'economic-surprises',
  DISPERSION: 'dispersion',
  FUND_FLOWS: 'fund-flows',
  VOL_TERM_STRUCTURE: 'vol-term-structure',
  MACRO_HEATMAP: 'macro-heatmap',
  FACTOR_EXPOSURE: 'factor-exposure',
  CAPITAL_FLOWS: 'capital-flows',
  TAIL_RISK: 'tail-risk',
  LIQUIDITY: 'liquidity',
  SENTIMENT_DASHBOARD: 'sentiment-dashboard',
  MARKET_ANOMALIES: 'market-anomalies',
  CARRY_TRADE: 'carry-trade',
  IV_RANK: 'iv-rank',
  POSITIONING: 'positioning',
  STYLE_BOX: 'style-box',
  VOLATILITY_CONE: 'volatility-cone',
  VALUATION_MULTIPLES: 'valuation-multiples',
  INSIDER_SENTIMENT: 'insider-sentiment',
  EXECUTION_ANALYTICS: 'execution-analytics',
  EARNINGS_WHISPER: 'earnings-whisper',
  MARKET_DEPTH: 'market-depth',
  GLOBAL_SUPPLY_CHAIN: 'global-supply-chain',
  FX_FORWARD: 'fx-forward',
  PRECIOUS_METALS: 'precious-metals',
} as const;

export const PANEL_NAMES: Record<string, string> = {
  [PANEL_IDS.STOCKS]: 'MARKET WATCH',
  [PANEL_IDS.LOG]: 'TERMINAL LOG',
  [PANEL_IDS.TRADING]: 'TRADE',
  [PANEL_IDS.POSITIONS]: 'POSITIONS',
  [PANEL_IDS.ORDERS]: 'ORDERS',
  [PANEL_IDS.ECON_CALENDAR]: 'ECONOMIC CALENDAR',
  [PANEL_IDS.ALERTS]: 'ALERTS',
  [PANEL_IDS.RISK]: 'RISK CALCULATOR',
  [PANEL_IDS.SECTORS]: 'SECTOR ROTATION',
  [PANEL_IDS.OPTIONS]: 'OPTIONS FLOW',
  [PANEL_IDS.INSIDERS]: 'INSIDER TRADES',
  [PANEL_IDS.CORRELATIONS]: 'CORRELATIONS',
  [PANEL_IDS.LIVE_STREAMS]: 'LIVE STREAMS',
  [PANEL_IDS.MARKET_MOVERS]: 'MARKET MOVERS',
  [PANEL_IDS.FOREX]: 'FOREX',
  [PANEL_IDS.BONDS]: 'BONDS & RATES',
  [PANEL_IDS.COMMODITIES]: 'COMMODITIES',
  [PANEL_IDS.GLOBAL_DASHBOARD]: 'GLOBAL DASHBOARD',
  [PANEL_IDS.SCANNER]: 'TECHNICAL SCANNER',
  [PANEL_IDS.SCREENER]: 'STOCK SCREENER',
  [PANEL_IDS.HEAT_MAP]: 'HEAT MAP',
  [PANEL_IDS.ETF]: 'ETF EXPLORER',
  [PANEL_IDS.DIVIDENDS]: 'DIVIDENDS',
  [PANEL_IDS.ANALYST]: 'ANALYST RATINGS',
  [PANEL_IDS.BREADTH]: 'MARKET BREADTH',
  [PANEL_IDS.FINANCIALS]: 'FINANCIALS',
  [PANEL_IDS.FUTURES]: 'FUTURES',
  [PANEL_IDS.PERFORMANCE]: 'PERFORMANCE',
  [PANEL_IDS.SHORT_INTEREST]: 'SHORT INTEREST',
  [PANEL_IDS.OPTIONS_CALC]: 'OPTIONS CALC',
  [PANEL_IDS.FX_CONVERTER]: 'FX CONVERTER',
  [PANEL_IDS.BOND_CALC]: 'BOND CALC',
  [PANEL_IDS.COMPANY_PROFILE]: 'COMPANY PROFILE',
  [PANEL_IDS.PIVOT_POINTS]: 'PIVOT POINTS',
  [PANEL_IDS.MARKET_HOURS]: 'MARKET HOURS',
  [PANEL_IDS.MARKET_CALENDAR]: 'MARKET CALENDAR',
  [PANEL_IDS.PAIRS_TRADING]: 'PAIRS TRADING',
  [PANEL_IDS.VOLATILITY]: 'VOLATILITY',
  [PANEL_IDS.FIBONACCI]: 'FIBONACCI',
  [PANEL_IDS.MORTGAGE_CALC]: 'MORTGAGE CALC',
  [PANEL_IDS.INVESTMENT_CALC]: 'INVESTMENT CALC',
  [PANEL_IDS.RELATIVE_STRENGTH]: 'RELATIVE STRENGTH',
  [PANEL_IDS.WATCHLIST]: 'WATCHLIST',
  [PANEL_IDS.FX_CROSS]: 'FX CROSS RATES',
  [PANEL_IDS.PORTFOLIO]: 'PORTFOLIO ANALYTICS',
  [PANEL_IDS.YIELD_CURVE]: 'YIELD CURVE',
  [PANEL_IDS.CURRENCY_STRENGTH]: 'CURRENCY STRENGTH',
  [PANEL_IDS.MONEY_FLOW]: 'MONEY FLOW',
  [PANEL_IDS.TECHNICAL_CHART]: 'TECHNICAL CHART',
  [PANEL_IDS.EARNINGS_ESTIMATES]: 'EARNINGS ESTIMATES',
  [PANEL_IDS.CROSS_ASSET]: 'CROSS-ASSET',
  [PANEL_IDS.HOLDINGS]: 'INSTITUTIONAL HOLDINGS',
  [PANEL_IDS.SECTOR_PERFORMANCE]: 'SECTOR PERFORMANCE',
  [PANEL_IDS.ETF_HOLDINGS]: 'ETF HOLDINGS',
  [PANEL_IDS.DRAWDOWN]: 'DRAWDOWN ANALYSIS',
  [PANEL_IDS.MARKET_REGIME]: 'MARKET REGIME',
  [PANEL_IDS.RELATIVE_VALUATION]: 'RELATIVE VALUATION',
  [PANEL_IDS.CONFLUENCE]: 'TECHNICAL CONFLUENCE',
  [PANEL_IDS.IV_SURFACE]: 'IV SURFACE',
  [PANEL_IDS.SEASONALITY]: 'SEASONALITY',
  [PANEL_IDS.ORDER_FLOW]: 'ORDER FLOW',
  [PANEL_IDS.PORTFOLIO_OPTIMIZER]: 'PORTFOLIO OPTIMIZER',
  [PANEL_IDS.BACKTEST]: 'STRATEGY BACKTEST',
  [PANEL_IDS.MACRO_DASHBOARD]: 'MACRO DASHBOARD',
  [PANEL_IDS.EARNINGS_SURPRISE]: 'EARNINGS SURPRISE',
  [PANEL_IDS.FUTURES_CURVE]: 'FUTURES CURVE',
  [PANEL_IDS.CREDIT_SPREADS]: 'CREDIT SPREADS',
  [PANEL_IDS.INTERMARKET]: 'INTERMARKET DIVERGENCE',
  [PANEL_IDS.SECTOR_HEATMAP]: 'SECTOR HEATMAP',
  [PANEL_IDS.ECONOMIC_SURPRISES]: 'ECONOMIC SURPRISES',
  [PANEL_IDS.DISPERSION]: 'DISPERSION MONITOR',
  [PANEL_IDS.FUND_FLOWS]: 'FUND FLOWS',
  [PANEL_IDS.VOL_TERM_STRUCTURE]: 'VOL TERM STRUCTURE',
  [PANEL_IDS.MACRO_HEATMAP]: 'GLOBAL MACRO HEATMAP',
  [PANEL_IDS.FACTOR_EXPOSURE]: 'FACTOR EXPOSURE',
  [PANEL_IDS.CAPITAL_FLOWS]: 'GLOBAL CAPITAL FLOWS',
  [PANEL_IDS.TAIL_RISK]: 'TAIL RISK MONITOR',
  [PANEL_IDS.LIQUIDITY]: 'LIQUIDITY MONITOR',
  [PANEL_IDS.SENTIMENT_DASHBOARD]: 'SENTIMENT DASHBOARD',
  [PANEL_IDS.MARKET_ANOMALIES]: 'MARKET ANOMALIES',
  [PANEL_IDS.CARRY_TRADE]: 'CARRY TRADE',
  [PANEL_IDS.IV_RANK]: 'IV RANK',
  [PANEL_IDS.POSITIONING]: 'POSITIONING & FLOWS',
  [PANEL_IDS.STYLE_BOX]: 'EQUITY STYLE BOX',
  [PANEL_IDS.VOLATILITY_CONE]: 'VOLATILITY CONE',
  [PANEL_IDS.VALUATION_MULTIPLES]: 'VALUATION MULTIPLES',
  [PANEL_IDS.INSIDER_SENTIMENT]: 'INSIDER SENTIMENT',
  [PANEL_IDS.EXECUTION_ANALYTICS]: 'EXECUTION ANALYTICS',
  [PANEL_IDS.EARNINGS_WHISPER]: 'EARNINGS WHISPER',
  [PANEL_IDS.MARKET_DEPTH]: 'MARKET DEPTH',
  [PANEL_IDS.GLOBAL_SUPPLY_CHAIN]: 'SUPPLY CHAIN',
  [PANEL_IDS.FX_FORWARD]: 'FX FORWARD',
  [PANEL_IDS.PRECIOUS_METALS]: 'PRECIOUS METALS',
};

/** Maps panel IDs to i18n translation keys */
export const PANEL_NAME_KEYS: Record<string, TranslationKey> = {
  [PANEL_IDS.STOCKS]: 'panelMarketWatch',
  [PANEL_IDS.LOG]: 'panelTerminalLog',
  [PANEL_IDS.TRADING]: 'trade',
  [PANEL_IDS.POSITIONS]: 'positions',
  [PANEL_IDS.ORDERS]: 'orders',
  [PANEL_IDS.ECON_CALENDAR]: 'panelEconCalendar',
  [PANEL_IDS.ALERTS]: 'panelAlerts',
  [PANEL_IDS.RISK]: 'panelRiskCalc',
  [PANEL_IDS.SECTORS]: 'panelSectorRotation',
  [PANEL_IDS.OPTIONS]: 'panelOptionsFlow',
  [PANEL_IDS.INSIDERS]: 'panelInsiderTrades',
  [PANEL_IDS.CORRELATIONS]: 'panelCorrelations',
  [PANEL_IDS.LIVE_STREAMS]: 'panelLiveStreams',
  [PANEL_IDS.MARKET_MOVERS]: 'panelMarketMovers',
  [PANEL_IDS.FOREX]: 'panelForex',
  [PANEL_IDS.BONDS]: 'panelBonds',
  [PANEL_IDS.COMMODITIES]: 'panelCommodities',
  [PANEL_IDS.GLOBAL_DASHBOARD]: 'panelGlobalDashboard',
  [PANEL_IDS.SCANNER]: 'panelScanner',
  [PANEL_IDS.SCREENER]: 'panelScreener',
  [PANEL_IDS.HEAT_MAP]: 'panelHeatMap',
  [PANEL_IDS.ETF]: 'panelETF',
  [PANEL_IDS.DIVIDENDS]: 'panelDividends',
  [PANEL_IDS.ANALYST]: 'panelAnalyst',
  [PANEL_IDS.BREADTH]: 'panelBreadth',
  [PANEL_IDS.FINANCIALS]: 'panelFinancials',
  [PANEL_IDS.FUTURES]: 'panelFutures',
  [PANEL_IDS.PERFORMANCE]: 'panelPerformance',
  [PANEL_IDS.SHORT_INTEREST]: 'panelShortInterest',
  [PANEL_IDS.OPTIONS_CALC]: 'panelOptionsCalc',
  [PANEL_IDS.FX_CONVERTER]: 'panelFXConverter',
  [PANEL_IDS.BOND_CALC]: 'panelBondCalc',
  [PANEL_IDS.COMPANY_PROFILE]: 'panelCompanyProfile',
  [PANEL_IDS.PIVOT_POINTS]: 'panelPivotPoints',
  [PANEL_IDS.MARKET_HOURS]: 'panelMarketHours',
  [PANEL_IDS.MARKET_CALENDAR]: 'panelMarketCalendar',
  [PANEL_IDS.PAIRS_TRADING]: 'panelPairs',
  [PANEL_IDS.VOLATILITY]: 'panelVolatility',
  [PANEL_IDS.FIBONACCI]: 'panelFibonacci',
  [PANEL_IDS.MORTGAGE_CALC]: 'panelMortgage',
  [PANEL_IDS.INVESTMENT_CALC]: 'panelInvestCalc',
  [PANEL_IDS.RELATIVE_STRENGTH]: 'panelRelStrength',
  [PANEL_IDS.WATCHLIST]: 'panelWatchlist',
  [PANEL_IDS.FX_CROSS]: 'panelFXCross',
  [PANEL_IDS.PORTFOLIO]: 'panelPortfolio',
  [PANEL_IDS.YIELD_CURVE]: 'panelYieldCurve',
  [PANEL_IDS.CURRENCY_STRENGTH]: 'panelCurrencyStrength',
  [PANEL_IDS.MONEY_FLOW]: 'panelMoneyFlow',
  [PANEL_IDS.TECHNICAL_CHART]: 'panelTechnicalChart',
  [PANEL_IDS.EARNINGS_ESTIMATES]: 'panelEarningsEstimates',
  [PANEL_IDS.CROSS_ASSET]: 'panelCrossAsset',
  [PANEL_IDS.HOLDINGS]: 'panelHoldings',
  [PANEL_IDS.SECTOR_PERFORMANCE]: 'panelSectorPerformance',
  [PANEL_IDS.ETF_HOLDINGS]: 'panelETFHoldings',
  [PANEL_IDS.DRAWDOWN]: 'panelDrawdown',
  [PANEL_IDS.MARKET_REGIME]: 'panelMarketRegime',
  [PANEL_IDS.RELATIVE_VALUATION]: 'panelRelativeValuation',
  [PANEL_IDS.CONFLUENCE]: 'panelConfluence',
  [PANEL_IDS.IV_SURFACE]: 'panelIVSurface',
  [PANEL_IDS.SEASONALITY]: 'panelSeasonality',
  [PANEL_IDS.ORDER_FLOW]: 'panelOrderFlow',
  [PANEL_IDS.PORTFOLIO_OPTIMIZER]: 'panelPortfolioOptimizer',
  [PANEL_IDS.BACKTEST]: 'panelBacktest',
  [PANEL_IDS.MACRO_DASHBOARD]: 'panelMacroDashboard',
  [PANEL_IDS.EARNINGS_SURPRISE]: 'panelEarningsSurprise',
  [PANEL_IDS.FUTURES_CURVE]: 'panelFuturesCurve',
  [PANEL_IDS.CREDIT_SPREADS]: 'panelCreditSpreads',
  [PANEL_IDS.INTERMARKET]: 'panelIntermarket',
  [PANEL_IDS.SECTOR_HEATMAP]: 'panelSectorHeatmap',
  [PANEL_IDS.ECONOMIC_SURPRISES]: 'panelEconomicSurprises',
  [PANEL_IDS.DISPERSION]: 'panelDispersion',
  [PANEL_IDS.FUND_FLOWS]: 'panelFundFlows',
  [PANEL_IDS.VOL_TERM_STRUCTURE]: 'panelVolTermStructure',
  [PANEL_IDS.MACRO_HEATMAP]: 'panelMacroHeatmap',
  [PANEL_IDS.FACTOR_EXPOSURE]: 'panelFactorExposure',
  [PANEL_IDS.CAPITAL_FLOWS]: 'panelCapitalFlows',
  [PANEL_IDS.TAIL_RISK]: 'panelTailRisk',
  [PANEL_IDS.LIQUIDITY]: 'panelLiquidity',
  [PANEL_IDS.SENTIMENT_DASHBOARD]: 'panelSentimentDashboard',
  [PANEL_IDS.MARKET_ANOMALIES]: 'panelMarketAnomalies',
  [PANEL_IDS.CARRY_TRADE]: 'panelCarryTrade',
  [PANEL_IDS.IV_RANK]: 'panelIvRank',
  [PANEL_IDS.POSITIONING]: 'panelPositioning',
  [PANEL_IDS.STYLE_BOX]: 'panelStyleBox',
  [PANEL_IDS.VOLATILITY_CONE]: 'panelVolatilityCone',
  [PANEL_IDS.VALUATION_MULTIPLES]: 'panelValuationMultiples',
  [PANEL_IDS.INSIDER_SENTIMENT]: 'panelInsiderSentiment',
  [PANEL_IDS.EXECUTION_ANALYTICS]: 'panelExecutionAnalytics',
  [PANEL_IDS.EARNINGS_WHISPER]: 'panelEarningsWhisper',
  [PANEL_IDS.MARKET_DEPTH]: 'panelMarketDepth',
  [PANEL_IDS.GLOBAL_SUPPLY_CHAIN]: 'panelGlobalSupplyChain',
  [PANEL_IDS.FX_FORWARD]: 'panelFxForward',
  [PANEL_IDS.PRECIOUS_METALS]: 'panelPreciousMetals',
};

/** Get localized panel name (non-hook, reads locale from store directly) */
export function getLocalizedPanelName(panelId: string): string {
  const locale = useAppStore.getState().locale;
  const key = PANEL_NAME_KEYS[panelId];
  if (key) {
    return translations[locale]?.[key] ?? translations.en[key];
  }
  return PANEL_NAMES[panelId] || panelId;
}

export const ALL_PANEL_IDS = Object.values(PANEL_IDS);

/** Panel IDs that exist in the DEFAULT_LAYOUT (core panels shown on first load) */
const DEFAULT_PANEL_IDS: Set<string> = new Set([
  PANEL_IDS.LIVE_STREAMS, PANEL_IDS.TECHNICAL_CHART,
  PANEL_IDS.STOCKS,
  PANEL_IDS.HEAT_MAP, PANEL_IDS.MACRO_HEATMAP,
  PANEL_IDS.TRADING, PANEL_IDS.POSITIONS, PANEL_IDS.ORDERS,
  PANEL_IDS.ECON_CALENDAR, PANEL_IDS.FOREX,
  PANEL_IDS.CURRENCY_STRENGTH, PANEL_IDS.GLOBAL_DASHBOARD, PANEL_IDS.FUTURES, PANEL_IDS.CORRELATIONS,
]);

/*
 * Trading layout — v35
 *
 * +-- 16% ------+------------ 52% --------------------+--------- 32% ------------+
 * | MARKET      | TECHNICAL CHART                      | TRADE (max 360px)        |
 * | WATCH       | (tabs: HEAT MAP, MACRO HEATMAP)      +--------------------------+
 * |             |                                      | ECONOMIC CALENDAR        |
 * | (60%)       | (70%)                                | (tab: FOREX)             |
 * +-------------+                                      +--------------------------+
 * | LIVE        +--------------------------------------+ CURRENCY STRENGTH        |
 * | STREAMS     | ORDERS (tab: POSITIONS)              | (tabs: GLOBAL DASHBOARD, |
 * | (40%)       | (30%)                                |  FUTURES, CORRELATIONS)  |
 * +-------------+--------------------------------------+--------------------------+
 */
const DEFAULT_LAYOUT: IJsonModel = {
  global: {
    tabEnableClose: true,
    tabEnableRename: false,
    tabSetEnableMaximize: true,
    tabSetEnableClose: false,
    splitterSize: 2,
    splitterExtra: 6,
    tabSetMinHeight: 80,
    tabSetMinWidth: 80,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      // Left column (16%): Heat Map + Live Streams
      {
        type: 'row',
        weight: 16,
        children: [
          {
            type: 'tabset',
            weight: 60,
            children: [
              { type: 'tab', name: 'MARKET WATCH', component: PANEL_IDS.STOCKS, id: PANEL_IDS.STOCKS },
            ],
          },
          {
            type: 'tabset',
            weight: 40,
            children: [
              { type: 'tab', name: 'LIVE STREAMS', component: PANEL_IDS.LIVE_STREAMS, id: PANEL_IDS.LIVE_STREAMS },
            ],
          },
        ],
      },
      // Center column (52%): Market Watch on top, Movers + AI on bottom
      {
        type: 'row',
        weight: 52,
        children: [
          // Top: Market Watch (hero), Technical Chart as secondary tab
          {
            type: 'tabset',
            weight: 70,
            children: [
              { type: 'tab', name: 'TECHNICAL CHART', component: PANEL_IDS.TECHNICAL_CHART, id: PANEL_IDS.TECHNICAL_CHART },
              { type: 'tab', name: 'HEAT MAP', component: PANEL_IDS.HEAT_MAP, id: PANEL_IDS.HEAT_MAP },
              { type: 'tab', name: 'GLOBAL MACRO HEATMAP', component: PANEL_IDS.MACRO_HEATMAP, id: PANEL_IDS.MACRO_HEATMAP },
            ],
          },
          // Bottom: Market Movers | Currency Strength
          {
            type: 'row',
            weight: 30,
            children: [
              {
                type: 'tabset',
                weight: 100,
                children: [
                  { type: 'tab', name: 'ORDERS', component: PANEL_IDS.ORDERS, id: PANEL_IDS.ORDERS },
                  { type: 'tab', name: 'POSITIONS', component: PANEL_IDS.POSITIONS, id: PANEL_IDS.POSITIONS },
                ],
              },
            ],
          },
        ],
      },
      // Right column (32%): Trade ticket, then live FX/CFD context (ForexFactory calendar + Yahoo)
      {
        type: 'row',
        weight: 32,
        children: [
          {
            type: 'tabset',
            weight: 32,
            maxHeight: 360, // stacked ticket needs ~354px; spare height goes to the panels below
            children: [
              { type: 'tab', name: 'TRADE', component: PANEL_IDS.TRADING, id: PANEL_IDS.TRADING },
            ],
          },
          {
            type: 'tabset',
            weight: 38,
            children: [
              { type: 'tab', name: 'ECONOMIC CALENDAR', component: PANEL_IDS.ECON_CALENDAR, id: PANEL_IDS.ECON_CALENDAR },
              { type: 'tab', name: 'FOREX', component: PANEL_IDS.FOREX, id: PANEL_IDS.FOREX },
            ],
          },
          {
            type: 'tabset',
            weight: 30,
            children: [
              { type: 'tab', name: 'CURRENCY STRENGTH', component: PANEL_IDS.CURRENCY_STRENGTH, id: PANEL_IDS.CURRENCY_STRENGTH },
              { type: 'tab', name: 'GLOBAL DASHBOARD', component: PANEL_IDS.GLOBAL_DASHBOARD, id: PANEL_IDS.GLOBAL_DASHBOARD },
              { type: 'tab', name: 'FUTURES', component: PANEL_IDS.FUTURES, id: PANEL_IDS.FUTURES },
              { type: 'tab', name: 'CORRELATIONS', component: PANEL_IDS.CORRELATIONS, id: PANEL_IDS.CORRELATIONS },
            ],
          },
        ],
      },
    ],
  },
};

/** Build a layout from default, excluding hidden panels */
function buildLayout(hiddenPanels: string[]): IJsonModel {
  if (hiddenPanels.length === 0) return DEFAULT_LAYOUT;

  const layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT)) as IJsonModel;

  function prune(node: any): boolean {
    if (!node.children) return true;
    node.children = node.children.filter((child: any) => {
      // Remove hidden tabs
      if (child.type === 'tab' && hiddenPanels.includes(child.id)) return false;
      // Recurse
      return prune(child);
    });
    // Remove empty tabsets or rows
    if ((node.type === 'tabset' || node.type === 'row') && node.children.length === 0) return false;
    return true;
  }

  prune(layout.layout);
  return layout;
}

function loadModel(): Model {
  // Check if a reset was requested
  if (localStorage.getItem(RESET_FLAG)) {
    localStorage.removeItem(RESET_FLAG);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION));
    const hiddenPanels = useAppStore.getState().hiddenPanels;
    return Model.fromJson(buildLayout(hiddenPanels));
  }

  // Force reset when layout version changes (e.g. new panels added)
  const savedVersion = parseInt(localStorage.getItem(LAYOUT_VERSION_KEY) || '0', 10);
  if (savedVersion < LAYOUT_VERSION) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION));
    // New panels not in DEFAULT_LAYOUT start hidden
    const nonDefaultPanels = ALL_PANEL_IDS.filter(id => !DEFAULT_PANEL_IDS.has(id));
    useAppStore.setState({ hiddenPanels: nonDefaultPanels });
    return Model.fromJson(buildLayout(nonDefaultPanels));
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const json = JSON.parse(saved) as IJsonModel;
      if (json.global) json.global.tabEnableClose = true;
      return Model.fromJson(json);
    }
  } catch {
    // corrupt data, fall through
  }
  const hiddenPanels = useAppStore.getState().hiddenPanels;
  return Model.fromJson(buildLayout(hiddenPanels));
}

// Module-level model ref
let _modelRef: Model | null = null;

export function getModel(): Model | null {
  return _modelRef;
}

/**
 * Show a panel: if it exists in the model, select it; otherwise add it dynamically.
 * For panels in DEFAULT_LAYOUT, falls back to rebuild + reload.
 */
export function showPanelInLayout(panelId: string) {
  const model = _modelRef;
  if (!model) {
    localStorage.setItem(RESET_FLAG, '1');
    window.location.reload();
    return;
  }

  // If panel already exists in model, just select it
  const existingNode = model.getNodeById(panelId);
  if (existingNode) {
    model.doAction(Actions.selectTab(panelId));
    return;
  }

  // For default panels that were pruned, rebuild from DEFAULT_LAYOUT
  if (DEFAULT_PANEL_IDS.has(panelId)) {
    localStorage.setItem(RESET_FLAG, '1');
    window.location.reload();
    return;
  }

  // Dynamically add the panel as a new tab in the active tabset
  const activeTabset = model.getActiveTabset();
  if (activeTabset) {
    model.doAction(Actions.addNode(
      { type: 'tab', name: getLocalizedPanelName(panelId), component: panelId, id: panelId },
      activeTabset.getId(),
      DockLocation.CENTER,
      -1,
    ));
  }
}

/**
 * Hide a panel: remove its tab from the model.
 */
export function hidePanelInLayout(panelId: string) {
  const model = _modelRef;
  if (!model) return;
  const node = model.getNodeById(panelId);
  if (node) {
    model.doAction(Actions.deleteTab(panelId));
  }
}

// Component registry
type PanelFactory = (node: TabNode) => React.ReactNode;
const extraFactories: Map<string, PanelFactory> = new Map();

export function addPanelFactory(id: string, factory: PanelFactory) {
  extraFactories.set(id, factory);
}

export function DockLayout() {
  const modelRef = useRef<Model>(loadModel());
  const hidePanel = useAppStore((s) => s.hidePanel);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    _modelRef = modelRef.current;
    return () => { _modelRef = null; };
  }, []);

  const saveLayout = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(modelRef.current.toJson()));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', saveLayout);
    return () => window.removeEventListener('beforeunload', saveLayout);
  }, [saveLayout]);

  const handleAction = useCallback((action: Action): Action | undefined => {
    if (action.type === Actions.DELETE_TAB) {
      const tabId = (action as any).data?.node;
      if (tabId && ALL_PANEL_IDS.includes(tabId)) {
        hidePanel(tabId);
      }
    }
    return action;
  }, [hidePanel]);

  const factory = useCallback((node: TabNode) => {
    const component = node.getComponent();
    let content: React.ReactNode;
    switch (component) {
      case PANEL_IDS.STOCKS: content = <StockPanel />; break;
      case PANEL_IDS.LOG: content = <TerminalLog />; break;
      case PANEL_IDS.TRADING: content = <LazyWrap><Mt5Ticket /></LazyWrap>; break;
      case PANEL_IDS.POSITIONS: content = <LazyWrap><Mt5Positions /></LazyWrap>; break;
      case PANEL_IDS.ORDERS: content = <LazyWrap><Mt5Orders /></LazyWrap>; break;
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
      case PANEL_IDS.PORTFOLIO: content = <UnderDevelopment />; break;
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
      case PANEL_IDS.VOLATILITY_CONE: content = <UnderDevelopment />; break;
      case PANEL_IDS.VALUATION_MULTIPLES: content = <LazyWrap><ValuationMultiplesPanel /></LazyWrap>; break;
      case PANEL_IDS.INSIDER_SENTIMENT: content = <LazyWrap><InsiderSentimentPanel /></LazyWrap>; break;
      case PANEL_IDS.EXECUTION_ANALYTICS: content = <UnderDevelopment />; break;
      case PANEL_IDS.EARNINGS_WHISPER: content = <LazyWrap><EarningsWhisperPanel /></LazyWrap>; break;
      case PANEL_IDS.MARKET_DEPTH: content = <UnderDevelopment />; break;
      case PANEL_IDS.GLOBAL_SUPPLY_CHAIN: content = <LazyWrap><GlobalSupplyChainPanel /></LazyWrap>; break;
      case PANEL_IDS.FX_FORWARD: content = <UnderDevelopment />; break;
      case PANEL_IDS.PRECIOUS_METALS: content = <UnderDevelopment />; break;
      default: {
        const extra = extraFactories.get(component ?? '');
        if (extra) return <PanelErrorBoundary>{extra(node)}</PanelErrorBoundary>;
        return <div className="flex items-center justify-center h-full text-neutral text-xs font-mono uppercase">Unknown panel: {component}</div>;
      }
    }
    return <PanelErrorBoundary>{content}</PanelErrorBoundary>;
  }, []);

  const onRenderTab = useCallback((node: TabNode, renderValues: { leading: React.ReactNode; content: React.ReactNode; buttons: React.ReactNode[] }) => {
    const panelId = node.getComponent();
    if (panelId) {
      const key = PANEL_NAME_KEYS[panelId];
      if (key) {
        renderValues.content = translations[locale]?.[key] ?? translations.en[key];
      }
    }
  }, [locale]);

  return (
    <Layout
      model={modelRef.current}
      factory={factory}
      onRenderTab={onRenderTab}
      onAction={handleAction}
      onModelChange={saveLayout}
    />
  );
}

const RESET_FLAG = 'terminal-layout-reset';

export function resetLayout() {
  localStorage.setItem(RESET_FLAG, '1');
  const nonDefaultPanels = ALL_PANEL_IDS.filter(id => !DEFAULT_PANEL_IDS.has(id));
  useAppStore.setState({ hiddenPanels: nonDefaultPanels });
  window.location.reload();
}

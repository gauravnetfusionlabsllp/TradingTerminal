import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { lazyRoute } from './lib/lazy-route.js';
import path from 'path';
import { fileURLToPath } from 'url';
import stocksRouter from './routes/stocks.js';
import watchlistRouter from './routes/watchlist.js';
import sectorsRouter from './routes/sectors.js';
import calendarRouter from './routes/calendar.js';
import alertsRouter from './routes/alerts.js';
import workspacesRouter from './routes/workspaces.js';
import optionsRouter from './routes/options.js';
import insidersRouter from './routes/insiders.js';
import correlationsRouter from './routes/correlations.js';
import authRouter from './routes/auth.js';
import mt5Router from './routes/mt5.js';
import streamsRouter from './routes/streams.js';
import marketMoversRouter from './routes/market-movers.js';
import forexRouter from './routes/forex.js';
import bondsRouter from './routes/bonds.js';
import commoditiesRouter from './routes/commodities.js';
import globalMarketsRouter from './routes/global-markets.js';
import scannerRouter from './routes/scanner.js';
import screenerRouter from './routes/screener.js';
import heatMapRouter from './routes/heat-map.js';
import etfRouter from './routes/etf.js';
import dividendsRouter from './routes/dividends.js';
import ipoRouter from './routes/ipo.js';
import breadthRouter from './routes/breadth.js';
import analystRouter from './routes/analyst.js';
import financialsRouter from './routes/financials.js';
import futuresRouter from './routes/futures.js';
import comparisonRouter from './routes/comparison.js';
import shortInterestRouter from './routes/short-interest.js';
import fxConverterRouter from './routes/fx-converter.js';
import pivotPointsRouter from './routes/pivot-points.js';
import companyProfileRouter from './routes/company-profile.js';
import pairsRouter from './routes/pairs.js';
import fibonacciRouter from './routes/fibonacci.js';
import volatilityRouter from './routes/volatility.js';
import relativeStrengthRouter from './routes/relative-strength.js';
import fxCrossRouter from './routes/fx-cross.js';
import yieldCurveRouter from './routes/yield-curve.js';
import currencyStrengthRouter from './routes/currency-strength.js';
import moneyFlowRouter from './routes/money-flow.js';
import { attachUser } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';

// ── CORS allowlist (configure via ALLOWED_ORIGINS env var in production) ──
const ALLOWED_ORIGINS: (string | RegExp)[] = isProd
  ? (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  : [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];

// ── Rate limiters ──
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 120,              // 120 requests per minute (matches CLAUDE.md spec)
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                    // 10 auth attempts per 15 min
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
});

export function createApp() {
  const app = express();

  // Arrival time for MT5 latency (mt5.ts): everything from here on, auth lookup included, counts as node time
  app.use('/api/mt5', (_req, res, next) => { res.locals.t0 = performance.now(); next(); });

  // ── Trust Cloud Run proxy ──
  app.set('trust proxy', isProd ? 1 : false);

  // Support BigInt serialization in JSON responses
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? Number(value) : value,
  );

  // ── Security headers ──
  app.use(helmet({
    contentSecurityPolicy: isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://s.ytimg.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'self'", "https://www.youtube.com"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));

  // ── CORS ──
  app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600, // Cache preflight for 1h
  }));

  app.use(compression({ threshold: 1024 })); // Gzip responses > 1KB
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' })); // Cap body size
  app.use(attachUser);
  app.use(globalLimiter);

  // ── Cache-Control for data API routes ──
  // Market-data routes cache their upstream results server-side; browsers may reuse a copy only briefly,
  // or panels that refetch every 60s would keep showing hour-old quotes and calendar actuals.
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for per-user, mutation and streaming endpoints (req.path is relative to /api)
    const skip = ['/auth', '/mt5', '/streams', '/watchlist', '/alerts', '/workspaces'];
    if (req.method !== 'GET' || skip.some(p => req.path.startsWith(p))) {
      res.setHeader('Cache-Control', 'no-store'); // per-user / live data: never reuse a stored copy
      return next();
    }
    res.setHeader('Cache-Control', 'public, max-age=30');
    next();
  });

  // ── Routes ──

  // Auth routes — stricter rate limit on the login attempt itself (not /me)
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/mt5', mt5Router);
  app.use('/api/streams', streamsRouter);
  app.use('/api/stocks', stocksRouter);
  app.use('/api/watchlist', watchlistRouter);
  app.use('/api/sectors', sectorsRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/options', optionsRouter);
  app.use('/api/insiders', insidersRouter);
  app.use('/api/correlations', correlationsRouter);
  app.use('/api/market-movers', marketMoversRouter);
  app.use('/api/forex', forexRouter);
  app.use('/api/bonds', bondsRouter);
  app.use('/api/commodities', commoditiesRouter);
  app.use('/api/global-markets', globalMarketsRouter);
  app.use('/api/scanner', scannerRouter);
  app.use('/api/screener', screenerRouter);
  app.use('/api/heat-map', heatMapRouter);
  app.use('/api/etf', etfRouter);
  app.use('/api/dividends', dividendsRouter);
  app.use('/api/ipo', ipoRouter);
  app.use('/api/breadth', breadthRouter);
  app.use('/api/analyst', analystRouter);
  app.use('/api/financials', financialsRouter);
  app.use('/api/futures', futuresRouter);
  app.use('/api/comparison', comparisonRouter);
  app.use('/api/short-interest', shortInterestRouter);
  app.use('/api/fx-rates', fxConverterRouter);
  app.use('/api/pivot-points', pivotPointsRouter);
  app.use('/api/company-profile', companyProfileRouter);
  app.use('/api/pairs', pairsRouter);
  app.use('/api/fibonacci', fibonacciRouter);
  app.use('/api/volatility', volatilityRouter);
  app.use('/api/relative-strength', relativeStrengthRouter);
  app.use('/api/fx-cross', fxCrossRouter);
  app.use('/api/yield-curve', yieldCurveRouter);
  app.use('/api/currency-strength', currencyStrengthRouter);
  app.use('/api/money-flow', moneyFlowRouter);

  // ── Lazy-loaded panel routes (loaded on first request to save startup memory) ──
  const panelRoutes: [string, () => Promise<{ default: any }>][] = [
    ['earnings-estimates', () => import('./routes/earnings-estimates.js')],
    ['cross-asset', () => import('./routes/cross-asset.js')],
    ['holdings', () => import('./routes/holdings.js')],
    ['sector-performance', () => import('./routes/sector-performance.js')],
    ['etf-holdings', () => import('./routes/etf-holdings.js')],
    ['drawdown', () => import('./routes/drawdown.js')],
    ['market-regime', () => import('./routes/market-regime.js')],
    ['relative-valuation', () => import('./routes/relative-valuation.js')],
    ['confluence', () => import('./routes/confluence.js')],
    ['iv-surface', () => import('./routes/iv-surface.js')],
    ['seasonality', () => import('./routes/seasonality.js')],
    ['order-flow', () => import('./routes/order-flow.js')],
    ['portfolio-optimizer', () => import('./routes/portfolio-optimizer.js')],
    ['backtest', () => import('./routes/backtest.js')],
    ['macro-dashboard', () => import('./routes/macro-dashboard.js')],
    ['earnings-surprise', () => import('./routes/earnings-surprise.js')],
    ['futures-curve', () => import('./routes/futures-curve.js')],
    ['credit-spreads', () => import('./routes/credit-spreads.js')],
    ['intermarket', () => import('./routes/intermarket.js')],
    ['sector-heatmap', () => import('./routes/sector-heatmap.js')],
    ['economic-surprises', () => import('./routes/economic-surprises.js')],
    ['dispersion', () => import('./routes/dispersion.js')],
    ['fund-flows', () => import('./routes/fund-flows.js')],
    ['vol-term-structure', () => import('./routes/vol-term-structure.js')],
    ['macro-heatmap', () => import('./routes/macro-heatmap.js')],
    ['factor-exposure', () => import('./routes/factor-exposure.js')],
    ['capital-flows', () => import('./routes/capital-flows.js')],
    ['tail-risk', () => import('./routes/tail-risk.js')],
    ['liquidity', () => import('./routes/liquidity.js')],
    ['sentiment-dashboard', () => import('./routes/sentiment-dashboard.js')],
    ['market-anomalies', () => import('./routes/market-anomalies.js')],
    ['carry-trade', () => import('./routes/carry-trade.js')],
    ['iv-rank', () => import('./routes/iv-rank.js')],
    ['positioning', () => import('./routes/positioning.js')],
    ['style-box', () => import('./routes/style-box.js')],
    ['valuation-multiples', () => import('./routes/valuation-multiples.js')],
    ['insider-sentiment', () => import('./routes/insider-sentiment.js')],
    ['earnings-whisper', () => import('./routes/earnings-whisper.js')],
    ['global-supply-chain', () => import('./routes/global-supply-chain.js')],
    ['market-breadth', () => import('./routes/market-breadth.js')],
  ];
  for (const [routePath, importFn] of panelRoutes) {
    app.use(`/api/${routePath}`, lazyRoute(importFn));
  }

  // Health check (excluded from rate limit above)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Global error handler ──
  app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal server error';
    if (status >= 500) {
      console.error(`[Error] ${status} — ${message}`);
    }
    res.status(status).json({
      error: isProd && status >= 500 ? 'Internal server error' : message,
    });
  });

  // Static files — serve client build in production
  const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist, {
    maxAge: isProd ? '1y' : 0,
    immutable: isProd, // Content-hashed filenames never change
    etag: true,
  }));

  // SPA fallback — serve index.html for all non-API routes
  // index.html must NOT be cached long-term (it references hashed JS/CSS bundles)
  app.get('/{*splat}', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}

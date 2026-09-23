import { prisma } from './prisma.js';

const defaultStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
  { symbol: 'BTC-USD', name: 'Bitcoin USD' },
];

export async function seedDatabase() {
  console.log('[Seed] Seeding database...');

  for (const stock of defaultStocks) {
    await prisma.trackedStock.upsert({
      where: { symbol: stock.symbol },
      update: stock,
      create: { ...stock, source: 'default' },
    });
  }
  console.log(`[Seed] ${defaultStocks.length} tracked stocks`);
}

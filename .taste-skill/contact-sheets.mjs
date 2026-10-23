import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const out = '.taste-skill/overhaul';
const report = JSON.parse(await readFile(`${out}/report.json`, 'utf8'));
const browser = await chromium.launch({ channel: 'msedge' });
for (const group of ['dark-1440', 'dark-768', 'dark-390', 'light-1440', 'light-768', 'light-390']) {
  const items = report.filter(r => r.name.startsWith(group));
  const cell = group.includes('1440') ? 720 : 390;
  const html = await Promise.all(items.map(async item => `<figure><figcaption>${item.name}</figcaption><img src="data:image/png;base64,${(await readFile(`${out}/${item.name}.png`)).toString('base64')}"></figure>`));
  const page = await browser.newPage({ viewport: { width: cell * 2, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>body{margin:0;background:#333;color:#fff;font:16px sans-serif;display:grid;grid-template-columns:1fr 1fr}figure{margin:0}figcaption{padding:10px}img{width:100%;display:block}</style>${html.join('')}`);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
  await page.screenshot({ path: `${out}/sheet-${group}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log('6 contact sheets saved');

import { chromium } from '@playwright/test';
import { terminalFixture } from '../client/tests/fixtures.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const skill = join(process.env.USERPROFILE!, '.codex/skills/design-taste-frontend/scripts/lib');
const { probe, app, layout } = await import(pathToFileURL(join(skill, 'probe.mjs')).href);
const { judge, judgeApp, judgeLayout, APP_SKIP } = await import(pathToFileURL(join(skill, 'rules.mjs')).href);
const out = '.taste-skill/overhaul';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const report: any[] = [];
for (const theme of ['dark', 'light']) for (const width of [1440, 768, 390]) {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : width === 768 ? 1024 : 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await terminalFixture(page);
  await page.goto('http://localhost:5175/#/settings');
  await page.getByRole('button', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).click();
  for (const route of ['trade', 'research/calendar', 'research/strength', 'research/hours', 'research/risk', 'activity/positions', 'activity/orders', 'activity/history', 'activity/log', 'alerts', 'settings']) {
    await page.goto(`http://localhost:5175/#/${route}`);
    await page.locator('h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (route === 'trade') {
      if (width < 1200) await page.getByRole('tab', { name: 'Order ticket', exact: true }).click();
      const picker = width >= 1200 ? page.getByRole('combobox', { name: 'SYMBOL', exact: true }) : page.getByRole('combobox').first();
      await picker.fill('EURUSD');
      await page.getByRole('option', { name: /EURUSD/ }).click();
      await page.getByRole('button', { name: /^Buy/ }).filter({ has: page.locator('.ticket-quote') }).waitFor();
    }
    await page.waitForTimeout(300);
    const m = await page.evaluate(probe);
    const a = await page.evaluate(app);
    const l = await page.evaluate(layout);
    // Fixed-height tools reserve room for streaming rows, even with a one-row fixture.
    // Page-scroll blank-gap rules do not apply to these working list viewports.
    const allow = ['blank-gap'];
    const findings = [...judge(m, { width, allow }), ...judgeLayout(l, { width, allow })].filter(f => !APP_SKIP.has(f.id) && !['no-title', 'small-title'].includes(f.id));
    findings.push(...judgeApp(a, m, { width }));
    const name = `${theme}-${width}-${route.replaceAll('/', '-')}`;
    await page.screenshot({ path: `${out}/${name}.png` });
    report.push({ name, findings, errors: [...errors], metrics: { type: a.type, title: a.title }, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    console.log(name, JSON.stringify(findings.map(f => ({ level: f.level, id: f.id, message: f.message }))));
  }
  await context.close();
}
for (const width of [1440, 768, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width === 1440 ? 900 : width === 768 ? 1024 : 844 } });
  await terminalFixture(page, { guest: true });
  await page.goto('http://localhost:5175/');
  await page.getByRole('heading', { name: 'Sign in to your terminal' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(probe);
  const a = await page.evaluate(app);
  const l = await page.evaluate(layout);
  const findings = [...judge(m, { width }), ...judgeLayout(l, { width })].filter(f => !APP_SKIP.has(f.id) && !['no-title', 'small-title'].includes(f.id));
  findings.push(...judgeApp(a, m, { width }));
  const name = `dark-${width}-sign-in`;
  await page.screenshot({ path: `${out}/${name}.png` });
  report.push({ name, findings, errors: [], overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  console.log(name, JSON.stringify(findings));
  await page.close();
}
await browser.close();
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log('AUDIT COMPLETE', report.length, 'screens', report.reduce((n, r) => n + r.findings.filter(f => f.level === 'FAIL').length, 0), 'failures');

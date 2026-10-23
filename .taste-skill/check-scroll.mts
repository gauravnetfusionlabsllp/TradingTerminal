import { chromium } from '@playwright/test';
import { terminalFixture } from '../client/tests/fixtures';
const browser = await chromium.launch({channel:'msedge'});
const page = await browser.newPage({viewport:{width:390,height:650}});
await terminalFixture(page);
await page.goto('http://localhost:5175/#/research/strength');
await page.locator('.strength-row').last().waitFor();
console.log(await page.locator('.strength-row').last().evaluate(el => {
  const rows=[];
  for(let p:Element|null=el;p;p=p.parentElement){const s=getComputedStyle(p);rows.push({class:p.className,height:p.clientHeight,scroll:p.scrollHeight,overflow:s.overflow,heightStyle:s.height});}
  return rows;
}));
await browser.close();

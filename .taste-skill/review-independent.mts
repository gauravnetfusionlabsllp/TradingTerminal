import { chromium } from '@playwright/test';
import { terminalFixture } from '../client/tests/fixtures';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:390,height:800}}); await terminalFixture(page);
await page.goto('http://localhost:5175/#/research/risk'); await page.waitForTimeout(700);
const input=page.locator('.risk-input input').first();
for(const focus of [false,true]){if(focus)await input.focus(); console.log('focus',focus,await input.evaluate(el=>({outline:getComputedStyle(el).outline,border:getComputedStyle(el).border,parentOutline:getComputedStyle(el.parentElement!).outline,parentBorder:getComputedStyle(el.parentElement!).border})));}
await page.goto('http://localhost:5175/#/trade'); await page.waitForTimeout(700);
console.log('chartoverflow',await page.evaluate(()=>Array.from(document.querySelectorAll('.chart-toolbar *')).filter(el=>el.getBoundingClientRect().right>390).map(el=>({cls:el.className,text:el.textContent,label:el.getAttribute('aria-label'),right:el.getBoundingClientRect().right}))));
await page.screenshot({path:'.taste-skill/review-chart.png'});
await browser.close();

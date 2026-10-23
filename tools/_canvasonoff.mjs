/**
 * SCRATCH (delete at cleanup): are the marks in the margin the field's?
 *
 * A screenshot cannot say whether a dot was drawn by the canvas or by the
 * page, so the canvas is switched off and the same frame is taken again. If
 * the dot survives, it is the page's; if it goes, it is the field's - and
 * then the question is whether it should have been quieted away.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { baseUrl } from './base-url.mjs';

const OUT = process.env.OUT ?? 'C:/Users/LENOVO/AppData/Local/Temp/opencode/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false, args: ['--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = await baseUrl();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('theme', t);
  }, theme);
  await page.waitForTimeout(700);
  await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), Math.round(H * 0.55));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/canvason-${theme}.png` });
  const shown = await page.evaluate(() => {
    const c = document.querySelector('#motes');
    if (!c) return 'no canvas';
    c.style.visibility = 'hidden';
    return `${c.tagName}#${c.id}`;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/canvasoff-${theme}.png` });
  await page.evaluate(() => {
    const c = document.querySelector('#motes');
    if (c) c.style.visibility = '';
  });
  console.log(`${theme}: hid ${shown}`);
}
await browser.close();

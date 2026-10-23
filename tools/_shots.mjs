/**
 * SCRATCH (delete at cleanup): screenshots of the built page for eyeballing.
 *
 * The efficiency pass changed how rectangles are *stored*, not what is drawn,
 * so the evidence that it did not change the drawing has to be a picture:
 * the field still quieting behind type, the stillness behind the opening,
 * both themes, at rest and mid-journey.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const OUT = process.env.OUT ?? 'C:/Users/LENOVO/AppData/Local/Temp/opencode/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false, args: ['--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const H = await (async () => {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  return page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
})();

const stops = [
  ['open', 0],
  ['movement', 0.28],
  ['figures', 0.55],
  ['album', 0.82],
  ['contact', 1],
];

for (const theme of ['dark', 'light']) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('theme', t);
  }, theme);
  await page.waitForTimeout(700);
  for (const [name, f] of stops) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), Math.round(H * f));
    /* Let the field place itself and the reveals settle before the shutter. */
    await page.waitForTimeout(1400);
    await page.mouse.move(700, 420);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${theme}-${name}.png` });
  }
}

console.log(`base ${BASE}  height ${H}px`);
console.log(`console errors: ${errors.length} ${JSON.stringify(errors.slice(0, 3))}`);
await browser.close();

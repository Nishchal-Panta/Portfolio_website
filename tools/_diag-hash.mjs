/**
 * Scratch: what actually scrolls during a hashed load.
 *
 * The arrival probe showed the target never moving into view although focus
 * landed on it. This records every scroll the page reports, plus the events
 * that could account for one, so the abort is attributed to something rather
 * than guessed at.
 *
 *   node tools/_diag-hash.mjs "#cred-relay-hack"
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const hash = process.argv.slice(2).find((h) => h.startsWith('#')) ?? '#cred-relay-hack';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.addInitScript(() => {
  const log = [];
  window.__log = log;
  const mark = (what, extra) => log.push([what, Math.round(scrollY), performance.now() | 0, extra]);
  addEventListener('DOMContentLoaded', () => mark('domready'));
  addEventListener('load', () => mark('load'));
  addEventListener('hashchange', () => mark('hashchange', location.hash));
  addEventListener('scroll', () => mark('scroll'), { passive: true });
  addEventListener('scrollend', () => mark('scrollend'));
});

await page.goto(BASE + hash, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const log = await page.evaluate(() => window.__log);
console.log(`${hash}  - ${log.length} events`);
for (const e of log.slice(0, 60)) console.log('  ', e.join('  '));
if (log.length > 60) console.log(`   ... ${log.length - 60} more`);

await browser.close();

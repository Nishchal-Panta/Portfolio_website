/* TEMPORARY diagnostic: why do field.speeds() star readings come back zero?
   Reports the real shape of every debug getter during a forced scroll, so the
   scrollmode A/B stops measuring a metric that never moves. */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';

const URL_ = process.argv[2] || `${await baseUrl()}/?clock=60`;
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.addInitScript(`localStorage.setItem('theme', 'dark');`);
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(URL_, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const before = await page.evaluate(() => ({
  keys: Object.keys(window.__field || {}),
  speedsType: Object.prototype.toString.call(window.__fieldSpeeds),
  speeds: window.__fieldSpeeds,
  particles: (window.__fieldParticles || []).length,
  starVel: Object.prototype.toString.call(window.__fieldStarVel),
  starVelSample: window.__fieldStarVel ? Array.from(window.__fieldStarVel).slice(0, 6) : null,
  state: window.__field,
  maxSpeed: window.__field?.maxSpeed,
  influenced: window.__field?.influenced,
  scrollVel: window.__field?.scrollVel,
}));

/* Force real motion: a long fast scroll, then read again. */
const during = await page.evaluate(async () => {
  const rows = [];
  for (let i = 0; i < 40; i++) {
    window.scrollTo({ top: (i + 1) * 150, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(r));
    const sp = window.__fieldSpeeds;
    rows.push({
      starMax: sp && sp.star ? Math.max(...sp.star) : null,
      starLen: sp && sp.star ? sp.star.length : null,
      shapeMax: sp && sp.shape ? Math.max(...sp.shape) : null,
      maxSpeed: window.__field?.maxSpeed,
      influenced: window.__field?.influenced,
      scrollVel: window.__field?.scrollVel,
    });
  }
  return rows;
});

console.log(`\nurl: ${URL_}`);
console.log('\n=== before any scroll ===');
console.log(JSON.stringify(before, null, 2));
console.log('\n=== during 40 x 150px instant scrolls (first 8 and last 4) ===');
console.log(during.slice(0, 8).map((r) => JSON.stringify(r)).join('\n'));
console.log('...');
console.log(during.slice(-4).map((r) => JSON.stringify(r)).join('\n'));

/* Positions at a fixed scroll: if these differ between ?clock and no ?clock,
   the clock really changes the field; if they match, only the speed metric
   does - which would mean the metric is what is broken, not the clock. */
await page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' }));
await page.waitForTimeout(1500);
const pos = await page.evaluate(() => Array.from(window.__fieldParticles || []).slice(0, 5));
const st = await page.evaluate(() => ({ maxSpeed: window.__field?.maxSpeed, scroll: window.__field?.scroll }));
console.log(`\nfirst 5 star positions at scrollY=3000:`);
console.log('  ' + JSON.stringify(pos));
console.log('  state ' + JSON.stringify(st));
console.log(`\nconsole errors: ${errs.length}${errs.length ? ' - ' + errs.join(' | ') : ' none'}`);

await browser.close();

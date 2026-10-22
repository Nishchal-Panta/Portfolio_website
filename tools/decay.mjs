import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(`${BASE}?debug=1`, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.dispatchEvent(new Event('themechange'));
});
await p.waitForTimeout(1000);

const stats = () => p.evaluate(() => {
  const disp = window.__fieldDisp || [];
  const sp = window.__fieldSpeeds || {};
  let total = 0, worst = 0;
  for (const [x, y] of disp) { const n = Math.hypot(x, y); total += n; if (n > worst) worst = n; }
  const F = window.__field || {};
  return { total: +total.toFixed(1), worst: +worst.toFixed(2), peakFlow: F.peakFlow, infl: F.influenced,
           starMax: +(Math.max(0, ...(sp.star || []))).toFixed(1),
           px: String(F.pointerXY), svel: F.scrollVel };
});

await p.mouse.move(200, 450);
await p.waitForTimeout(800);
for (let i = 0; i <= 30; i++) { await p.mouse.move(200 + i * 32, 450); await p.waitForTimeout(16); }
console.log('end of sweep ', JSON.stringify(await stats()));

// leave gently, then watch
for (let i = 0; i <= 20; i++) { await p.mouse.move(1160 - (1156 * i) / 20, 450 - (446 * i) / 20); await p.waitForTimeout(24); }
console.log('after leave  ', JSON.stringify(await stats()));
for (let k = 1; k <= 12; k++) {
  await p.waitForTimeout(250);
  console.log(`t=${(k * 250).toString().padStart(4)}ms `, JSON.stringify(await stats()));
}
await b.close();

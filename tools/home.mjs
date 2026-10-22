import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();

const b = await chromium.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(`${BASE}?debug=1`, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.dispatchEvent(new Event('themechange'));
});
await p.waitForTimeout(1200);

const s = () => p.evaluate(() => {
  const disp = window.__fieldDisp || [];
  const pos = window.__fieldParticles || [];
  let worst = 0, wi = -1, total = 0;
  for (let i = 0; i < disp.length; i++) {
    const n = Math.hypot(disp[i][0], disp[i][1]);
    total += n;
    if (n > worst) { worst = n; wi = i; }
  }
  const F = window.__field || {};
  let fmax = 0, fsum = 0, fn = 0;
  // peak flow + how many cells still carry meaningful velocity
  return { worst: +worst.toFixed(2), total: +total.toFixed(0),
           at: wi >= 0 ? [Math.round(pos[wi][0]), Math.round(pos[wi][1])] : null,
           peakFlow: F.peakFlow, infl: F.influenced,
           speed: +(Math.max(0, ...(window.__fieldSpeeds?.star || []))).toFixed(1) };
});

await p.mouse.move(300, 815);
await p.waitForTimeout(800);
for (let i = 0; i <= 30; i++) { await p.mouse.move(300 + i * 30, 815); await p.waitForTimeout(16); }
console.log('end sweep', JSON.stringify(await s()));
for (let i = 0; i <= 20; i++) { await p.mouse.move(1200 - (900 * i) / 20, 815 - (811 * i) / 20); await p.waitForTimeout(24); }
console.log('leave    ', JSON.stringify(await s()));
for (let k = 1; k <= 14; k++) {
  await p.waitForTimeout(200);
  console.log(`t=${(k * 200).toString().padStart(4)}ms`, JSON.stringify(await s()));
}
await b.close();

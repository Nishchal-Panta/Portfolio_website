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

// Alpha of field pixels within r of the cursor vs far from it.
const probe = () => p.evaluate(() => {
  const c = document.getElementById('motes');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const F = window.__field || {};
  const [px, py] = String(F.pointerXY || '0,0').split(',').map(Number);
  const dpr = c.width / parseFloat(getComputedStyle(c).width);
  let near = 0, nearN = 0, far = 0, farN = 0;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      const a = d[(y * c.width + x) * 4 + 3];
      if (a <= 6) continue;
      const cx = x / dpr, cy = y / dpr;
      if (Math.hypot(cx - px, cy - py) < 220) { near += a; nearN++; }
      else if (Math.hypot(cx - px, cy - py) > 420) { far += a; farN++; }
    }
  }
  return { nearMean: nearN ? +(near / nearN).toFixed(1) : 0, nearN,
           farMean: farN ? +(far / farN).toFixed(1) : 0, farN,
           peakFlow: F.peakFlow, infl: F.influenced,
           speed: +(Math.max(0, ...(window.__fieldSpeeds?.star || []))).toFixed(1) };
});

await p.mouse.move(300, 815);
await p.waitForTimeout(900);
console.log('idle   ', JSON.stringify(await probe()));
for (let i = 0; i < 6; i++) {
  await p.mouse.move(300 + i * 90, 815);
  await p.waitForTimeout(60);
  console.log(`sweep${i}`, JSON.stringify(await probe()));
}
await p.mouse.move(840, 815);
await p.waitForTimeout(40);
console.log('held   ', JSON.stringify(await probe()));
await b.close();

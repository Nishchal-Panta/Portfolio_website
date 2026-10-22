import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(`${BASE}?debug=1`, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
console.log(await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const pos = window.__fieldParticles ?? [];
  const ys = pos.map((q) => q[1]).sort((a, b) => a - b);
  return {
    canvas: c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null,
    dpr: window.devicePixelRatio,
    n: pos.length,
    yMin: ys[0], yMax: ys[ys.length - 1],
    yMid: ys[Math.floor(ys.length / 2)],
    debugRows: document.getElementById('debug-list')?.textContent?.slice(0, 400),
  };
}));
await b.close();

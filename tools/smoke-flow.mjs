import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const URL = `${BASE}?debug=1`;
const SHOT = 'C:/Users/LENOVO/AppData/Local/Temp/opencode/shots';

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

async function snap(tag) {
  return await p.evaluate(() => {
    const F = window.__field ?? {};
    const sp = window.__fieldSpeeds ?? { node: [], star: [] };
    const pos = window.__fieldParticles ?? [];
    const disp = window.__fieldDisp ?? [];
    const all = [...sp.star, ...sp.node];
    const max = all.length ? Math.max(...all) : 0;
    const sorted = [...all].sort((a, b2) => a - b2);
    return {
      peakFlow: F.peakFlow, influenced: F.influenced, mix: F.mix, fps: F.fps,
      maxSpeed: max, p95: sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0,
      pos, disp, n: pos.length,
      maxDisp: disp.length ? Math.max(...disp.map((d) => Math.hypot(d[0], d[1]))) : 0,
    };
  });
}

// DARK theme
await p.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.dispatchEvent(new Event('themechange'));
});
await p.waitForTimeout(900);
await p.mouse.move(700, 450);
const before = await snap('dark-before');
console.log('dark idle    ', JSON.stringify({ peakFlow: before.peakFlow, maxSpeed: +before.maxSpeed.toFixed(1), p95: +before.p95.toFixed(1), maxDisp: +before.maxDisp.toFixed(2), n: before.n }));

// Record a rightward sweep at ~1400 px/s
const sweep = [];
const t0 = Date.now();
for (let i = 0; i <= 30; i++) {
  const x = 200 + i * 32;
  await p.mouse.move(x, 450);
  const s = await snap();
  sweep.push({ t: Date.now() - t0, peakFlow: +s.peakFlow.toFixed(1), maxSpeed: +s.maxSpeed.toFixed(1), influenced: s.influenced });
}
console.log('dark sweep   ', JSON.stringify(sweep.filter((_, i) => i % 6 === 0)));

// Wake correlation: displace particles and check cosine similarity of neighbours
const corr = await p.evaluate(() => {
  const pos = window.__fieldParticles ?? [];
  const disp = window.__fieldDisp ?? [];
  const pairs = [];
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]);
      if (d > 120) continue;
      const a = disp[i], b = disp[j];
      const na = Math.hypot(a[0], a[1]), nb = Math.hypot(b[0], b[1]);
      if (na < 0.5 || nb < 0.5) continue;
      pairs.push((a[0] * b[0] + a[1] * b[1]) / (na * nb));
    }
  }
  return { n: pairs.length, meanCos: pairs.length ? pairs.reduce((a, b) => a + b, 0) / pairs.length : null };
});
console.log('dark wake    ', JSON.stringify(corr));

// Curl at wake edge
const curl = await p.evaluate(() => window.__field?.flowCurl?.(820, 450));
console.log('dark curl@edge', curl);

// Return
const ret = [];
for (const ms of [500, 1000, 2000, 2500, 3000]) {
  await p.waitForTimeout(ms - (ret.length ? ret[ret.length - 1].t : 0));
  const s = await snap();
  ret.push({ t: ms, maxDisp: +s.maxDisp.toFixed(2), maxSpeed: +s.maxSpeed.toFixed(1) });
}
console.log('dark return  ', JSON.stringify(ret));

await p.screenshot({ path: SHOT + '/smoke-dark.png' });

// LIGHT theme
await p.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  document.dispatchEvent(new Event('themechange'));
});
await p.waitForTimeout(900);
await p.mouse.move(200, 450);
const lbefore = await snap();
console.log('light idle   ', JSON.stringify({ maxSpeed: +lbefore.maxSpeed.toFixed(1), n: lbefore.n, mix: lbefore.mix }));
const lsweep = [];
const t1 = Date.now();
for (let i = 0; i <= 30; i++) {
  await p.mouse.move(200 + i * 32, 450);
  const s = await snap();
  lsweep.push({ t: Date.now() - t1, maxSpeed: +s.maxSpeed.toFixed(1), peakFlow: +s.peakFlow.toFixed(1), influenced: s.influenced });
}
console.log('light sweep  ', JSON.stringify(lsweep.filter((_, i) => i % 6 === 0)));
await p.screenshot({ path: SHOT + '/smoke-light.png' });

console.log('console errors:', errs.length, errs.slice(0, 5));
await b.close();

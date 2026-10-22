import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const rafOverride = (hz) => `
  (() => {
    const period = 1000 / ${hz};
    let next = performance.now() + period;
    const timers = new Set();
    window.requestAnimationFrame = (cb) => {
      const id = setTimeout(() => {
        timers.delete(id);
        next = performance.now() + period;
        cb(performance.now());
      }, Math.max(0, next - performance.now()));
      timers.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => { clearTimeout(id); timers.delete(id); };
  })();
`;

const b = await chromium.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

for (const hz of [60, 144]) {
  const p = await ctx.newPage();
  await p.addInitScript({ content: rafOverride(hz) });
  await p.goto(`${BASE}/?debug=1`, { waitUntil: 'load' });
  await p.evaluate(() => { try { localStorage.setItem('theme', 'light'); } catch (e) {} });
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(2000);

  const pos = () => p.evaluate(() => (window.__fieldParticles || []).map((q) => [q[0], q[1]]));
  let prev = await pos();
  let total = 0, maxJump = 0, jumps = 0, frames = 0;
  const until = Date.now() + 4000;
  while (Date.now() < until) {
    await p.waitForTimeout(100);
    const now = await pos();
    for (let i = 0; i < Math.min(prev.length, now.length); i++) {
      const d = Math.hypot(now[i][0] - prev[i][0], now[i][1] - prev[i][1]);
      total += d;
      if (d > maxJump) maxJump = d;
      if (d > 60) { jumps++; if (jumps < 4) console.log(`   jump i=${i} d=${d.toFixed(0)} ${prev[i].map(Math.round)} -> ${now[i].map(Math.round)}`); }
    }
    frames++;
    prev = now;
  }
  const dbg = await p.evaluate(() => ({ nodes: window.__field?.nodes, fps: window.__field?.fps, speed: window.__field?.maxSpeed }));
  console.log(`${hz}Hz  total=${total.toFixed(0)}px  maxJump=${maxJump.toFixed(0)}px  jumps>60=${jumps}  samples=${frames}  ${JSON.stringify(dbg)}`);
  await p.close();
}
await b.close();

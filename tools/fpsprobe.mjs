/**
 * Frame rate the browser is actually giving us, headed, per engine.
 *
 * The sim runs on a fixed 1/60s step caught up by elapsed ticks, capped at 6
 * catch-up steps. If a browser throttles rAF while the window is unfocused, the
 * sim falls behind wall-clock time and every time-based assertion (wake decay,
 * return-to-home) fails for a reason that has nothing to do with the design.
 * This prints the numbers before blaming the physics.
 */
import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const URL = `${BASE}?debug=1`;

const measure = async (engine, name) => {
  const b = await engine.launch({ headless: false });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.bringToFront();
  await p.waitForTimeout(800);

  const sample = async (label) => {
    const r = await p.evaluate(
      () =>
        new Promise((res) => {
          let n = 0;
          const t0 = performance.now();
          const tick = () => {
            n++;
            if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
            else res({ fps: +((n * 1000) / (performance.now() - t0)).toFixed(1), n });
          };
          requestAnimationFrame(tick);
        })
    );
    console.log(`${name} ${label}: fps=${r.fps} frames=${r.n}`);
    return r;
  };

  const a = await sample('idle   ');
  // Now drive the pointer the way the wake test does.
  for (let i = 0; i <= 30; i++) {
    await p.mouse.move(200 + i * 32, 450);
    await p.waitForTimeout(16);
  }
  const c = await sample('post-sweep');
  const dbg = await p.evaluate(() => {
    const el = document.getElementById('debug-overlay');
    return el ? el.innerText.slice(0, 400) : '(no overlay)';
  });
  console.log(`${name} overlay:\n${dbg.split('\n').filter((l) => /fps|build|node/i.test(l)).join('\n')}`);
  await b.close();
  return { name, idle: a.fps, sweep: c.fps };
};

const out = [];
out.push(await measure(chromium, 'chromium'));
out.push(await measure(firefox, 'firefox   '));
console.log('\nsummary', JSON.stringify(out));

/**
 * How quickly each engine delivers a scripted pointer sweep, as seen from
 * inside the page.
 *
 * The wake test moves the pointer on a fixed wall-clock schedule. If an engine
 * batches or delays those events, the flow is injected later than the sampling
 * schedule assumes and the decay assertions measure the wrong window. This
 * counts pointermove events and reports when they arrived.
 */
import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const URL = `${BASE}?debug=1`;

const run = async (engine, name) => {
  const b = await engine.launch({ headless: false });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.bringToFront();
  await p.waitForTimeout(600);

  await p.evaluate(() => {
    const log = (window.__ptrLog = { events: [], t0: performance.now() });
    /* mousemove only: recording both it and pointermove would double every
       sample and make the gaps meaningless. */
    const rec = (e) => log.events.push([+(performance.now() - log.t0).toFixed(1), e.clientX, e.clientY]);
    window.addEventListener('mousemove', rec, { passive: true });
  });

  // The sweep exactly as the wake test does it.
  const sweep0 = await p.evaluate(() => performance.now());
  for (let i = 0; i <= 30; i++) {
    await p.mouse.move(200 + i * 32, 450);
    await p.waitForTimeout(16);
  }
  const sweepMs = await p.evaluate((t0) => performance.now() - t0, sweep0);
  const sweep = await p.evaluate(() => window.__ptrLog.events.length);

  await p.waitForTimeout(700);
  const mark = await p.evaluate(() => window.__ptrLog.events.length);

  const leave0 = await p.evaluate(() => performance.now());
  for (let i = 0; i <= 20; i++) {
    await p.mouse.move(1160 - (1156 * i) / 20, 450 - (446 * i) / 20);
    await p.waitForTimeout(24);
  }
  const leaveMs = await p.evaluate((t0) => performance.now() - t0, leave0);
  const afterLeave = await p.evaluate(() => window.__ptrLog.events.length);

  const stats = await p.evaluate(() => {
    const ev = window.__ptrLog.events;
    const gaps = [];
    for (let i = 1; i < ev.length; i++) gaps.push(ev[i][0] - ev[i - 1][0]);
    gaps.sort((a, b) => a - b);
    const q = (f) => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(f * gaps.length))] : 0);
    return {
      total: ev.length,
      first: ev[0]?.[0],
      last: ev[ev.length - 1]?.[0],
      medianGap: +q(0.5).toFixed(1),
      p95Gap: +q(0.95).toFixed(1),
      maxGap: +gaps[gaps.length - 1]?.toFixed(1),
      // Batching shows up as few events with big gaps.
      bursts: gaps.filter((g) => g > 100).length,
    };
  });

  console.log(
    `${name}\n  sweep: ${sweep} events over ${sweepMs.toFixed(0)}ms` +
      `\n  leave: ${afterLeave - mark} events over ${leaveMs.toFixed(0)}ms` +
      `\n  ${JSON.stringify(stats)}`
  );
  await b.close();
};

await run(chromium, 'chromium');
await run(firefox, 'firefox');

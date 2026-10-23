/**
 * SCRATCH (delete at cleanup): two questions the suite could not answer.
 *
 *  1. Does the blur pause actually pause? `idlePass` in profile-page.mjs
 *     reported "0 tasks" while ScriptDuration still rose, which means the
 *     window was focused and the field kept running - so the idle target was
 *     measured on a page that was never unfocused.
 *  2. What is the field's share of the throttled frame? Running the same 4x
 *     scroll with the field paused and with it running separates the cost of
 *     the design from the cost of the page.
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const CPU = Number(process.env.CPU ?? 4);

const browser = await chromium.launch({
  headless: false,
  args: ['--enable-gpu-rasterization', '--disable-gpu-watchdog'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const cdp = await page.context().newCDPSession(page);
const metrics = async () => {
  const { metrics: m } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(m.map((x) => [x.name, x.value]));
};
const still = async (ms) => {
  const a = await metrics();
  await page.waitForTimeout(ms);
  const b = await metrics();
  return {
    scriptMs: (b.ScriptDuration - a.ScriptDuration) * 1000,
    taskMs: (b.TaskDuration - a.TaskDuration) * 1000,
  };
};
const state = () =>
  page.evaluate(() => ({
    focus: document.hasFocus(),
    fps: window.__field?.fps ?? null,
    paused: window.__field?.paused ?? null,
    stars: window.__field?.stars ?? null,
  }));

console.log('--- 1. does the blur pause the field? ---');
await cdp.send('Performance.enable');
console.log('  still, focused:  ', JSON.stringify(await still(3000)), JSON.stringify(await state()));
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(600);
console.log('  still, blurred:  ', JSON.stringify(await still(3000)), JSON.stringify(await state()));
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
await page.waitForTimeout(600);
console.log('  still, focused:  ', JSON.stringify(await still(3000)), JSON.stringify(await state()));
await cdp.send('Performance.disable');

/* ---- 2. the same scroll, with and without the field ---- */
const scrollPass = async (label, blurField) => {
  await cdp.send('Performance.enable');
  if (CPU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  if (blurField) await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  else await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.__prof = { frames: [], long: [] };
    let last = 0;
    const tick = (t) => {
      if (last) window.__prof.frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__prof.long.push(Math.round(e.duration));
    }).observe({ entryTypes: ['longtask'] });
  });
  const before = await metrics();

  const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const steps = 140;
  const per = height / steps;
  const t0 = Date.now();
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(per * i));
    await page.waitForTimeout(30);
    if (i % 10 === 0) await page.mouse.move(400 + (i % 5) * 40, 300);
  }
  const elapsed = Date.now() - t0;

  const after = await metrics();
  const s = await page.evaluate(() => {
    const f = window.__prof.frames.slice().sort((a, b) => a - b);
    const at = (q) => (f.length ? f[Math.min(f.length - 1, Math.floor(f.length * q))] : 0);
    return {
      n: f.length,
      p50: at(0.5),
      p95: at(0.95),
      p99: at(0.99),
      max: f[f.length - 1] ?? 0,
      long: window.__prof.long.length,
      worst: window.__prof.long.slice(-1)[0] ?? 0,
    };
  });
  if (CPU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.send('Performance.disable');
  console.log(
    `  ${label.padEnd(18)} ${elapsed}ms  frames ${s.n}  p50 ${s.p50.toFixed(1)}  p95 ${s.p95.toFixed(1)}  p99 ${s.p99.toFixed(1)}  max ${s.max.toFixed(0)}  long ${s.long} (worst ${s.worst})  script ${((after.ScriptDuration - before.ScriptDuration) * 1000).toFixed(0)}ms  style ${((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000).toFixed(0)}ms`
  );
  if (blurField) await page.evaluate(() => window.dispatchEvent(new Event('focus')));
};

console.log(`\n--- 2. one scroll @${CPU}x, field running vs field paused ---`);
await scrollPass('field running', false);
await scrollPass('field paused', true);

console.log(`\nconsole errors: ${errors.length} ${JSON.stringify(errors.slice(0, 3))}`);
await browser.close();

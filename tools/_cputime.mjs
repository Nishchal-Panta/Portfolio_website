/**
 * SCRATCH (delete at cleanup): which function owns the frame time at 4x CPU?
 *
 * `_longtasks.mjs` showed the long tasks are rAF callbacks but not what is
 * inside them. This runs the same throttled scroll with the V8 sampling
 * profiler attached and reports self time per function, which is the only
 * thing that turns "the frame is slow" into "this call is slow".
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
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1200);

const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');

const t0 = Date.now();
const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
const steps = 140;
const per = height / steps;
for (let i = 1; i <= steps; i++) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(per * i));
  await page.waitForTimeout(30);
  if (i % 10 === 0) await page.mouse.move(400 + (i % 5) * 40, 300);
}
const elapsed = Date.now() - t0;

const { profile } = await cdp.send('Profiler.stop');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await cdp.detach();

/* Flatten the samples: self time per (function, url). */
const nodes = new Map();
const walk = (n) => {
  if (!n || nodes.has(n.id) || !n.callFrame) return;
  const cf = n.callFrame;
  const key = `${cf.functionName || '(anonymous)'}@${String(cf.url || '').split('/').pop()}:${cf.lineNumber ?? ''}`;
  nodes.set(n.id, key);
  for (const c of n.children ?? []) walk(c);
};
for (const n of profile.nodes) walk(n);

const self = new Map();
const total = profile.samples.length;
for (let i = 0; i < profile.timeDeltas.length; i++) {
  const id = profile.samples[i];
  const dt = profile.timeDeltas[i];
  const key = nodes.get(id);
  if (key === undefined) continue;
  self.set(key, (self.get(key) ?? 0) + dt);
}

const us = (v) => `${(v / 1000).toFixed(0)}ms`;
console.log(
  `scroll ${elapsed}ms @${CPU}x   ${profile.samples.length} samples, ${(total / 1000000).toFixed(2)}s of sampled time`
);
console.log(`\ntop functions by self time:`);
const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [k, v] of top)
  console.log(`  ${us(v).padStart(7)}  ${((100 * v) / (total || 1)).toFixed(1).padStart(5)}%  ${k}`);

/* Aggregate by script file so the shape is readable. */
const byFile = new Map();
for (const [k, v] of self) {
  const file = k.split('@').pop().split(':')[0] || '(native/inline)';
  byFile.set(file, (byFile.get(file) ?? 0) + v);
}
console.log(`\nby file:`);
for (const [k, v] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15))
  console.log(`  ${us(v).padStart(7)}  ${((100 * v) / (total || 1)).toFixed(1).padStart(5)}%  ${k || '(native/inline)'}`);

await browser.close();

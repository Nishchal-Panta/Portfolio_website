/**
 * SCRATCH (delete at cleanup): what is inside the long tasks at 4x CPU?
 *
 * `profile-page.mjs` counts them; this attributes them. It runs the same
 * scripted scroll as the profiler under 4x CPU throttling, collects a
 * devtools.timeline trace, and for every top-level `RunTask` longer than
 * 50ms prints the child event that ate the time. That is the difference
 * between "script work" and "the browser painting", and only the trace can
 * tell them apart.
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();

const CATS = [
  'toplevel',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'blink.user_timing',
].join(',');

/** The same trace start/stop shape profile-page.mjs uses, which is known to
    settle: listen for `Tracing.tracingComplete`, not for a differently-named
    event on the data channel. */
const cdpTrace = async (cdp) => {
  const events = [];
  const onData = (e) => events.push(...e.value);
  cdp.on('Tracing.dataCollected', onData);
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', categories: CATS });
  return {
    async stop() {
      await cdp.send('Tracing.end');
      await done;
      cdp.off('Tracing.dataCollected', onData);
      return events;
    },
  };
};

const browser = await chromium.launch({
  headless: false,
  args: ['--enable-gpu-rasterization', '--disable-gpu-watchdog'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1200);

const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const trace = await cdpTrace(cdp);
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
const events = await trace.stop();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await cdp.detach();

/* main thread id, taken from any top-level task */
const tasks = events.filter((e) => e.name === 'RunTask' && e.dur);
let tid = tasks.length ? tasks[0].tid : 0;
tasks.sort((a, b) => a.ts - b.ts);

const LOOSE = /^(FunctionCall|v8\.run|EvaluateScript|CompileCode|ParseScript|TimerFire|FireAnimationFrame|RunMicrotasks|EventDispatch|Layout|UpdateLayoutTree|PrePaint|Paint|PaintImage|PaintTask|RasterTask|CompositeLayers|DecommitImage|DecodeImage|ImageDecodeTask|ResourceFetcher::RequestImage|ParseHTML|HTMLParse|UpdateLayerTree|DoHitTest|HitTest|DrawFrame|RecordRendering|ThreadControllerImpl::RunTask|ChromeProcess|RunTask)$/;
const SHORT = /^(Layout|UpdateLayoutTree|PrePaint|Paint|PaintImage|DecommitImage|DecodeImage|ImageDecodeTask|RecordRendering|DrawFrame|RasterTask)$/;

const inside = tasks.filter((t) => t.dur > 50000);
console.log(`scroll took ${elapsed}ms @4x   ${tasks.length} top-level tasks, ${inside.length} longer than 50ms`);
console.log(`total task time ${(tasks.reduce((s, t) => s + t.dur, 0) / 1000).toFixed(0)}ms, long ones ${(inside.reduce((s, t) => s + t.dur, 0) / 1000).toFixed(0)}ms`);

const tally = new Map();
for (const t of inside) {
  const kids = events.filter(
    (e) => e.tid === t.tid && e !== t && e.ts >= t.ts && e.ts + (e.dur || 0) <= t.ts + t.dur && e.dur > 500 && (e.cat === 'disabled-by-default-devtools.timeline' || e.cat === 'devtools.timeline')
  );
  const top = kids.slice().sort((a, b) => b.dur - a.dur).slice(0, 3);
  const key = top.map((k) => k.name).join(' > ') || '(nothing named)';
  const cur = tally.get(key) || { n: 0, ms: 0, worst: 0 };
  cur.n++;
  cur.ms += t.dur / 1000;
  cur.worst = Math.max(cur.worst, t.dur / 1000);
  tally.set(key, cur);
}

console.log(`\nwhat the ${(inside.reduce((s, t) => s + t.dur, 0) / 1000).toFixed(0)}ms of long-task time was doing:`);
for (const [k, v] of [...tally].sort((a, b) => b[1].ms - a[1].ms))
  console.log(`  ${v.ms.toFixed(0).padStart(5)}ms  ${String(v.n).padStart(3)}x  worst ${v.worst.toFixed(0)}ms   ${k}`);

console.log(`\nsingle worst tasks:`);
for (const t of inside.slice().sort((a, b) => b.dur - a.dur).slice(0, 8)) {
  const kids = events
    .filter(
      (e) => e.tid === t.tid && e !== t && e.ts >= t.ts && e.ts + (e.dur || 0) <= t.ts + t.dur && e.dur > 500
    )
    .sort((a, b) => b.dur - a.dur)
    .slice(0, 4);
  console.log(`  ${(t.dur / 1000).toFixed(0)}ms  ${kids.map((k) => `${k.name} ${(k.dur / 1000).toFixed(0)}ms`).join(' | ')}`);
}

/* How much of the whole pass was script vs paint vs layout, by event class */
const sum = (re) => events.filter((e) => re.test(e.name) && e.dur).reduce((s, e) => s + e.dur, 0) / 1000;
console.log(`\nevent totals across the pass:`);
console.log(`  script (FunctionCall+v8.run+EvaluateScript)  ${sum(/^(FunctionCall|v8\.run|EvaluateScript|CompileCode)$/).toFixed(0)}ms`);
console.log(`  layout (Layout+UpdateLayoutTree+PrePaint)    ${sum(/^(Layout|UpdateLayoutTree|PrePaint)$/).toFixed(0)}ms`);
console.log(`  paint (Paint+PaintImage+PaintTask+Composite) ${sum(/^(Paint|PaintImage|PaintTask|CompositeLayers)$/).toFixed(0)}ms`);
console.log(`  raster (RasterTask)                          ${sum(/^RasterTask$/).toFixed(0)}ms`);
console.log(`  image decode                                 ${sum(/^(DecodeImage|ImageDecodeTask|DecommitImage)$/).toFixed(0)}ms`);
console.log(`  rAF fires                                    ${events.filter((e) => e.name === 'FireAnimationFrame').length}`);

await browser.close();

/**
 * The whole page, measured.
 *
 * The album suite measures one section. This measures the page as a reader
 * meets it: a scroll from top to bottom with the background field running, in
 * both themes, on a desktop profile and on a throttled mid-range one.
 *
 * Everything comes from the browser's own account rather than from a loop
 * this script trusts:
 *
 *   - frame times are rAF deltas taken in the page, so p95 is the real
 *     interval between painted frames and not the probe's poll rate;
 *   - long tasks come from a PerformanceObserver in the page;
 *   - scripting, layout, style recalculation, layout duration and heap come
 *     from CDP `Performance.getMetrics` sampled either side of the scroll, so
 *     they are counts the engine incremented, not counts this script guessed;
 *   - forced synchronous layouts come from a trace: a `Layout` event that
 *     carries a stack trace was forced by script reading layout mid-frame,
 *     which is the one thing that makes scroll janky and the thing a
 *     getMetrics counter cannot tell apart from a legitimate one;
 *   - LCP, CLS and TBT are observed in the page from load, the way the field
 *     data is gathered on a real visit.
 *
 * The idle measurement is separate: the page is left completely still for
 * three seconds and the engine's task duration over that window is read, so
 * "nothing is happening" is a number rather than a claim.
 *
 *   node tools/profile-page.mjs [--base URL] [--long]
 *     THEME=light|dark   profile one theme (default: both)
 *     CPU=4              CPU throttling rate for the throttled pass
 *     --long             run the 2-minute heap loop as well
 */

import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const LONG = process.argv.includes('--long');
const CPU_RATE = Number(process.env.CPU ?? 4);
const ONLY_THEME = process.env.THEME ?? null;

const CATS = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'blink.user_timing',
].join(',');

const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok    ' : 'FAIL  '}${label}${!cond && detail ? `\n        ${detail}` : ''}`);
  if (!cond) failures++;
};
let failures = 0;

/* --- in-page instrumentation ------------------------------------------------ */

/** Frame times, long tasks, LCP/CLS and the counters, all observed inside the
 *  page so nothing here is a proxy for what the page actually did. */
const BOOTSTRAP = () => {
  const g = window;
  if (g.__perf) return;
  const perf = {
    frames: [],
    longTasks: [],
    lcp: 0,
    cls: 0,
    tbtStart: 0,
    rectReads: 0,
    measuring: false,
  };
  g.__perf = perf;

  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    perf.frames.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) perf.longTasks.push(Math.round(e.duration));
    }).observe({ entryTypes: ['longtask'] });
  } catch {
    /* Firefox has no longtask */
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) perf.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* not everywhere */
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) perf.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* not everywhere */
  }

  /* TBT is the Lighthouse definition: the part of each long task over 50ms. */
  const tbt = () => {
    perf.tbtStart = performance.now();
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) perf.tbt = (perf.tbt ?? 0) + Math.max(0, e.duration - 50);
      }).observe({ entryTypes: ['longtask'] });
    } catch {
      /* noop */
    }
  };
  tbt();

  perf.reset = () => {
    perf.frames.length = 0;
    perf.longTasks.length = 0;
  };
};

/* --- the two passes --------------------------------------------------------- */

const metricsOf = async (cdp) => {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
};

const startTrace = async (cdp) => {
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

/** Turn a trace into the counts this suite is about. */
const summarise = (events) => {
  let layouts = 0;
  let forced = 0;
  let style = 0;
  const forcedSamples = [];
  for (const e of events) {
    if (e.name === 'Layout' && e.ph === 'X') {
      layouts++;
      const stack = e.beginData?.stackTrace ?? e.stackTrace;
      if (stack && stack.length) {
        forced++;
        if (forcedSamples.length < 3) {
          forcedSamples.push(
            `${e.beginData?.stackTrace?.[0]?.functionName || '?'} @ ${String(
              e.beginData?.stackTrace?.[0]?.url ?? ''
            ).split('/').pop()}:${e.beginData?.stackTrace?.[0]?.lineNumber ?? '?'}`
          );
        }
      }
    }
    if (e.name === 'UpdateLayoutTree' || e.name === 'RecalculateStyles') style++;
  }
  /* The page's main thread is the one that lays out; everything else in the
     trace - compositor, raster, GPU - is not this page's CPU. Summing all of
     them reported 260% for a page that was doing nothing, which is a number
     no reader could interpret. */
  const main = events.find((e) => e.name === 'Layout' && e.ph === 'X')?.tid ?? null;
  const tasks =
    main === null
      ? []
      : events.filter((e) => e.name === 'RunTask' && e.ph === 'X' && e.tid === main);
  const busyMs = tasks.reduce((a, e) => a + (e.dur ?? 0), 0) / 1000;
  return { layouts, forced, style, tasks: tasks.length, busyMs, forcedSamples, mainTid: main };
};

/** One full top-to-bottom scroll at a reader's pace. */
const scrollPass = async (page, opts) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  if (opts.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  await page.evaluate(BOOTSTRAP);
  await page.evaluate(() => window.__perf.reset());

  const before = await metricsOf(cdp);
  const trace = await startTrace(cdp);

  const t0 = Date.now();
  const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const steps = 140;
  const per = height / steps;
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(per * i));
    // A steady reader's pace: one notch every ~70ms of wall clock.
    await page.waitForTimeout(30);
    // Keep the real cursor in step so the pointer-driven parts of the field
    // are exercised too rather than left parked at (0,0).
    if (i % 10 === 0) await page.mouse.move(400 + (i % 5) * 40, 300);
  }
  const elapsed = Date.now() - t0;

  const events = await trace.stop();
  const after = await metricsOf(cdp);

  const stats = await page.evaluate(() => {
    const p = window.__perf;
    const frames = p.frames.slice().sort((a, b) => a - b);
    const longTasks = p.longTasks.slice().sort((a, b) => a - b);
    const at = (a, q) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * q))] : 0);
    return {
      frames: frames.length,
      p50: at(frames, 0.5),
      p95: at(frames, 0.95),
      p99: at(frames, 0.99),
      max: frames[frames.length - 1] ?? 0,
      over167: frames.filter((f) => f > 16.7).length / Math.max(1, frames.length),
      longTasks: longTasks.length,
      worstTask: longTasks[longTasks.length - 1] ?? 0,
      lcp: p.lcp,
      cls: p.cls,
      tbt: p.tbt ?? 0,
      held: document.documentElement.dataset.held ?? '-',
    };
  });
  const traceStats = summarise(events);

  await cdp.send('Performance.disable').catch(() => {});
  if (opts.cpu && opts.cpu !== 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach().catch(() => {});

  return {
    elapsed,
    stats,
    traceStats,
    heap0: before.JSHeapUsedSize,
    heap1: after.JSHeapUsedSize,
    scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
    taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
    layoutCount: after.LayoutCount - before.LayoutCount,
    recalcCount: after.RecalcStyleCount - before.RecalcStyleCount,
    layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
    recalcMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
    cpu: opts.cpu ?? 1,
  };
};

/** Three seconds of the page doing nothing at all. */
const idlePass = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const before = await metricsOf(cdp);
  const trace = await startTrace(cdp);
  await new Promise((r) => setTimeout(r, 3000));
  const events = await trace.stop();
  const after = await metricsOf(cdp);
  const t = summarise(events);
  await cdp.send('Performance.disable').catch(() => {});
  cdp.detach();
  return {
    busyMs: t.busyMs,
    tasks: t.tasks,
    cpuPct: (t.busyMs / 3000) * 100,
    scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
    heapDelta: after.JSHeapUsedSize - before.JSHeapUsedSize,
  };
};

/** Two minutes of scrolling, for the heap. */
const heapLoop = async (page, seconds) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const start = await metricsOf(cdp);
  const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < seconds * 1000) {
    const phase = (i % 40) / 40;
    const y = phase < 0.5 ? height * (phase * 2) : height * (2 - phase * 2);
    await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), Math.round(y));
    await page.waitForTimeout(60);
    i++;
  }
  const mid = await metricsOf(cdp);
  await new Promise((r) => setTimeout(r, 4000));
  const end = await metricsOf(cdp);
  await cdp.send('Performance.disable').catch(() => {});
  cdp.detach();
  return {
    loops: i,
    start: start.JSHeapUsedSize,
    afterLoop: mid.JSHeapUsedSize,
    afterRest: end.JSHeapUsedSize,
  };
};

/* --- run -------------------------------------------------------------------- */

const browser = await chromium.launch({ headless: false });
const themes = ONLY_THEME ? [ONLY_THEME] : ['dark', 'light'];
const results = [];

for (const theme of themes) {
  for (const cpu of [null, CPU_RATE]) {
    const label = `${theme}${cpu ? ` @ ${cpu}x CPU` : ''}`;
    console.log(`\n${label}`);

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.evaluate(BOOTSTRAP);
    // Park the pointer off everything: the album and the rail both hold for
    // hover, and a held album would make a still page look like a working one.
    await page.mouse.move(4, 4);
    await page.waitForTimeout(800);

    const idle = await idlePass(page);
    const r = await scrollPass(page, { cpu });
    r.theme = theme;
    r.idle = idle;
    r.errors = errors;
    results.push({ label, ...r });

    const s = r.stats;
    ok(
      s.p95 <= 16.7,
      `p95 frame time ${s.p95.toFixed(1)}ms (limit 16.7) - p50 ${s.p50.toFixed(1)}, p99 ${s.p99.toFixed(1)}, max ${s.max.toFixed(1)} over ${s.frames} frames, ${(s.over167 * 100).toFixed(1)}% over one 60Hz frame`
    );
    ok(
      s.worstTask <= 50,
      `longest task ${s.worstTask}ms (limit 50) - ${s.longTasks} long task(s) across the scroll`
    );
    ok(
      r.heap1 - r.heap0 <= 0 || r.heap1 - r.heap0 < 2 * 1024 * 1024,
      `JS heap grew ${((r.heap1 - r.heap0) / 1024).toFixed(0)} KB over one scroll`
    );
    console.log(
      `        scripting ${r.scriptMs.toFixed(0)}ms (${(r.scriptMs / Math.max(1, s.frames)).toFixed(2)}ms/frame) | layout ${r.layoutCount} (${r.layoutMs.toFixed(0)}ms) | style ${r.recalcCount} (${r.recalcMs.toFixed(0)}ms) | forced layouts ${r.traceStats.forced}${r.traceStats.forcedSamples.length ? ` (${r.traceStats.forcedSamples.join('; ')})` : ''}`
    );
    console.log(
      `        LCP ${s.lcp.toFixed(0)}ms | CLS ${s.cls.toFixed(4)} | TBT ${s.tbt.toFixed(0)}ms | scroll took ${r.elapsed}ms @ ${r.cpu}x`
    );
    console.log(
      `        idle: ${idle.busyMs.toFixed(0)}ms of work in 3s (${idle.cpuPct.toFixed(1)}% CPU, ${idle.tasks} tasks, script ${idle.scriptMs.toFixed(1)}ms, heap ${idle.heapDelta} B)`
    );
    if (errors.length) console.log(`        console: ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
}

if (LONG) {
  console.log('\nheap over a 2-minute scroll loop');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.mouse.move(4, 4);
  const h = await heapLoop(page, 120);
  console.log(
    `        ${h.loops} steps: ${(h.start / 1048576).toFixed(1)} MB -> ${(h.afterLoop / 1048576).toFixed(1)} MB -> ${(h.afterRest / 1048576).toFixed(1)} MB after 4s at rest`
  );
  ok(
    h.afterLoop - h.start <= 2 * 1024 * 1024,
    `heap grew ${((h.afterLoop - h.start) / 1024).toFixed(0)} KB across two minutes of scrolling (limit 2 MB)`
  );
  ok(
    h.afterRest <= h.afterLoop + 512 * 1024,
    `and settles at rest (${((h.afterRest - h.afterLoop) / 1024).toFixed(0)} KB)`
  );
  await ctx.close();
}

await browser.close();

console.log('\n--- summary ---');
for (const r of results) {
  console.log(
    `${r.label.padEnd(20)} p50 ${r.stats.p50.toFixed(1).padStart(5)}  p95 ${r.stats.p95
      .toFixed(1)
      .padStart(5)}  p99 ${r.stats.p99.toFixed(1).padStart(5)}  long ${String(r.stats.longTasks).padStart(2)}  forced ${String(
      r.traceStats.forced
    ).padStart(3)}  script/f ${(r.scriptMs / Math.max(1, r.stats.frames)).toFixed(2).padStart(5)}ms  heap ${(
      (r.heap1 - r.heap0) /
      1024
    ).toFixed(0).padStart(6)}KB  idle ${r.idle.cpuPct.toFixed(1)}%`
  );
}

if (failures) {
  console.log(`\nFAIL  ${failures} page profile check(s) failed`);
  process.exit(1);
}
console.log('\nPASS  page profile');

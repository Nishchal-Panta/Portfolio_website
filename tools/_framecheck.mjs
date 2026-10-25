/**
 * Quiet-machine frame pacing under a dark-theme fast scroll.
 *
 * WHY THIS EXISTS
 *
 * `scroll-regression.mjs` reported 29.9fps for the dark fast-scroll band, with
 * 10 frames over 32ms, while its light-theme band ran at 56.9fps on the same
 * machine. That number is the only thing standing between the gate and green,
 * and it is unexplained: the same tool's *album* sampler measures a 61Hz display
 * and its p95 frame time at 1x is 8.9ms, which does not sit alongside a
 * sustained 30fps.
 *
 * So the figure has to be reproduced somewhere it can be attributed. This runs
 * the same scroll - dark theme, fast band - on a HEADED browser with nothing
 * else building, and reports the distribution rather than a single average:
 *
 *   p50  the ordinary frame gap, i.e. what the display is actually doing
 *   p95  the tail, which is where jank lives
 *   p99  and the worst few, which separate one-off GC from sustained load
 *
 * A mean of 33ms made of 60ms gaps is a different problem from a mean of 33ms
 * made of 33ms gaps, and only the percentiles can tell them apart.
 *
 * The scroll runs inside the page on requestAnimationFrame so that the act of
 * measuring cannot itself be the cause: no CDP round trip, no evaluate per
 * frame, nothing but a scrollBy and a timestamp.
 *
 * Run:  node tools/_framecheck.mjs [chromium|firefox] [dark|light]
 */
import { chromium, firefox } from 'playwright';

const BASE = 'http://localhost:4323/';
const browserName = process.argv[2] ?? 'chromium';
const theme = process.argv[3] ?? 'dark';
/* `ink` reproduces what scroll-regression does on every frame of its own scroll:
   a clearRect + drawImage + getImageData readback of the main canvas. Running
   the identical scroll with and without it is the only way to tell a page that
   cannot hold its frame rate from a probe that will not let go of one. */
const withInk = process.argv[4] === 'ink';
const VIEWPORT = { width: 1280, height: 860 };
const DURATION_MS = 1500;
/* ~40px a frame is a hard flick: at 60fps that is 2400px/s, past every figure
   in scroll-regression's fast band, so this is at least as demanding. */
const STEP_PX = 40;

const launcher = browserName === 'firefox' ? firefox : chromium;

console.log(`\n${browserName}, ${theme} theme, headed, ${DURATION_MS}ms of fast scroll, ${withInk ? 'WITH per-frame getImageData readback (as scroll-regression does)' : 'no readback'}\n`);

const browser = await launcher.launch({ headless: false });
const context = await browser.newContext({ viewport: VIEWPORT });
await context.addInitScript((t) => {
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* private mode */
  }
}, theme);
const page = await context.newPage();

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* Measure inside the page: rAF to rAF, no host round trip per frame. */
const stats = await page.evaluate(async ({ durationMs, stepPx, ink }) => {
  const gaps = [];
  /* The readback scroll-regression performs every frame, copied verbatim in
     shape: a small canvas, a full clear, a full-canvas draw, a synchronous
     getImageData, then an alpha sweep over every pixel. */
  let sctx = null;
  let small = null;
  let inked = 0;
  if (ink) {
    const src = document.querySelector('canvas');
    small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(src.width / 8));
    small.height = Math.max(1, Math.round(src.height / 8));
    sctx = small.getContext('2d', { willReadFrequently: true });
  }
  let last = performance.now();
  const start = last;
  let travelled = 0;
  let prevY = window.scrollY;
  let maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  await new Promise((resolve) => {
    const step = () => {
      const now = performance.now();
      gaps.push(now - last);
      last = now;
      let y = window.scrollY + stepPx;
      if (y > maxScroll) {
        y = 0;
        maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      }
      /* `behavior: 'instant'` is load-bearing, not a detail. The document is
         smooth by default, and a smooth scrollTo restarted 145 times a second
         never gets anywhere - the page would sit near its start, the field
         would see almost no scroll, and the run would report a comfortable
         frame rate for entirely the wrong reason. */
      window.scrollTo({ top: y, behavior: 'instant' });
      travelled += Math.abs(window.scrollY - prevY);
      prevY = window.scrollY;
      if (ink) {
        const src = document.querySelector('canvas');
        sctx.clearRect(0, 0, small.width, small.height);
        sctx.drawImage(src, 0, 0, small.width, small.height);
        const d = sctx.getImageData(0, 0, small.width, small.height).data;
        let sum = 0;
        let lit = 0;
        for (let i = 3; i < d.length; i += 4) {
          if (d[i]) {
            sum += d[i];
            lit++;
          }
        }
        inked = lit;
      }
      if (now - start < durationMs) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  const elapsed = performance.now() - start;
  const sorted = [...gaps].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  const stalls = gaps.filter((g) => g > 32).length;
  return {
    n: gaps.length,
    elapsed,
    fps: (gaps.length / (elapsed / 1000)).toFixed(1),
    p50: pct(50),
    p95: pct(95),
    p99: pct(99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: gaps.reduce((a, b) => a + b, 0) / gaps.length,
    stalls,
    refresh: 1000 / pct(50),
    scrollY: Math.round(window.scrollY),
    travelled: Math.round(travelled),
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    inked,
  };
}, { durationMs: DURATION_MS, stepPx: STEP_PX, ink: withInk });

const f = (n) => Number(n).toFixed(2);
console.log(`  frames        ${stats.n} over ${stats.elapsed.toFixed(0)}ms`);
console.log(`  fps           ${stats.fps}`);
console.log(`  frame gap     p50 ${f(stats.p50)}ms   p95 ${f(stats.p95)}ms   p99 ${f(stats.p99)}ms`);
console.log(`                mean ${f(stats.mean)}ms   min ${f(stats.min)}ms   max ${f(stats.max)}ms`);
console.log(`  implied rate  ${(1000 / stats.p50).toFixed(0)}Hz at p50`);
console.log(`  frames >32ms  ${stats.stalls}`);
console.log(`  travelled     ${stats.travelled}px of scrolling in ${DURATION_MS}ms (must be thousands - a low number means the scroll never landed)`);
console.log(`  scrollY       ${stats.scrollY}px   reduced-motion: ${stats.reduced}`);
if (withInk) console.log(`  lit pixels    ${stats.inked} per readback`);
console.log(`  console errs  ${errors.length}${errors.length ? '  ' + errors.slice(0, 3).join(' | ') : ''}`);

await browser.close();

/* Read the tail, not the mean: p95 above 32ms is the same jank scroll-regression
   flags, p50 near 6.9ms is a 145Hz display running clean. `travelled` is part of
   the verdict, not a footnote - a smooth-scroll restart that never moved the page
   would sail through every timing check while measuring nothing. */
const moved = stats.travelled > DURATION_MS * 2; // at least 2px/ms of real scrolling
const healthy = Number(stats.p95) <= 32 && Number(stats.fps) >= 45 && moved;
console.log(
  `\n  ${healthy ? 'pass' : 'FAIL'}  p95 ${f(stats.p95)}ms <= 32ms, ${stats.fps}fps >= 45, ` +
    `travelled ${stats.travelled}px ${moved ? '>' : 'NOT'} ${DURATION_MS * 2}px\n`
);
process.exit(healthy ? 0 : 1);

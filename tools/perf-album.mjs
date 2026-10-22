/**
 * What makes the album feel slow - measured, not guessed.
 *
 * Runs against whatever build it is pointed at, so the same script produces
 * the "before" and the "after" numbers:
 *
 *   node tools/perf-album.mjs --base http://localhost:4322/ [--seconds 32]
 *
 * It watches, from inside the page:
 *
 *   - the interval between steps (start to start), which is what "too slow"
 *     mostly is;
 *   - frame time during a step: p95, and frames actually produced against the
 *     frames a 60 Hz display would show (dropped);
 *   - long tasks over 50 ms;
 *   - how long img.decode() takes, and whether photographs are decoded ahead
 *     of the step that shows them;
 *   - getBoundingClientRect() calls on album elements during a step, because
 *     a read inside the animation forces layout and shows up as a long frame;
 *   - bytes per photograph and the decoded width against the width actually
 *     on screen, which is how you catch a browser decoding a 6150px original
 *     to draw a 490px box.
 */

import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const BASE = await arg('base', await baseUrl());
const SECONDS = Number(arg('seconds', 32));

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.addInitScript(() => {
  const P = (window.__perf = {
    decodes: [],
    rectReads: [],
    longTasks: [],
    frames: [],
    swaps: [],
    photos: [],
  });

  const decode = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = function patched() {
    const img = this;
    const t0 = performance.now();
    const done = (ok) =>
      P.decodes.push({ ms: performance.now() - t0, ok, src: img.currentSrc || img.src });
    try {
      return decode.call(img).then(
        (v) => {
          done(true);
          return v;
        },
        (e) => {
          done(false);
          throw e;
        }
      );
    } catch (e) {
      done(false);
      return Promise.reject(e);
    }
  };

  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function patched() {
    const el = this;
    P.rectReads.push({
      t: performance.now(),
      cls: typeof el.className === 'string' ? el.className : el.tagName,
      // reads this script makes while sampling are not the album's reads
      mine: !!P.instrumenting,
    });
    return rect.call(el);
  };

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) P.longTasks.push({ t: e.startTime, ms: e.duration });
    }).observe({ entryTypes: ['longtask'] });
  } catch {
    /* Firefox ships no longtask entry */
  }

  let last = performance.now();
  const frame = (now) => {
    P.frames.push({ t: now, dt: now - last });
    last = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const snapshot = () => {
    P.instrumenting = true;
    try {
      P.photos = [...document.querySelectorAll('.album__figure img')].map((img) => ({
        i: Number(img.closest('.album__figure')?.dataset.i ?? -1),
        complete: img.complete,
        natural: img.naturalWidth,
        shown: Math.round(img.getBoundingClientRect().width),
        src: (img.currentSrc || '').split('/').pop(),
      }));
    } finally {
      P.instrumenting = false;
    }
  };

  const start = () => {
    const album = document.querySelector('[data-album]');
    if (!album) return;
    new MutationObserver(() => {
      P.swaps.push({ t: performance.now(), n: Number(album.dataset.swaps || 0) });
      snapshot();
    }).observe(album, { attributes: true, attributeFilter: ['data-swaps'] });
    snapshot();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() =>
  document.querySelector('#album')?.scrollIntoView({ behavior: 'instant', block: 'center' })
);
await page.mouse.move(4, 4); // the OS cursor does not follow Playwright's hover
await page.waitForTimeout(600);

await page.waitForTimeout(SECONDS * 1000);

const raw = await page.evaluate(() => {
  const P = window.__perf;
  const album = document.querySelector('[data-album]');
  const rr = album?.getBoundingClientRect();
  return {
    swaps: P.swaps,
    frames: P.frames,
    decodes: P.decodes,
    longTasks: P.longTasks,
    rectReads: P.rectReads,
    photos: P.photos,
    held: album?.dataset.held ?? null,
    row: rr ? { w: Math.round(rr.width), h: Math.round(rr.height) } : null,
    resources: performance
      .getEntriesByType('resource')
      .filter((r) => r.initiatorType === 'img' || /\.(avif|webp|jpe?g|png)(\?|$)/.test(r.name))
      .map((r) => ({
        name: r.name.split('/').pop(),
        bytes: r.encodedBodySize || r.transferSize || 0,
      })),
  };
});
await browser.close();

/* --- report --------------------------------------------------------------- */

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const swaps = raw.swaps;
const intervals = [];
for (let i = 1; i < swaps.length; i++) intervals.push(swaps[i].t - swaps[i - 1].t);

console.log(`\nalbum performance   (${SECONDS}s window, base ${BASE})`);
console.log(`  steps observed        ${swaps.length}`);
console.log(
  `  step interval         ${intervals.length ? `min ${Math.min(...intervals).toFixed(0)} / med ${pct(intervals, 50).toFixed(0)} / max ${Math.max(...intervals).toFixed(0)} ms` : 'n/a'}`
);
console.log(
  `  median step duration  ${pct(intervals, 50).toFixed(0)} ms  (motion + dwell, start to start)`
);

/* Which of the frames belong to a step? A step window is the 700ms that starts
   at a recorded swap; the old album animates for 700ms, the new one for 500ms,
   so 700ms covers both without assuming. */
const WINDOW = 700;
const inStep = (t) => swaps.some((s) => t >= s.t && t < s.t + WINDOW);
const stepFrames = raw.frames.filter((f) => inStep(f.t)).map((f) => f.dt);
const allFrames = raw.frames.map((f) => f.dt);
const stepMs = swaps.length * WINDOW;
const produced = raw.frames.filter((f) => inStep(f.t)).length;
const expected = Math.round(stepMs / (1000 / 60));

console.log(`  frame time (all)      p50 ${pct(allFrames, 50).toFixed(1)} / p95 ${pct(allFrames, 95).toFixed(1)} / max ${Math.max(...allFrames, 0).toFixed(1)} ms`);
console.log(`  frame time (in step)  p50 ${pct(stepFrames, 50).toFixed(1)} / p95 ${pct(stepFrames, 95).toFixed(1)} / max ${Math.max(...stepFrames, 0).toFixed(1)} ms`);
const albumReads = raw.rectReads.filter((r) => /album/i.test(r.cls) && !r.mine);
const readsInStep = albumReads.filter((r) => inStep(r.t));
console.log(
  `  rect reads on album   ${albumReads.length} total, ${readsInStep.length} during a step`
);
const byClass = new Map();
for (const r of albumReads) byClass.set(r.cls, (byClass.get(r.cls) || 0) + 1);
for (const [cls, n] of [...byClass].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`      ${String(n).padStart(6)}x  ${cls.slice(0, 60)}`);
}

/* The display may be 120Hz, so "dropped" has to be judged against the rate the
   page is actually running at, not against an assumed 60. */
const refreshMs = pct(allFrames, 50) || 16.7;
const refreshHz = 1000 / refreshMs;
const expectedAtRefresh = Math.round(stepMs / refreshMs);
console.log(
  `  frames during steps   ${produced} produced vs ${expectedAtRefresh} at ${refreshHz.toFixed(0)}Hz (step time ${stepMs}ms)`
);
const longInStep = raw.longTasks.filter((l) => inStep(l.t));
console.log(
  `  long tasks >50ms      ${raw.longTasks.length} total, ${longInStep.length} during a step, worst ${raw.longTasks.length ? Math.max(...raw.longTasks.map((l) => l.ms)).toFixed(0) : 0}ms`
);

const dec = raw.decodes;
console.log(
  `  img.decode() calls    ${dec.length}${dec.length ? `  max ${Math.max(...dec.map((d) => d.ms)).toFixed(0)}ms, ${dec.filter((d) => !d.ok).length} rejected` : ''}`
);
const lastSnap = raw.photos;
const notReady = lastSnap.filter((p) => !p.complete);
const oversized = lastSnap.filter((p) => p.natural && p.shown && p.natural > p.shown * 1.6);
console.log(
  `  photographs           ${lastSnap.length} in DOM, ${notReady.length} not yet complete, ${oversized.length} decoded wider than 1.6x the box`
);
for (const p of oversized) console.log(`      #${p.i} natural ${p.natural}px for a ${p.shown}px box (${p.src})`);

const imgRes = raw.resources.filter((r) => r.bytes > 0);
const total = imgRes.reduce((a, r) => a + r.bytes, 0);
const heaviest = [...imgRes].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
console.log(`  image bytes (loaded)  ${imgRes.length} files, ${(total / 1024).toFixed(0)} KB total`);
for (const r of heaviest) console.log(`      ${(r.bytes / 1024).toFixed(0)} KB  ${r.name}`);
console.log(
  `  per photo, largest    ${heaviest[0] ? (heaviest[0].bytes / 1024).toFixed(0) : 0} KB`
);
if (raw.held) console.log(`  held                  ${raw.held}`);
if (consoleErrors.length) console.log(`  console errors        ${consoleErrors.length}: ${consoleErrors[0]}`);
console.log('');

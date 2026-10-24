/**
 * The parallax cap, measured end to end.
 *
 * The old check in scroll-regression.mjs computed `|scrollVel| * PARALLAX_MAX`
 * and compared that to the cap. That cannot fail for two separate reasons:
 * scrollVel is per-frame (field.ts:989, "px this frame"), so the product
 * under-reads by roughly the refresh rate; and it is a formula applied to a
 * published number, so it says nothing about whether a star actually moved.
 *
 * This measures what the user would see instead: every particle's real
 * on-screen displacement between consecutive frames, divided by the real frame
 * interval, in px/s. Nothing is excluded - no star is filtered out for being
 * near the edge, dim, or fast. p95 and max are reported for every case.
 *
 *   node tools/_parallax-cap.mjs --base http://localhost:4323/ [--engine chromium]
 *
 * Two frame rates are emulated with an rAF pacer (see tools/_refresh.mjs). At
 * 144Hz on a 145Hz panel the pacer is a no-op, so the 60 vs 144 comparison is a
 * clean single-variable experiment on the same machine.
 */
import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';
import { measureRefresh, installPacer, verifyPaced } from './_refresh.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const BASE = await arg('base', await baseUrl());
const ENGINE = arg('engine', 'chromium');
const RATES = [60, 144];
const SPEEDS = [500, 1500, 4000];
const THEMES = ['dark', 'light'];
/* dark: no star faster than ~110px/s. light: no constellation figure faster
   than ~90px/s. The gate allows 10% of measurement slack, as ruled. */
const CAPS = { dark: 110, light: 90 };
const SCROLL_MS = 1600;
const SLACK = 1.1;

const launch = ENGINE === 'firefox' ? firefox : chromium;
const browser = await launch.launch({ headless: true });
const engineName = ENGINE;

/* ---------------------------------------------------------------- in-page */

/** Sample every particle's real on-screen speed, once per frame, in the page. */
const SAMPLER = () => {
  const C = (window.__cap = { on: false, rows: [], frameMs: [] });
  let prev = null;
  let prevT = 0;
  let prevY = 0;
  const step = (t) => {
    if (C.on) {
      const raw = window.__fieldParticles;
      const pos = raw ? Array.from(raw, (p) => [p[0], p[1]]) : [];
      if (prev && pos.length === prev.length && pos.length > 0) {
        const dt = t - prevT;
        if (dt > 0.1) {
          C.frameMs.push(dt);
          const speeds = new Array(pos.length);
          for (let i = 0; i < pos.length; i++) {
            const dx = pos[i][0] - prev[i][0];
            const dy = pos[i][1] - prev[i][1];
            speeds[i] = Math.hypot(dx, dy) * (1000 / dt);
          }
          /* y is the page's own scroll position over the same interval, so the
             response ratio is real displacement per real scroll. */
          const dy = window.scrollY - prevY;
          C.rows.push({ speeds, scrollPx: dy, dt });
        }
      }
      prev = pos;
      prevT = t;
      prevY = window.scrollY;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);

  /* A time-driven scroll, so the page's speed is a function of the clock and
     not of how long the loop happens to take. */
  C.scroll = (pxPerSec, ms) => new Promise((res) => {
    const t0 = performance.now();
    const step = (t) => {
      window.scrollTo({ top: (pxPerSec * (t - t0)) / 1000, behavior: 'instant' });
      if (t - t0 < ms) requestAnimationFrame(step);
      else res((pxPerSec * ms) / 1000);
    };
    requestAnimationFrame(step);
  });
};

/* ---------------------------------------------------------------- helpers */

const pct = (sorted, p) => {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const quantile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

/** Pointer sweep at a controlled px/s, driven from the clock. */
const pointerSweep = (pxPerSec, ms) => new Promise((res) => {
  const t0 = performance.now();
  const step = (t) => {
    const k = (t - t0) / 1000;
    const x = 700 + Math.cos(k * 2) * 260;
    const y = 520 + Math.sin(k * 2) * 140;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
    if (t - t0 < ms) requestAnimationFrame(step);
    else res();
  };
  requestAnimationFrame(step);
});

/* ------------------------------------------------------------------ run */

const results = [];
const pointerResults = [];
let failedCases = 0;

console.log(`\nparallax cap, measured end to end - ${engineName}, base ${BASE}`);
console.log(`particle speed = |real on-screen displacement| / real frame interval, px/s`);
console.log(`caps: dark ${CAPS.dark}px/s, light ${CAPS.light}px/s (+${((SLACK - 1) * 100).toFixed(0)}% slack)\n`);

for (const theme of THEMES) {
  for (const rate of RATES) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
    await installPacer(page, rate);
    await page.addInitScript(SAMPLER);
    await page.addInitScript(`localStorage.setItem('theme', '${theme}');`);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);

    const paced = await verifyPaced(page, rate);
    const native = await measureRefresh(page, 60);
    const particleNote = await page.evaluate(() => ({
      n: (window.__fieldParticles || []).length,
      stars: window.__field?.stars ?? null,
    }));

    for (const speed of SPEEDS) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(700);
      await page.evaluate(() => { window.__cap.rows = []; window.__cap.frameMs = []; window.__cap.on = true; });
      await page.evaluate(([s, ms]) => window.__cap.scroll(s, ms), [speed, SCROLL_MS]);
      await page.evaluate(() => { window.__cap.on = false; });
      await page.waitForTimeout(400);

      const data = await page.evaluate(() => ({
        rows: window.__cap.rows.map((r) => ({ speeds: r.speeds, scrollPx: r.scrollPx, dt: r.dt })),
        frameMs: window.__cap.frameMs,
      }));

      const all = [];
      let scrollPx = 0;
      let totalDt = 0;
      for (const r of data.rows) {
        for (const s of r.speeds) all.push(s);
        scrollPx += Math.abs(r.scrollPx);
        totalDt += r.dt;
      }
      all.sort((a, b) => a - b);
      const p95 = quantile(all, 95);
      const max = all.length ? all[all.length - 1] : 0;
      const medianFrame = quantile(data.frameMs, 50);
      const cap = CAPS[theme];
      const okCase = max <= cap * SLACK;
      if (!okCase) failedCases++;

      results.push({
        theme, rate, speed, p95, max, cap, ok: okCase,
        n: all.length, particles: particleNote.n,
        medianFrame, pacedHz: paced.medianHz, nativeHz: native.hz,
        scrollPx, expectedPx: (speed * SCROLL_MS) / 1000,
      });
    }

    /* ---------------------------------------------------- pointer response */
    /* page.evaluate, not a direct call: this function runs IN THE PAGE, so it
       is serialised across rather than executed here. */
    try {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(600);
      await page.evaluate(() => { window.__cap.rows = []; window.__cap.on = true; });
      await page.evaluate(pointerSweep, 900, 1200);
      await page.evaluate(() => { window.__cap.on = false; });
      const pdata = await page.evaluate(() => window.__cap.rows.map((r) => r.speeds));
      const pall = [];
      for (const r of pdata) for (const s of r) pall.push(s);
      pointerResults.push({
        theme, rate, p95: quantile(pall, 95), max: pall.length ? Math.max(...pall) : 0, n: pall.length,
      });
    } catch (e) {
      /* A pointer failure must not throw away the scroll measurements above. */
      pointerResults.push({ theme, rate, p95: NaN, max: NaN, n: 0, error: String(e) });
    }

    await page.close();
  }
}

await browser.close();

/* --------------------------------------------------------------- report */

console.log('\n=== scroll: real on-screen particle speed, px/s ===');
console.log(
  'theme  rate   scroll   p95     max    cap   ok    particles  frame  pacedHz'
);
console.log('-'.repeat(84));
for (const r of results) {
  console.log(
    r.theme.padEnd(7) + String(r.rate).padStart(5) + String(r.speed).padStart(8) +
    r.p95.toFixed(1).padStart(7) + r.max.toFixed(1).padStart(8) +
    String(r.cap).padStart(6) + (r.ok ? '  ok' : ' FAIL') +
    String(r.particles).padStart(11) + r.medianFrame.toFixed(1).padStart(7) +
    r.pacedHz.toFixed(0).padStart(9)
  );
}

console.log('\n=== scroll response ratio: px of star movement per px of page scroll ===');
console.log('theme  rate   scroll   ratio');
console.log('-'.repeat(40));
for (const r of results) {
  const ratio = r.scrollPx > 0 ? (r.max / r.speed) : 0;
  console.log(
    r.theme.padEnd(7) + String(r.rate).padStart(5) + String(r.speed).padStart(8) +
    ratio.toFixed(4).padStart(9)
  );
}

console.log('\n=== 60Hz vs 144Hz: does the response depend on refresh rate? ===');
console.log('theme  scroll   ratio@60  ratio@144  144/60');
console.log('-'.repeat(50));
for (const theme of THEMES) {
  for (const speed of SPEEDS) {
    const a = results.find((r) => r.theme === theme && r.rate === 60 && r.speed === speed);
    const b = results.find((r) => r.theme === theme && r.rate === 144 && r.speed === speed);
    if (!a || !b) continue;
    const ra = a.scrollPx > 0 ? a.max / a.speed : 0;
    const rb = b.scrollPx > 0 ? b.max / b.speed : 0;
    console.log(
      theme.padEnd(7) + String(speed).padStart(8) +
      ra.toFixed(4).padStart(10) + rb.toFixed(4).padStart(11) +
      (ra > 0 ? (rb / ra).toFixed(3) : '-').padStart(8)
    );
  }
}

console.log('\n=== pointer response (900px/s sweep), same question ===');
console.log('theme  rate    p95     max    n');
console.log('-'.repeat(40));
for (const r of pointerResults) {
  console.log(
    r.theme.padEnd(7) + String(r.rate).padStart(5) +
    r.p95.toFixed(1).padStart(8) + r.max.toFixed(1).padStart(8) + String(r.n).padStart(8)
  );
}

console.log(`\ncases over cap: ${failedCases} of ${results.length}`);
console.log(failedCases === 0 ? 'GATE PASS' : 'GATE FAIL');
process.exit(failedCases === 0 ? 0 : 1);

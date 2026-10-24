/**
 * ?scrollmode=rate vs ?scrollmode=frame, proved at an emulated 60Hz.
 *
 * The two modes differ only in how a per-frame displacement becomes a rate:
 *
 *     frame : raw = scrollVel * 60          (assumes the frame was 1/60s)
 *     rate  : raw = scrollVel / dt          (measures it)
 *
 * At 60Hz those are the same arithmetic, so at ?clock=60 the two must agree to
 * floating-point noise. That is the claim under test. At ?clock=144 they should
 * part company, which is what the flag is for and what is worth looking at on a
 * real high-refresh display.
 *
 * The input is made identical between runs by driving the scroll from a FRAME
 * INDEX rather than from wall-clock time: exactly N frames, y = f(i), so both
 * modes see byte-for-byte the same sequence no matter how fast the machine
 * runs. The virtual clock (?clock=) is what makes the page *believe* those
 * frames were 16.67ms or 6.9ms apart - browser frame pacing is not involved
 * anywhere, so the comparison cannot be perturbed by a busy machine.
 *
 *   node tools/_scrollmode.mjs --base http://localhost:4323/
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const BASE = await arg('base', await baseUrl());

const FRAMES = 180;
const TOP = 6000;

/* Runs one mode at one virtual rate and reports what the field did. */
async function run(browser, { clock, mode }) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  /* Dark theme, or there are no stars to measure: light collapses the field to
     seven constellation figures and every star metric reads zero, which makes
     "the two modes are identical" vacuously true and worth nothing. */
  await page.addInitScript(`localStorage.setItem('theme', 'dark');`);
  const q = new URLSearchParams({ clock: String(clock) });
  if (mode === 'rate') q.set('scrollmode', 'rate');
  await page.goto(`${BASE}?${q}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  /* Deterministic input: y is a pure function of frame index, so every run
     feeds the field the same path. Sampling happens after each step, inside
     the page, so nothing depends on when Node gets scheduled. */
  const out = await page.evaluate(async ({ n, top }) => {
    const starAll = [];
    const shapeAll = [];
    const rawSeen = [];
    let prevY = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(r));
    prevY = window.scrollY;

    for (let i = 0; i < n; i++) {
      const y = (top * i) / (n - 1);
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => requestAnimationFrame(r));
      const sp = window.__fieldSpeeds;
      if (sp) {
        if (sp.star) starAll.push(...sp.star);
        if (sp.shape) shapeAll.push(...sp.shape);
      }
      const f = window.__field;
      if (f && typeof f.scrollVel === 'number') rawSeen.push(Math.abs(f.scrollVel));
      prevY = y;
    }

    const stat = (a) => {
      if (!a.length) return { p50: 0, p95: 0, max: 0, n: 0 };
      const s = [...a].sort((x, y) => x - y);
      return {
        p50: s[Math.floor(s.length / 2)],
        p95: s[Math.floor(s.length * 0.95)],
        max: s[s.length - 1],
        n: s.length,
      };
    };
    return {
      star: stat(starAll),
      shape: stat(shapeAll),
      scrollVel: stat(rawSeen),
      stars: (window.__fieldParticles || []).length,
      hz: window.__field ? Math.round(window.__field.fps || 0) : 0,
    };
  }, { n: FRAMES, top: TOP });

  await page.close();
  return out;
}

const rel = (a, b) => (a === 0 && b === 0 ? 0 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9));

const browser = await chromium.launch({ headless: false });

console.log(`\nscrollmode A/B - ${FRAMES} frames, deterministic y = f(frameIndex), 0..${TOP}px`);
console.log('virtual clock sets the page\'s own dt; browser frame pacing is not involved\n');

const at = {};
for (const clock of [60, 144]) {
  for (const mode of ['frame', 'rate']) {
    at[`${clock}:${mode}`] = await run(browser, { clock, mode });
  }
}

for (const clock of [60, 144]) {
  const F = at[`${clock}:frame`];
  const R = at[`${clock}:rate`];
  console.log(`=== ?clock=${clock} ===`);
  console.log('metric                 frame        rate        rel.diff');
  console.log('-'.repeat(56));
  for (const metric of ['star.p50', 'star.p95', 'star.max', 'shape.max', 'scrollVel.p95', 'scrollVel.max']) {
    const [grp, key] = metric.split('.');
    const a = F[grp][key];
    const b = R[grp][key];
    const d = rel(a, b);
    console.log(
      metric.padEnd(22) + a.toFixed(4).padStart(11) + b.toFixed(4).padStart(13) +
      d.toExponential(2).padStart(13) + (d < 1e-9 ? '   IDENTICAL' : '')
    );
  }
  console.log(`  stars measured ${F.stars}   page fps frame=${F.hz} rate=${R.hz}\n`);
}

const f60 = at['60:frame'];
const r60 = at['60:rate'];
const d60 = rel(f60.star.max, r60.star.max);
const f144 = at['144:frame'];
const r144 = at['144:rate'];
const d144 = rel(f144.star.max, r144.star.max);

console.log('=== verdict ===');
console.log(`  ?clock=60   frame vs rate, star.max : ${f60.star.max.toFixed(4)} vs ${r60.star.max.toFixed(4)}  rel ${d60.toExponential(2)}`);
console.log(`  ?clock=144  frame vs rate, star.max : ${f144.star.max.toFixed(4)} vs ${r144.star.max.toFixed(4)}  rel ${d144.toExponential(2)}`);
const identicalAt60 = d60 < 1e-6;
/* Guard against the vacuous case this harness hit on its first run: light
   theme has no stars, every metric reads zero, and 0 == 0 would have reported
   a clean pass without testing anything. */
const hasSignal = f60.star.max > 0 || r60.star.max > 0;
console.log(`\n  signal present (non-zero star motion): ${hasSignal ? 'yes' : 'NO - RESULT INVALID'}`);
console.log(`  60Hz identical : ${!hasSignal ? 'n/a' : identicalAt60 ? 'YES' : 'NO'}`);
console.log(`  144Hz differs  : ${!hasSignal ? 'n/a' : d144 > 1e-6 ? 'YES' : 'no'}`);

await browser.close();
process.exit(hasSignal && identicalAt60 ? 0 : 1);

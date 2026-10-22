/**
 * Scroll regression for the background field.
 *
 * Replaces verify-field.mjs, which still asserted the mote era's model - nodes,
 * links, orphans, `mode === 'motes'`. None of that exists: the field is now
 * stars, constellations, and one shared flow grid, and the thing that can still
 * break is the scroll handover.
 *
 * Three guards, all measured during a real animated scroll rather than an
 * instant jump (an instant jump produces a single velocity spike that the soft
 * clamp swallows, so it proves nothing):
 *
 *   handover   the scripted scroll has to actually move the page, the field has
 *              to notice, and the parallax must not carry a star past its cap.
 *              Stars are spring-held, so under a clean scroll their only screen
 *              motion is scroll velocity times the largest layer factor - and
 *              that is what is asserted, since a per-star reading has no stable
 *              identity to track through a recycle.
 *   brightness a star must not brighten or swell because the page moved. The
 *              flow heat that used to do this was removed, and this is the test
 *              that keeps it removed: the same stretch of sky, scrolled slowly
 *              and then fast, has to come out with the same ink on it.
 *   frames     the field is on the main thread, so scrolling has to stay near
 *              the refresh rate while it runs.
 *
 *   node tools/scroll-regression.mjs
 *   node tools/scroll-regression.mjs --browser firefox
 *
 * Firefox note, corrected 2026-10-21. The first version of this file claimed
 * headed Firefox did not paint at all here - a frozen animation clock, bytes
 * identical between screenshots - and that claim was wrong. The browser had
 * been launched against http://localhost:4323, and nothing is listening on
 * 4323: the user's server is astro dev on 4321, bound to IPv6 loopback only.
 * The refused connection was in the log and I read the resulting blank page as
 * a compositor failure instead of as a dead port.
 *
 * Firefox is fine. Against a live server its animation clock advances, pixels
 * change, and at 390x844 the board renders with 32 tiles, two columns, no
 * undersized tap targets and a clean console in both themes.
 *
 * Two habits follow from this, and both are worth keeping. A refused
 * connection is tool configuration, not site behaviour, and must be ruled out
 * before any browser diagnosis begins. And the probe that produced the false
 * reading diffed compressed PNG bytes, where re-encoding noise comes out as
 * "every pixel changed" - compare decoded pixels or an animation clock, never
 * the buffer. netstat on this machine also lists only the IPv4 table, so it
 * reports ::1 listeners as absent; Get-NetTCPConnection reads both.
 *
 * Diagnosis script: %LOCALAPPDATA%\Temp\opencode\firefox-paint-diagnosis.mjs
 * Port helper: tools/base-url.mjs
 */

import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const browserName = arg('--browser', 'chromium');
/**
 * `--gpu off` runs the whole invariant suite with hardware acceleration taken
 * away, which is the case Canvas2D is most likely to fall over in: no GPU
 * process, so the field has to be rastered on the CPU. Software rendering is
 * then confirmed rather than assumed, by asking the browser what it is using.
 */
const gpuOff = arg('--gpu', 'on') === 'off';
if (gpuOff && browserName === 'firefox') {
  console.log('note: --gpu off is a Chromium switch; Firefox runs with its own defaults');
}

/** px/s. The largest layer factor is 0.18, so the caps translate to a scroll
 *  that the soft clamp is allowed to hand over: 611px/s in the dark, 500 in
 *  the light. A clamped-away spike would run into the thousands. */
const CAPS = { dark: 110, light: 90 };

/**
 * Total ink, slow scroll against fast, over the same stretch of page.
 *
 * 30% is not precision. It is set below the size of the flare this guard exists
 * to catch: the heat term that used to key star brightness to flow speed read
 * 1.8x alpha and 1.6x radius on 158 of 209 stars, which is 80% and well clear of
 * this. The remaining slack absorbs what the comparison cannot control - two
 * runs of different length see slightly different sets of figures being born
 * and retired. Tightening it below about 25% just measures that churn.
 */
const BRIGHTNESS_TOLERANCE = 0.3;
const SCROLL_SLOW = 4300;
const SCROLL_FAST = 1400;

// Resolved by probing for a server that is actually accepting connections,
// rather than assuming the port. The assumption was wrong for long enough to
// produce a false diagnosis about Firefox, so it is worth the extra line.
const BASE = await baseUrl();

const launcher = browserName === 'firefox' ? firefox : chromium;
const browser = await launcher.launch({
  headless: false,
  ...(gpuOff && browserName !== 'firefox'
    ? { args: ['--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-rasterization'] }
    : {}),
});
const fails = [];
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) fails.push(`${label}: ${detail}`);
};

/**
 * Averages a run's samples inside one stretch of the page. Averaging the whole
 * trip instead compares two different sets of figures: the light theme births
 * and retires constellations as it goes, so "brightness changed" was really
 * "different sky, different moment".
 */
const inBand = (run, to) => {
  const lo = to * 0.7;
  const hi = to * 0.95;
  const s = run.samples.filter((p) => p.y >= lo && p.y <= hi);
  if (!s.length) return null;
  const mean = (f) => s.reduce((a, b) => a + f(b), 0) / s.length;
  return {
    n: s.length,
    total: mean((p) => p.total),
    alpha: mean((p) => p.alpha),
    lit: mean((p) => p.lit),
  };
};

/* Everything below runs inside the page and returns one summary. Sampling once
   per frame over the protocol would slow the very scroll being measured. */
async function runScroll([slowMs, fastMs]) {
  const cv = document.querySelector('canvas');
  if (!cv) return { error: 'no canvas' };
  const ctx = cv.getContext('2d', { willReadFrequently: true });

  // The whole viewport, drawn down to 128x86 and read once.
  //
  // Two numbers come out of it:
  //   total  every cell's alpha added up. Downsampling is linear, so this sum
  //          is the same however the stars happen to line up with the grid,
  //          which is what makes it comparable between two runs. It is
  //          brightness times how many stars are out.
  //   alpha  how opaque the lit cells were - brightness per star.
  //
  // A mean over the lit cells alone looked right and was not: a star that
  // happens to land across a cell edge is diluted, so the same field read 11%
  // apart between two runs of identical code.
  const small = document.createElement('canvas');
  small.width = 128;
  small.height = 86;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  function ink() {
    sctx.clearRect(0, 0, small.width, small.height);
    sctx.drawImage(cv, 0, 0, small.width, small.height);
    const d = sctx.getImageData(0, 0, small.width, small.height).data;
    let sum = 0;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i]) {
        sum += d[i];
        lit++;
      }
    }
    return { total: sum / 255, alpha: lit ? sum / lit / 255 : 0, lit };
  }

  // A direct per-star screen measurement was tried here and thrown away. The
  // published positions are compared frame to frame by index, and the light
  // theme births and retires figures as it scrolls: the list keeps its length
  // while a different constellation occupies slot 0, so the diff reports a star
  // jumping 130000px/s that was never on the page. There is no stable identity
  // to track through a recycle, so no honest per-star number is available.
  //
  // What can be asserted is the invariant the cap exists to protect. Under a
  // clean scroll a star is spring-held to its home, so its only screen motion
  // is the parallax, which is scrollVel times a layer factor - the largest of
  // which is PARALLAX_MAX. If the soft clamp ever stopped working, scrollVel
  // would spike into the thousands and this bound would go with it.
  const PARALLAX_MAX = 0.18;

  function scroll(ms, to) {
    return new Promise((res) => {
      const from = window.scrollY;
      const t0 = performance.now();
      let last = t0;
      let frames = 0;
      let stalls = 0;
      prev = null;
      const s = { parallax: 0, vel: 0, lag: 0, samples: [] };
      function step(t) {
        const dt = t - last;
        last = t;
        if (dt > 32) stalls++;
        frames++;
        const k = Math.min(1, (t - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const want = from + (to - from) * e;
        // `instant` is not a detail here. The document is smooth by default, and
        // a smooth scrollTo restarted sixty times a second never gets anywhere:
        // the page sat 6000px behind its target and reported a perfectly
        // well-behaved zero-speed scroll.
        window.scrollTo({ top: want, behavior: 'instant' });
        s.lag = Math.max(s.lag, Math.abs(window.scrollY - want));
        const d = window.__field || {};
        s.parallax = Math.max(s.parallax, Math.abs(Number(d.scrollVel) || 0) * PARALLAX_MAX);
        s.vel = Math.max(s.vel, Math.abs(Number(d.scrollVel) || 0));
        s.samples.push({ y: window.scrollY, ...ink() });
        if (k < 1) requestAnimationFrame(step);
        else
          res({
            parallax: s.parallax,
            scrollVel: s.vel,
            lag: s.lag,
            frames,
            stalls,
            ms: t - t0,
            scrollY: window.scrollY,
            samples: s.samples,
          });
      }
      requestAnimationFrame(step);
    });
  }

  return (async () => {
    const to = Math.min(6000, document.documentElement.scrollHeight - window.innerHeight);
    const slow = await scroll(slowMs, to);
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 900));
    const fast = await scroll(fastMs, to);
    window.scrollTo(0, 0);
    return { to, slow, fast, backend: (window.__field || {}).backend || '?' };
  })();
}

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch (e) {
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

  if (theme === 'light') {
    const gpu = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { webgl: false };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        webgl: true,
        renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown',
      };
    });
    console.log(
      `\n  gpu --disable-gpu=${gpuOff ? 'on' : 'off'}  webgl=${gpu.webgl ? 'available' : 'none'}` +
        `${gpu.renderer ? `  renderer "${gpu.renderer}"` : ''}`
    );
  }

  console.log(`\n${theme} theme - ${browserName}`);
  const r = await page.evaluate(runScroll, [SCROLL_SLOW, SCROLL_FAST]);

  if (r.error) {
    check(false, 'field is running', r.error);
    await context.close();
    continue;
  }

  console.log(
    `  scroll 0..${r.to}px   slow ${SCROLL_SLOW}ms -> ${r.slow.frames} frames, ` +
      `fast ${SCROLL_FAST}ms -> ${r.fast.frames} frames`
  );
  const slowBand = inBand(r.slow, r.to);
  const fastBand = inBand(r.fast, r.to);

  console.log(
    `  observed  scrollVel ${r.slow.scrollVel.toFixed(0)}/${r.fast.scrollVel.toFixed(0)}px/s, ` +
      `carried up to ${r.slow.parallax.toFixed(1)}/${r.fast.parallax.toFixed(1)}px/s, ` +
      `window lag ${r.slow.lag.toFixed(1)}px`
  );
  console.log(
    slowBand && fastBand
      ? `  same stretch of page (${(r.to * 0.7).toFixed(0)}-${(r.to * 0.95).toFixed(0)}px, ` +
          `${slowBand.n}/${fastBand.n} frames): total ink ${slowBand.total.toFixed(2)} slow vs ` +
          `${fastBand.total.toFixed(2)} fast, ${slowBand.lit.toFixed(0)}/${fastBand.lit.toFixed(0)} lit cells`
      : '  no samples landed in the comparison band'
  );

  // A reading of zero everywhere would otherwise pass every cap silently. The
  // scroll has to have actually moved, and the field has to have noticed.
  check(
    r.slow.lag < 4 && r.fast.lag < 4,
    'the scripted scroll actually moved the page',
    `window lagged ${r.slow.lag.toFixed(1)}/${r.fast.lag.toFixed(1)}px behind its target`
  );
  check(
    r.slow.scrollVel > 20 && r.fast.scrollVel > 20,
    'the field saw the scroll',
    `scrollVel ${r.slow.scrollVel.toFixed(0)}/${r.fast.scrollVel.toFixed(0)}px/s`
  );
  check(
    !!slowBand && !!fastBand && slowBand.lit > 0 && fastBand.lit > 0,
    'the field was drawing while it scrolled',
    slowBand && fastBand
      ? `${slowBand.lit.toFixed(0)} and ${fastBand.lit.toFixed(0)} lit cells`
      : 'no samples in band'
  );
  const cap = CAPS[theme];
  for (const [label, run] of [
    ['slowly', r.slow],
    ['at speed', r.fast],
  ]) {
    check(
      run.parallax <= cap,
      `no star is carried past ${cap}px/s by parallax (${label})`,
      `${run.parallax.toFixed(1)}px/s from a ${run.scrollVel.toFixed(0)}px/s scroll`
    );
  }

  if (slowBand && fastBand) {
    const drift =
      Math.abs(fastBand.total - slowBand.total) / Math.max(slowBand.total, 1e-6);
    check(
      drift <= BRIGHTNESS_TOLERANCE,
      'brightness does not follow scroll speed',
      `total ink ${slowBand.total.toFixed(2)} slow vs ${fastBand.total.toFixed(2)} fast ` +
        `(${(drift * 100).toFixed(1)}% apart, tol ${(BRIGHTNESS_TOLERANCE * 100).toFixed(0)}%)`
    );
  }

  const fps = (n) => (n.frames / (n.ms / 1000)).toFixed(1);
  check(
    Number(fps(r.slow)) >= 45 && Number(fps(r.fast)) >= 45,
    'holds frame rate while scrolling',
    `${fps(r.slow)}fps slow, ${fps(r.fast)}fps fast, ${r.slow.stalls + r.fast.stalls} frames over 32ms`
  );

  check(errors.length === 0, 'no console errors', errors.join(' | ') || 'clean');

  await context.close();
}

await browser.close();

console.log(`\n${'='.repeat(60)}`);
if (fails.length) {
  console.log(`FAILED: ${fails.length}`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('PASS: scrolling hands over to the field without tearing or flaring');
}

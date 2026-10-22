/**
 * The reduced-motion fallback, measured rather than assumed.
 *
 * The brief requires that under prefers-reduced-motion the board is still
 * fully readable: every plate present, every name visible, no tilt, no
 * staggered reveal, no flow field. The gates for that live in two files
 * (src/scripts/specimen.ts reads the media query, src/scripts/field.ts is
 * skipped by Ambient.astro) and neither has been checked in a real browser
 * until now.
 *
 *   node tools/verify-reduced.mjs
 *   node tools/verify-reduced.mjs --browser firefox
 */

import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const browserName = arg('--browser', 'chromium');

const launcher = browserName === 'firefox' ? firefox : chromium;
const browser = await launcher.launch({ headless: false });

const fails = [];
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) fails.push(`${label}: ${detail}`);
};

for (const theme of ['light', 'dark']) {
  console.log(`\n${theme} theme, prefers-reduced-motion: reduce`);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.tile')];
    const names = tiles.map((t) => t.querySelector('.tile__name')?.textContent.trim() ?? '');
    const plates = [...document.querySelectorAll('.plate')];

    // Anything mid-reveal is still short of its resting state.
    const animating = tiles.filter((t) => {
      const cs = getComputedStyle(t);
      return parseFloat(cs.opacity) < 0.99 || cs.transform !== 'none';
    });

    // A context line that is neither hidden nor shown is a tile stuck
    // part-way through its reveal.
    const stuck = tiles.filter((t) => {
      const c = t.querySelector('.tile__context');
      if (!c || !c.textContent.trim()) return false;
      const o = parseFloat(getComputedStyle(c).opacity);
      return o > 0.01 && o < 0.99;
    });

    // Under reduced motion the flow field must not be running. The canvas
    // either does not exist or has nothing painted on it.
    const canvas = document.querySelector('canvas');
    let canvasInk = null;
    if (canvas && canvas.width && canvas.height) {
      const g = canvas.getContext('2d', { willReadFrequently: true });
      const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) lit++;
      canvasInk = lit;
    }

    // The specimen script marks the board once it has taken over; the
    // resting state must be reachable without it.
    return {
      tiles: tiles.length,
      plates: plates.length,
      named: names.filter(Boolean).length,
      animating: animating.length,
      stuck: stuck.length,
      hasSpecimenFlag: document.documentElement.hasAttribute('data-specimen'),
      hasMotionFlag: document.documentElement.hasAttribute('data-motion'),
      canvasInk,
      fieldPublished: !!window.__field,
      docHeight: document.documentElement.scrollHeight,
    };
  });

  check(state.tiles === 32, 'every skill is present', `${state.tiles} tiles`);
  check(state.plates === 5, 'every plate is present', `${state.plates} plates`);
  check(
    state.named === state.tiles,
    'every tile shows its name',
    `${state.named} of ${state.tiles} named`
  );
  check(
    state.animating === 0,
    'nothing is mid-reveal or tilted',
    `${state.animating} tile(s) not at rest`
  );
  check(
    state.stuck === 0,
    'no context line is stuck part-way',
    `${state.stuck} tile(s) between hidden and shown`
  );
  check(
    !state.hasMotionFlag,
    'the reveal animation is not armed',
    `data-motion=${state.hasMotionFlag}`
  );
  check(
    state.canvasInk === 0 || state.canvasInk === null,
    'the flow field is not drawing',
    state.canvasInk === null ? 'no canvas' : `${state.canvasInk} lit pixels`
  );
  check(!state.fieldPublished, 'the field is not running at all', `__field=${!!state.fieldPublished}`);
  check(state.docHeight > 6000, 'the page still lays out in full', `${state.docHeight}px`);
  check(errors.length === 0, 'no console errors', errors.join(' | ') || 'clean');

  await page.screenshot({
    path: `${process.env.LOCALAPPDATA}/Temp/opencode/shots/reduced-${theme}-${browserName}.png`,
    fullPage: false,
  });
  await context.close();
}

await browser.close();

console.log(`\n${'='.repeat(60)}`);
if (fails.length) {
  console.log(`FAILED: ${fails.length}`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('PASS: the reduced-motion fallback keeps the board readable and still');
}

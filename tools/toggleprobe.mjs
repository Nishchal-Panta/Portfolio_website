/**
 * Why the theme toggle never becomes "stable" for a click, in whichever engine
 * is failing.
 *
 * Playwright's actionability wait needs two consecutive animation frames with
 * an unchanged bounding box. This samples the box directly, together with
 * anything that would indicate the page is mid-transition, so the cause is
 * reported rather than guessed at from a 30s timeout.
 */
import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const URL = `${BASE}?debug=1`;
const which = process.argv[2] === 'firefox' ? firefox : chromium;

const b = await which.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.bringToFront();
await p.waitForTimeout(900);

// The suite reaches this click after scrolling to the bottom of the test range,
// so reproduce that state: sticky positioning behaves differently there.
const scrollTo = Number(process.argv[3] ?? 0);
if (scrollTo) {
  await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollTo);
  await p.waitForTimeout(1200);
}

// Same pre-amble as the suite: hover several positions first.
for (const [x, y] of [[720, 450], [400, 250], [1050, 600], [700, 180], [1100, 250]]) {
  await p.mouse.move(x, y);
  await p.waitForTimeout(220);
}

const state = await p.evaluate(async () => {
  const el = document.querySelector('[data-theme-toggle]');
  const boxes = [];
  const sample = () => {
    const r = el.getBoundingClientRect();
    boxes.push([+r.x.toFixed(2), +r.y.toFixed(2), +r.width.toFixed(2), +r.height.toFixed(2)]);
  };
  for (let i = 0; i < 20; i++) {
    sample();
    await new Promise((r) => requestAnimationFrame(r));
  }
  const uniq = new Set(boxes.map((q) => q.join(',')));
  const cs = getComputedStyle(el);
  const head = document.querySelector('.site-header')?.getBoundingClientRect();
  return {
    samples: boxes.length,
    distinct: uniq.size,
    first: boxes[0],
    last: boxes[boxes.length - 1],
    visible: cs.visibility,
    display: cs.display,
    opacity: cs.opacity,
    transform: cs.transform,
    animation: cs.animationName,
    disabled: el.disabled,
    scrollY: Math.round(scrollY),
    viewTransitionActive:
      !!document.querySelector('.view-transition') || !!document.documentElement.classList.contains('theme-animating'),
    headerTop: head ? Math.round(head.y) : null,
    supportsVT: typeof document.startViewTransition === 'function',
  };
});
console.log('geometry:', JSON.stringify(state, null, 2));

const chain = await p.evaluate(() => {
  const out = [];
  let el = document.querySelector('.site-header');
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    out.push({
      tag: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
      position: cs.position,
      overflow: `${cs.overflowX}/${cs.overflowY}`,
      transform: cs.transform,
      height: Math.round(el.getBoundingClientRect().height),
      top: Math.round(el.getBoundingClientRect().top + scrollY),
    });
    el = el.parentElement;
  }
  return {
    chain: out,
    headerPosition: getComputedStyle(document.querySelector('.site-header')).position,
    headerTop: Math.round(document.querySelector('.site-header').getBoundingClientRect().top),
    scrollingElement: document.scrollingElement?.tagName,
  };
});
console.log('header ancestors:', JSON.stringify(chain, null, 2));

const t0 = Date.now();
try {
  await p.click('[data-theme-toggle]', { timeout: 8000 });
  console.log(`click OK in ${Date.now() - t0}ms`);
} catch (e) {
  console.log(`click FAILED after ${Date.now() - t0}ms: ${e.message.split('\n').slice(0, 6).join(' | ')}`);
  const after = await p.evaluate(() => {
    const el = document.querySelector('[data-theme-toggle]');
    const r = el.getBoundingClientRect();
    return { box: [r.x, r.y, r.width, r.height], scrollY: Math.round(scrollY) };
  });
  console.log('after failure:', JSON.stringify(after));
}
await b.close();

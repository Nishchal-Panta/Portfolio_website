/**
 * Scratch: is the cached rectangle where the painted rectangle is?
 *
 * The box cache measures positions from the offset chain, which is layout and
 * therefore blind to transforms, and turns them into viewport coordinates by
 * subtracting the scroll offset. This checks both halves of that claim on the
 * live page, at a spread of scroll positions:
 *
 *   1. formula   for an element with no transformed, sticky or fixed ancestor
 *                at all, chainDoc must equal rect + scrollY.
 *   2. decision  does the chain-based viewport filter reach the same verdict
 *                as the live rectangle, for the same gutter? A disagreement
 *                is a photograph or a paragraph the field would treat
 *                differently from before.
 *   3. deviation how far each cached text box is from where the copy is
 *                actually painted, which is the cost of not re-reading.
 *
 *   node tools/_layoutpos.mjs
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();

const SELECTORS = [
  '.opening h1',
  '.movement-title',
  '.chapter__title',
  '.opening__line',
  '.movement-lede',
  '.story-body > *',
  '.chapter__body > p',
  '.event__summary',
  '.rail',
  'img',
  'video',
  'canvas',
];

const page = await (async () => {
  const b = await chromium.launch({ headless: false, args: ['--disable-gpu=off'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.__b = b;
  return p;
})();

await page.goto(`${BASE}?debug=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const docH = await page.evaluate(() => document.documentElement.scrollHeight);
const stops = [];
for (let y = 0; y < docH - 800; y += 900) stops.push(y);

const sample = (role, gutter) =>
  page.evaluate(
    ({ SELECTORS, gutter }) => {
      const chain = (el) => {
        let x = 0;
        let y = 0;
        let n = el;
        for (;;) {
          x += n.offsetLeft;
          y += n.offsetTop;
          const p = n.offsetParent;
          if (!p) break;
          x += p.clientLeft;
          y += p.clientTop;
          n = p;
        }
        return { l: x, t: y, r: x + el.offsetWidth, b: y + el.offsetHeight };
      };
      const desc = (el) => {
        let s = el.tagName.toLowerCase();
        if (el.className && typeof el.className === 'string')
          s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
        return s;
      };
      const judge = (el) => {
        let clean = true;
        let sticky = false;
        let fixed = false;
        let drift = false;
        for (let a = el; a && a !== document.body; a = a.parentElement) {
          const cs = getComputedStyle(a);
          const t = cs.transform;
          if (t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') {
            clean = false;
            if (a.matches('.movement-head, .figure__frame')) drift = true;
          }
          if (cs.position === 'sticky') {
            clean = false;
            sticky = true;
          }
          if (cs.position === 'fixed') {
            clean = false;
            fixed = true;
          }
        }
        return { clean, sticky, fixed, drift };
      };
      const vh = innerHeight;
      const sy = scrollY;
      const out = [];
      for (const sel of SELECTORS)
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          const c = chain(el);
          const w = c.r - c.l;
          const h = c.b - c.t;
          const tiny = w < 40 || h < 8;
          const live = { l: r.left, t: r.top, r: r.right, b: r.bottom };
          const chainV = { l: c.l, t: c.t - sy, r: c.r, b: c.b - sy };
          const boxOK = (b) => b.r - b.l >= 40 && b.b - b.t >= 8;
          const inView = (b) => boxOK(b) && !(b.b < -gutter || b.t > vh + gutter);
          /* A display:none element has zeros on both sides, and comparing its
             document coordinate against zero plus the scroll offset measures
             nothing at all. */
          if (r.width === 0 && r.height === 0) continue;
          if (tiny && (r.width < 80 || r.height < 60)) continue;
          out.push({
            sel,
            who: desc(el),
            ...judge(el),
            tiny,
            dl: c.l,
            dt: c.t,
            vl: r.left,
            vt: r.top,
            vw: r.width,
            vh: r.height,
            liveIn: inView(live),
            chainIn: inView(chainV),
          });
        }
      return { sy, vh, out };
    },
    { SELECTORS, gutter }
  );

const agg = {
  cleanMax: 0,
  cleanWho: '',
  chainErrMax: 0,
  chainWho: '',
  disagree: [],
  stickySkew: 0,
  stickyWho: '',
};

for (const gutter of [200, 240]) {
  for (const y of stops) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(120);
    const r = await sample('all', gutter);
    for (const it of r.out) {
      /* x does not move with the scroll; y does. */
      const ex = Math.abs(it.dl - it.vl);
      const ey = Math.abs(it.dt - (it.vt + r.sy));
      if (it.clean && Math.max(ex, ey) > agg.cleanMax) {
        agg.cleanMax = Math.max(ex, ey);
        agg.cleanWho = `${it.who} @${r.sy}`;
        agg.chainErrMax = agg.cleanMax;
        agg.chainWho = it.who;
      }
      /* `fixed` elements are mode 1 in the real cache: their viewport
         rectangle is taken once and never offset, so comparing the naive
         chain against the live rect for them measures something the code
         never does. */
      if (it.liveIn !== it.chainIn && !it.fixed)
        agg.disagree.push({ gutter, sy: r.sy, who: it.who, live: it.liveIn, chain: it.chainIn, sticky: it.sticky, drift: it.drift });
      if (it.sticky) {
        const e = Math.abs(it.dt - (it.vt + r.sy));
        if (e > agg.stickySkew) {
          agg.stickySkew = e;
          agg.stickyWho = `${it.who} @${r.sy}`;
        }
      }
    }
  }
}

console.log(`stops ${stops.length}   scroll positions across ${docH}px`);
console.log(
  `formula   worst |chainDoc - (rect + scroll)| for elements with no transform, sticky or fixed ancestor: ${agg.cleanMax.toFixed(2)}px  (${agg.cleanWho || 'n/a'})`
);
console.log(
  `sticky    worst chain-vs-live for a stuck element: ${agg.stickySkew.toFixed(1)}px  (${agg.stickyWho || 'n/a'})`
);
if (!agg.disagree.length) {
  console.log('decision  chain filter and live filter agree at every stop, both gutters');
} else {
  const uniq = new Map();
  for (const d of agg.disagree) {
    const k = `${d.who}|${d.live}|${d.chain}`;
    uniq.set(k, (uniq.get(k) || 0) + 1);
  }
  console.log(`decision  ${agg.disagree.length} disagreements, ${uniq.size} distinct:`);
  for (const [k, n] of uniq) console.log(`    ${n}x  ${k}`);
}

/* --- 3. what the running field actually published ------------------------- */
/* Read at every stop rather than at one, because the interesting cases are
   spread down the page: a sticky rail that is stuck, a chapter head carrying
   its drift, a paragraph that has not finished revealing. */
const readBoxes = () =>
  page.evaluate(() => {
    const list = window.__textBoxes || [];
    return list.map((b) => {
      const r = b.el ? b.el.getBoundingClientRect() : null;
      let who = '?';
      if (b.el && b.el.tagName) {
        who = b.el.tagName.toLowerCase();
        if (typeof b.el.className === 'string' && b.el.className.trim())
          who += '.' + b.el.className.trim().split(/\s+/).slice(0, 2).join('.');
      }
      return {
        who,
        mode: b.mode,
        drift: !!b.driftEl,
        kind: b.kind,
        left: b.left,
        top: b.top,
        right: b.right,
        bottom: b.bottom,
        vl: r ? r.left : 0,
        vt: r ? r.top : 0,
        vr: r ? r.right : 0,
        vb: r ? r.bottom : 0,
        tw: b.right - b.left,
        th: b.bottom - b.top,
      };
    });
  });

const err = (b) =>
  Math.max(
    Math.abs(b.left - b.vl),
    Math.abs(b.top - b.vt),
    Math.abs(b.right - b.vr),
    Math.abs(b.bottom - b.vb)
  );

const published = [];
for (const y of stops) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await page.waitForTimeout(120);
  for (const b of await readBoxes()) published.push({ sy: y, ...b });
}

published.sort((a, b) => err(b) - err(a));
console.log(`\npublished boxes sampled at ${stops.length} stops: ${published.length} box-frames`);
console.log('worst five cached-vs-painted offsets:');
for (const b of published.slice(0, 5)) {
  console.log(
    `    ${err(b).toFixed(1)}px  ${b.who}  mode=${b.mode} drift=${b.drift} kind=${b.kind}` +
      `  box ${b.tw.toFixed(0)}x${b.th.toFixed(0)}` +
      `  cached top ${b.top.toFixed(0)}..${b.bottom.toFixed(0)} painted ${b.vt.toFixed(0)}..${b.vb.toFixed(0)} @${b.sy}`
  );
}
const hist = new Map();
for (const b of published) {
  const k = b.drift
    ? 'inside a drifting container'
    : b.mode === 2
      ? 'sticky'
      : b.mode === 1
        ? 'fixed'
        : 'plain flow';
  const cur = hist.get(k) || { n: 0, max: 0, who: '' };
  cur.n++;
  if (err(b) > cur.max) {
    cur.max = err(b);
    cur.who = b.who;
  }
  hist.set(k, cur);
}
for (const [k, v] of hist)
  console.log(`    ${k}: ${v.n} box-frames, worst ${v.max.toFixed(1)}px (${v.who})`);

/* The verdict that matters: was any box PUBLISHED while its copy was not on
   screen, or missing while it was? A box that is merely a few pixels off is
   the cost of not re-reading; a box in the wrong place is a bug. */
const offBy = published.filter((b) => err(b) > 32);
console.log(
  `box-frames more than 32px from the painted rectangle: ${offBy.length} of ${published.length} (${((100 * offBy.length) / Math.max(1, published.length)).toFixed(1)}%)`
);
for (const b of offBy.slice(0, 8))
  console.log(`    ${err(b).toFixed(0)}px  ${b.who} mode=${b.mode} drift=${b.drift} @${b.sy}`);

/* The measure that actually decides whether the field looks the same: only the
   boxes whose PAINTED rectangle reaches the window can change a pixel. */
const visible = published.filter((b) => b.vb > 0 && b.vt < 900);
const visWorst = visible.reduce((m, b) => Math.max(m, err(b)), 0);
const visOff = visible.filter((b) => err(b) > 4).length;
console.log(
  `\nboxes whose painted rectangle reaches the window: ${visible.length} box-frames, worst offset ${visWorst.toFixed(1)}px, ${visOff} more than 4px off`
);
for (const b of visible
  .slice()
  .sort((a, b2) => err(b2) - err(a))
  .slice(0, 5))
  console.log(
    `    ${err(b).toFixed(1)}px  ${b.who} mode=${b.mode} drift=${b.drift} cached ${b.top.toFixed(0)}..${b.bottom.toFixed(0)} painted ${b.vt.toFixed(0)}..${b.vb.toFixed(0)} @${b.sy}`
  );

await page.__b.close();

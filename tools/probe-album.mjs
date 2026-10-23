/**
 * The album, measured.
 *
 * The row is now an ordered conveyor: three photographs, in the order the
 * files are named, the leftmost leaving to the left and the next entering
 * from the right, round the end of the album. This checks what that promises,
 * and what it used to get wrong:
 *
 *   - nothing of the old controls is left - no pause, no shuffle, no counter;
 *   - the sequence is the data's own, wraps at the end, and repeats nothing
 *     inside a loop, over two whole loops of the album;
 *   - it runs only while the section is on screen: arriving starts it at once
 *     rather than after an interval, leaving stops the timer, the step in
 *     flight and every decode, and 800px out the first six photographs are
 *     decoded so the opening steps never hitch;
 *   - it advances every 1.3-1.6s and each step takes 300-400ms, so every
 *     photograph is on screen about 3s or more across one loop;
 *   - a step holds its frame: p95 frame time under 16.7ms and no task over
 *     50ms;
 *   - the row's height never changes between steps, so nothing outside the
 *     section can shift;
 *   - every photograph keeps its own aspect ratio, at one shared height;
 *   - the arrows are invisible at rest but still focusable, come up on hover
 *     and on focus, are centred, at least 44px, and work from the keyboard;
 *   - the row stops for hover, focus, the lightbox, being off-screen and a
 *     hidden tab, with no visible pause control anywhere;
 *   - under reduced motion there is no timer at all, but the arrows still
 *     walk the album;
 *   - without script every photograph is there and reachable;
 *   - `sizes` describes the box the photograph is actually drawn into.
 *
 *   node tools/probe-album.mjs [--base URL]
 */

import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const only = (process.env.ENGINE ?? 'chromium') === 'firefox' ? firefox : chromium;
const ENGINE_NAME = process.env.ENGINE ?? 'chromium';

let failures = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok    ' : 'FAIL  '}${label}${!cond && detail ? `\n        ${detail}` : ''}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** What the row says it is doing, read off the attributes the script keeps
 *  for exactly this purpose - timer armed, step in flight, decodes done. */
const albumState = (p) =>
  p.evaluate(() => {
    const a = document.querySelector('[data-album]');
    const g = (k, d) => a.dataset[k] ?? d;
    return {
      onScreen: g('onScreen', '0'),
      timer: g('timer', 'off'),
      busy: g('busy', '0'),
      held: g('held', '?'),
      warmed: g('warmed', '0'),
      decodes: Number(g('decodes', '0')),
      swaps: Number(g('swaps', '0')),
    };
  });

/** Move the album to a known place in the window: `+400` puts its top 400px
 *  below the bottom edge - near enough to warm up, not visible at all. */
const placeAlbum = (p, delta) =>
  p.evaluate((d) => {
    const top = document.querySelector('#album').getBoundingClientRect().top + window.scrollY;
    // Positive: put the album's top that far BELOW the bottom edge - near
    // enough for the 800px warm-up margin to reach it, far enough that the
    // threshold which starts the row does not. Negative: the very top of the
    // document, where an album several sections down is out of reach of both.
    const y = d >= 0 ? top - window.innerHeight - d : 0;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    return window.scrollY;
  }, delta);

const browser = await only.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });

console.log(`\nalbum  (${ENGINE_NAME}${process.env.THEME ? `, ${process.env.THEME}` : ''}, ${BASE})`);

if (process.env.THEME) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), process.env.THEME);
  await page.waitForTimeout(300);
}

/* --- 0. it runs only while it can be seen --------------------------------- */

console.log('\nstart and stop');

// The album is a long way below the window here, so nothing at all should be
// running: no timer, no step, no decode. This is the state a reader who never
// scrolls down to it is left in.
const away0 = await albumState(page);
ok(
  away0.onScreen === '0' && away0.timer === 'off' && away0.busy === '0',
  `far below the window, nothing is running (onScreen ${away0.onScreen}, timer ${away0.timer}, busy ${away0.busy}, held "${away0.held}")`
);
const quiet = [];
for (let i = 0; i < 8; i++) {
  await sleep(400);
  quiet.push(await albumState(page));
}
ok(
  quiet.every((s) => s.decodes === away0.decodes && s.swaps === away0.swaps && s.timer === 'off' && s.busy === '0'),
  `and it stays that way for ${((8 * 400) / 1000).toFixed(0)}s (decodes ${away0.decodes} -> ${quiet[7].decodes}, swaps ${away0.swaps} -> ${quiet[7].swaps})`,
  quiet.map((s) => `d${s.decodes}/s${s.swaps}/${s.timer}`).join(' ')
);

/* Within 800px - still not on screen - the first six are decoded. Warm, not
   started: the conveyor itself is still held. */
await placeAlbum(page, 400);
let warmed = await albumState(page);
for (let i = 0; i < 40 && warmed.decodes < 6; i++) {
  await sleep(100);
  warmed = await albumState(page);
}
ok(warmed.warmed === '1', 'within 800px the warm-up fires');
ok(
  warmed.decodes === 6,
  `and it decodes the first six photographs exactly (${warmed.decodes} decodes, not one more)`,
  `onScreen ${warmed.onScreen}, timer ${warmed.timer}`
);
ok(
  warmed.onScreen === '0' && warmed.timer === 'off' && warmed.busy === '0' && warmed.swaps === 0,
  'but does not start the conveyor - warming is not running'
);

/* Arriving starts it at once rather than after a full interval. The row keeps
   its own two stamps for this - when it counted itself on screen, and when
   the step actually began - so the delay is measured in the page's clock
   across one round trip, not across a dozen polls, and a miss can be
   explained by the row's own state rather than guessed at. */
const arrived = Date.now();
await page.evaluate(() =>
  document.querySelector('#album').scrollIntoView({ behavior: 'instant', block: 'center' })
);
let stamp = { enter: 0, begin: 0 };
let seen;
for (let i = 0; i < 150 && !stamp.begin; i++) {
  await sleep(15);
  stamp = await page.evaluate(() => {
    const a = document.querySelector('[data-album]');
    return { enter: Number(a.dataset.enter ?? 0), begin: Number(a.dataset.begin ?? 0) };
  });
}
const observed = Date.now() - arrived;
if (!stamp.begin) {
  const why = await page.evaluate(() => ({ ...document.querySelector('[data-album]').dataset }));
  ok(false, `the first step never started (limit 300ms after ${observed}ms of watching)`, JSON.stringify(why));
} else {
  ok(
    stamp.begin - stamp.enter <= 300,
    `the first step begins ${stamp.begin - stamp.enter}ms after the section came into view (limit 300ms, ${observed}ms of wall clock end to end)`
  );
}
seen = await albumState(page);
ok(seen.onScreen === '1', 'and the section counts itself on screen');

await page.mouse.move(4, 4);
await sleep(400);

/* Leaving stops everything, and it stays stopped. */
await placeAlbum(page, -100000);
await sleep(900); // let the step in flight, if any, end first
const left = await albumState(page);
ok(
  left.onScreen === '0' && left.timer === 'off' && left.busy === '0' && /offscreen/.test(left.held),
  `leaving stops it (onScreen ${left.onScreen}, timer ${left.timer}, busy ${left.busy}, held "${left.held}")`
);
const away = [];
for (let i = 0; i < 15; i++) {
  await sleep(400);
  away.push(await albumState(page));
}
ok(
  away.every((s) => s.decodes === left.decodes && s.swaps === left.swaps && s.timer === 'off' && s.busy === '0'),
  `no timer, no step and no decode for 6s off screen (decodes ${left.decodes} -> ${away[14].decodes}, swaps ${left.swaps} -> ${away[14].swaps})`,
  away.map((s) => `d${s.decodes}/s${s.swaps}/${s.timer}/${s.busy}`).join(' ')
);

/* And coming back starts it again, just as promptly. */
const before = await albumState(page);
await page.evaluate(() =>
  document.querySelector('#album').scrollIntoView({ behavior: 'instant', block: 'center' })
);
await page.mouse.move(4, 4);
const back = Date.now();
let resume = { enter: 0, begin: 0 };
for (let i = 0; i < 150 && resume.begin <= (stamp.begin || 0); i++) {
  await sleep(15);
  resume = await page.evaluate(() => {
    const a = document.querySelector('[data-album]');
    return { enter: Number(a.dataset.enter ?? 0), begin: Number(a.dataset.begin ?? 0) };
  });
}
seen = await albumState(page);
if (resume.begin <= (stamp.begin || 0)) {
  ok(false, `re-entry never started the row again`, JSON.stringify({ ...seen }));
} else {
  ok(
    resume.begin - resume.enter <= 300,
    `re-entry starts it again ${resume.begin - resume.enter}ms after the section is back (limit 300ms, ${Date.now() - back}ms of wall clock)`
  );
}
ok(seen.onScreen === '1', 'and the section counts itself on screen');
ok(seen.swaps > before.swaps, `and it stepped (${before.swaps} -> ${seen.swaps})`);

await sleep(1200);
await page.mouse.move(4, 4);
await sleep(400);

/* --- 1. what must be gone ------------------------------------------------- */

console.log('\nremoval');

const dom = await page.evaluate(() => {
  const root = document.querySelector('[data-album]');
  return {
    toggle: !!root.querySelector('[data-album-toggle]'),
    shuffle: !!root.querySelector('[data-album-shuffle]'),
    count: !!root.querySelector('[data-album-count]'),
    status: !!root.querySelector('[data-album-status]'),
    controls: !!root.querySelector('.album__controls'),
    text: root.textContent.replace(/\s+/g, ' ').trim(),
  };
});
ok(!dom.toggle && !dom.shuffle && !dom.count && !dom.status && !dom.controls, 'no pause, shuffle, counter or status element');
ok(!/showing\s+\d+\s+of\s+\d+/i.test(dom.text), 'no "Showing N of M" text in the album');

/* Nothing but the three photographs and their section spacing under the row:
   the stage's siblings are exactly the lightbox and the live region. */
const siblings = await page.evaluate(() => {
  const stage = document.querySelector('[data-album-stage]');
  return [...stage.parentElement.children].map((c) => c.className || c.tagName.toLowerCase());
});
ok(
  siblings.every((s) => /album__stage|album__lightbox|visually-hidden/.test(String(s))),
  `nothing but the row, the lightbox and the hidden live region (${siblings.join(', ')})`
);

/* --- 2. geometry ---------------------------------------------------------- */

console.log('\ngeometry');

const geo = await page.evaluate(() => {
  const row = document.querySelector('[data-album-row]');
  const figs = [...row.querySelectorAll('.album__figure')].filter(
    (f) => !f.hidden && !f.classList.contains('is-leaving')
  );
  const rects = figs.map((f) => {
    const r = f.getBoundingClientRect();
    const img = f.querySelector('img');
    return {
      i: Number(f.dataset.i),
      slot: f.dataset.slot,
      w: r.width,
      h: r.height,
      ratio: img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null,
      boxRatio: r.width / r.height,
      declared: f.getAttribute('style') ?? '',
    };
  });
  const rr = row.getBoundingClientRect();
  const lines = new Set(rects.map((r) => Math.round(r.h))).size;
  return {
    visible: figs.length,
    rowWidth: rr.width,
    rowHeight: rr.height,
    lines,
    rects,
  };
});

ok(geo.visible === 3, `three photographs are showing (${geo.visible})`);
ok(
  geo.rects.every((r) => Math.abs(r.h - geo.rects[0].h) < 0.6),
  `all three share one height (${geo.rects.map((r) => r.h.toFixed(1)).join(', ')})`
);
ok(
  geo.rects.every((r) => r.ratio && Math.abs(r.boxRatio - r.ratio) / r.ratio <= 0.01),
  'every photograph is drawn at its own aspect ratio, within 1%',
  geo.rects
    .filter((r) => r.ratio && Math.abs(r.boxRatio - r.ratio) / r.ratio > 0.01)
    .map((r) => `#${r.i} source ${r.ratio.toFixed(4)} drawn ${r.boxRatio.toFixed(4)}`)
    .join(' | ')
);
// No style="…" in the markup: the site's CSP is `style-src 'self'`, which
// refuses inline style attributes, so a ratio passed that way never reaches
// the page. The figures do get CSSOM properties (`order`, and `position` and
// `left` for the one leaving) - those are not markup attributes and are not
// blocked. The markup itself is checked statically in tools/verify-album.mjs.
ok(
  geo.rects.every((r) => !/--ar/.test(r.declared)),
  'no --ar is passed in as a style the CSP would refuse',
  geo.rects.map((r) => `#${r.i} ${r.declared}`).join(' | ')
);
ok(
  geo.rects.reduce((a, r) => a + r.w, 0) + 24 <= geo.rowWidth + 0.5,
  `the three fit inside the row (${geo.rects.map((r) => r.w.toFixed(0)).join('+')} + gaps of ${geo.rowWidth.toFixed(0)}px)`
);

/* --- 3. the sequence, over two whole loops -------------------------------- */

console.log('\nsequence (two loops)');

// Timestamps of every change, taken in the page by a MutationObserver, so the
// interval is the real one and not the probe's polling rate.
await page.evaluate(() => {
  const root = document.querySelector('[data-album]');
  const seen = [];
  const record = () => {
    const row = root.querySelector('[data-album-row]');
    const on = [...row.querySelectorAll('.album__figure')]
      .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
      .sort((a, b) => Number(a.dataset.slot) - Number(b.dataset.slot))
      .map((f) => Number(f.dataset.i));
    seen.push({ t: performance.now(), ids: on });
  };
  record();
  window.__seq = seen;
  new MutationObserver(() => {
    // Two records can land for one step (the leaving figure leaving the
    // visible set, the new one arriving); collapse anything inside a frame.
    if (seen.length && performance.now() - seen[seen.length - 1].t < 60) seen.pop();
    record();
  }).observe(root, { attributes: true, attributeFilter: ['data-swaps'] });
});

const ALBUM_SIZE = 13;
// One loop is one step per photograph: 13 steps at ~1.45s, so a loop is about
// 19s and every photograph has been on screen by the end of it. Two loops is
// the check, because one loop cannot distinguish "ordered" from "ordered with
// a jump at the wrap".
const LOOP_MS = ALBUM_SIZE * 2 * 1450;
console.log(`        waiting ${(LOOP_MS / 1000).toFixed(0)}s for two loops...`);
await page.mouse.move(4, 4);
await sleep(LOOP_MS + 2000);

const seq = await page.evaluate(() => window.__seq);
const steps = seq.slice(1);
ok(steps.length >= ALBUM_SIZE * 2 - 1, `two whole loops' worth of steps (${steps.length})`);

// The first interval is the remainder of a timer that was armed at page load,
// before this probe started watching, so it is not a measurement of the
// interval at all.
const intervals = steps.map((s, i) => s.t - seq[i].t).filter((d) => d > 500).slice(1);
const band = [1250, 1650];
const inBand = intervals.filter((d) => d >= band[0] && d <= band[1]);
const sorted = [...intervals].sort((a, b) => a - b);
ok(
  intervals.length >= ALBUM_SIZE && inBand.length === intervals.length,
  `every interval is 1300-1600ms (n=${intervals.length}, min ${Math.min(...intervals).toFixed(0)}, med ${sorted[sorted.length >> 1].toFixed(0)}, max ${Math.max(...intervals).toFixed(0)})`,
  intervals.filter((d) => d < band[0] || d > band[1]).map((d) => d.toFixed(0)).join(', ')
);

/* How long each photograph is actually on screen in one loop. It is on the
   row for three consecutive steps - slot 2, then 1, then 0 - so the total is
   three intervals, about 4.5s. The design asks for roughly four seconds: long
   enough to register, short enough that nothing is missed. The recording
   covers two loops, so the per-loop figure is half of it. */
const recorded = new Array(ALBUM_SIZE).fill(0);
for (let i = 1; i < seq.length; i++) {
  const d = seq[i].t - seq[i - 1].t;
  for (const id of seq[i - 1].ids) recorded[id] += d;
}
const LOOPS = 2;
const onScreen = recorded.map((v) => v / LOOPS);
const shown = onScreen.filter((v) => v > 0);
ok(
  shown.length === ALBUM_SIZE && shown.every((v) => v >= 3000),
  `each photograph is on screen at least 3s in one loop (min ${(Math.min(...shown) / 1000).toFixed(1)}s, med ${(shown.sort((a, b) => a - b)[shown.length >> 1] / 1000).toFixed(1)}s, max ${(Math.max(...shown) / 1000).toFixed(1)}s)`,
  onScreen.map((v, i) => `#${i} ${(v / 1000).toFixed(1)}s`).join(' ')
);

/* The order itself: each step's trio is the previous trio shifted by one, and
   the photograph entering is the one after the trio's last - which is the whole
   contract. Data order, no shuffle, and nothing repeats inside a loop because
   the loop is exactly as long as the album. */
const misordered = [];
for (let i = 1; i < seq.length; i++) {
  const prev = seq[i - 1].ids;
  const now = seq[i].ids;
  if (prev.length !== 3 || now.length !== 3) continue;
  const expected = [prev[1], prev[2], (prev[2] + 1) % ALBUM_SIZE];
  if (now.join(',') !== expected.join(',')) {
    misordered.push(`[${prev}] -> [${now}], expected [${expected}]`);
  }
}
ok(
  misordered.length === 0,
  `every step is the previous trio shifted by one, in album order (${seq.length - 1} checked)`,
  misordered.slice(0, 3).join('\n        ')
);

const visited = [...new Set(steps.map((s) => s.ids[0]))].sort((a, b) => a - b);
ok(
  visited.length === ALBUM_SIZE,
  `two loops visit all ${ALBUM_SIZE} photographs as the leading one (${visited.join(',')})`,
  `visited ${visited.length}`
);

const dupes = steps.filter((s) => new Set(s.ids).size !== 3);
ok(dupes.length === 0, 'the same photograph is never on the row twice');

const wrapped = steps.some((s, i) => i > 0 && s.ids[0] === 0 && steps[i - 1].ids[0] === ALBUM_SIZE - 1);
ok(wrapped, 'the sequence wraps from the last photograph back to the first');

/* --- 4. how long a step takes --------------------------------------------- */

console.log('\nthe step');

await page.mouse.move(4, 4);
const timing = await page.evaluate(async () => {
  const row = document.querySelector('[data-album-row]');
  const out = { elapsed: [], durations: [] };
  let first = 0;
  let seenRest = false;
  await new Promise((done) => {
    const watch = () => {
      const moving = [...row.querySelectorAll('.album__figure')].filter((f) => {
        const t = getComputedStyle(f).transform;
        return t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)';
      });
      if (moving.length) {
        // Only a step that begins from a standstill is measured. This watcher
        // is switched on at an arbitrary moment, and if that moment lands in
        // the middle of a step it would time the tail of that step and call it
        // a 49ms slide; waiting for one frame of stillness first means every
        // measurement covers a whole one.
        if (!first && seenRest) {
          first = performance.now();
          // One frame on, so this reads the transition the step actually
          // applied rather than the frame where the positions were inverted
          // and no transition existed yet.
          requestAnimationFrame(() => {
            out.durations.push(getComputedStyle(moving[0]).transitionDuration);
          });
        }
      } else {
        seenRest = true;
        if (first) {
          out.elapsed.push(performance.now() - first);
          first = 0;
        }
      }
      if (out.elapsed.length >= 2 && !first) done();
      else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  return out;
});
ok(
  timing.elapsed.length > 0 &&
    timing.elapsed.every((e) => e >= 300 && e <= 520),
  `a step moves for 300-400ms, measured end to end (${timing.elapsed.map((e) => e.toFixed(0)).join(', ')}ms)`
);
ok(
  timing.durations.length > 0 &&
    timing.durations.every((d) => parseFloat(d) >= 0.3 && parseFloat(d) <= 0.4),
  `and the transition it sets is 350ms (${timing.durations.join(', ')})`
);

/* --- 4b. what a step costs the frame -------------------------------------- */

console.log('\nframes during a step');

/* Long tasks are observed in the page itself, and frames are timed off
   requestAnimationFrame, so this is the browser's own account of the step
   rather than the probe's polling of it. Three steps are watched - enough to
   catch a hitch without turning the suite into a benchmark. */
const frames = await page.evaluate(async () => {
  const long = [];
  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.duration > 50) long.push(Math.round(e.duration));
  });
  try {
    po.observe({ entryTypes: ['longtask'] });
  } catch {
    /* Firefox has no longtask entry type; frames below still stand. */
  }

  const times = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    times.push(now - last);
    last = now;
    if (times.length < 420) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  await new Promise((r) => setTimeout(r, 4200));
  po.disconnect();
  times.sort((a, b) => a - b);
  return {
    n: times.length,
    p50: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)],
    max: times[times.length - 1],
    long,
    // The display runs near 145Hz, so a 145Hz frame is ~6.9ms. What matters
    // is the budget the design set: no worse than one 60Hz frame.
    hz: Math.round(1000 / (times.reduce((a, b) => a + b, 0) / times.length)),
  };
});
ok(
  frames.p95 <= 16.7,
  `p95 frame time during steps is ${frames.p95.toFixed(1)}ms (limit 16.7ms, n=${frames.n} at ~${frames.hz}Hz, p50 ${frames.p50.toFixed(1)}ms, max ${frames.max.toFixed(1)}ms)`,
  frames.long.join(', ')
);
ok(frames.long.length === 0, `no long task over 50ms while the row moves (${frames.long.length})`, frames.long.join(', '));

/* --- 5. the row's height does not move ------------------------------------ */

console.log('\nstability');

const stable = await page.evaluate(async () => {
  const row = document.querySelector('[data-album-row]');
  const stage = document.querySelector('[data-album-stage]');
  const doc = document.documentElement;
  const samples = [];
  const take = () =>
    samples.push({
      rowH: row.getBoundingClientRect().height,
      stageH: stage.getBoundingClientRect().height,
      docH: doc.scrollHeight,
    });
  take();
  await new Promise((done) => {
    let n = 0;
    const tick = () => {
      if (n++ % 4 === 0) take();
      if (n < 900) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  return samples;
});
const rowHs = [...new Set(stable.map((s) => s.rowH.toFixed(2)))];
const stageHs = [...new Set(stable.map((s) => s.stageH.toFixed(2)))];
const docHs = [...new Set(stable.map((s) => s.docH))];
ok(
  rowHs.length === 1,
  `the row's height is identical at every step (${rowHs.join(', ')}px over ${stable.length} samples)`
);
ok(stageHs.length === 1, `the stage holds one height (${stageHs.join(', ')}px)`);
ok(docHs.length === 1, `nothing outside the section shifts (document ${docHs.join(', ')}px)`);

/* --- 6. the arrows -------------------------------------------------------- */

console.log('\narrows');

const arrowBase = await page.evaluate(() => {
  const root = document.querySelector('[data-album]');
  const prev = root.querySelector('[data-album-prev]');
  const next = root.querySelector('[data-album-next]');
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, x: r.x, y: r.y };
  };
  const cs = (el) => {
    const s = getComputedStyle(el);
    return { opacity: s.opacity, pointerEvents: s.pointerEvents, display: s.display };
  };
  const stage = root.querySelector('[data-album-stage]').getBoundingClientRect();
  return {
    prevBox: box(prev),
    nextBox: box(next),
    prev: cs(prev),
    next: cs(next),
    prevName: prev.getAttribute('aria-label'),
    nextName: next.getAttribute('aria-label'),
    stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom, h: stage.height },
  };
});
ok(
  parseFloat(arrowBase.prev.opacity) === 0 && parseFloat(arrowBase.next.opacity) === 0,
  `both arrows are invisible at rest (opacity ${arrowBase.prev.opacity})`
);
ok(
  arrowBase.prev.pointerEvents === 'none' && arrowBase.next.pointerEvents === 'none',
  'and cannot intercept a tap on the photographs at rest'
);
ok(
  arrowBase.prev.display !== 'none' && arrowBase.next.display !== 'none',
  'but are not display:none, so a screen reader can still reach them'
);
ok(
  /previous/i.test(arrowBase.prevName ?? '') && /next/i.test(arrowBase.nextName ?? ''),
  `both carry an accessible name ("${arrowBase.prevName}", "${arrowBase.nextName}")`
);
ok(
  arrowBase.prevBox.h >= 44 && arrowBase.prevBox.w >= 44 && arrowBase.nextBox.h >= 44 && arrowBase.nextBox.w >= 44,
  `hit areas are at least 44px (${arrowBase.prevBox.w}x${arrowBase.prevBox.h}, ${arrowBase.nextBox.w}x${arrowBase.nextBox.h})`
);
const midPrev = arrowBase.prevBox.y + arrowBase.prevBox.h / 2;
const midNext = arrowBase.nextBox.y + arrowBase.nextBox.h / 2;
const midRow = arrowBase.stage.top + arrowBase.stage.h / 2;
ok(
  Math.abs(midPrev - midRow) < 2 && Math.abs(midNext - midRow) < 2,
  `both are vertically centred on the row (off by ${(Math.abs(midPrev - midRow) + Math.abs(midNext - midRow)).toFixed(2)}px)`
);
// Placed against the stage, which is the row's own box - not the viewport, so
// a centred shell cannot make this read either way.
ok(
  Math.abs(arrowBase.prevBox.x - (arrowBase.stage.left - 14)) < 1 &&
    Math.abs(arrowBase.nextBox.x + arrowBase.nextBox.w - (arrowBase.stage.right + 14)) < 1,
  `both sit 14px outside the row's outer edges (prev x ${arrowBase.prevBox.x.toFixed(0)} vs stage ${arrowBase.stage.left.toFixed(0)})`
);
ok(
  arrowBase.stage.left - arrowBase.prevBox.x <= 20 &&
    arrowBase.nextBox.x + arrowBase.nextBox.w - arrowBase.stage.right <= 20,
  'and neither pokes more than the gutter can swallow'
);

// Hover reveals them. The fade is 150ms, so the read waits for it rather than
// catching it mid-way and reporting 0.7 as "not up".
await page.locator('[data-album-stage]').hover({ position: { x: 600, y: 8 } });
await page.waitForTimeout(250);
const onHover = await page.evaluate(() => {
  const s = getComputedStyle(document.querySelector('[data-album-prev]'));
  return { opacity: s.opacity, pe: s.pointerEvents, held: document.querySelector('[data-album]').dataset.held };
});
ok(
  parseFloat(onHover.opacity) > 0.95 && onHover.pe === 'auto',
  `hovering the album brings them up (opacity ${onHover.opacity}, pointer-events ${onHover.pe})`
);
ok(/hover/.test(onHover.held), `and holds the row while the pointer is over it (held "${onHover.held}")`);

// Focus reveals them too, which is the other way in.
await page.mouse.move(4, 4);
await page.waitForTimeout(250);
await page.locator('[data-album-next]').focus();
await page.waitForTimeout(250);
const onFocus = await page.evaluate(() => ({
  opacity: getComputedStyle(document.querySelector('[data-album-prev]')).opacity,
  focusWithin: document.querySelector('[data-album]').matches(':focus-within'),
}));
ok(parseFloat(onFocus.opacity) > 0.95, `keyboard focus brings them up (opacity ${onFocus.opacity})`);
ok(onFocus.focusWithin, 'via :focus-within on the album');

// And they step. The trio after one forward step is the previous trio shifted
// by one, with the photograph after the trio's last entering at the right.
const trioOf = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.album__figure')]
      .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
      .sort((a, b) => Number(a.dataset.slot) - Number(b.dataset.slot))
      .map((f) => Number(f.dataset.i))
  );
const oneForward = (t) => [t[1], t[2], (t[2] + 1) % ALBUM_SIZE];

const beforeArrow = await trioOf();
await page.locator('[data-album-next]').click();
await page.waitForTimeout(700);
const afterArrow = await trioOf();
ok(
  afterArrow.join(',') === oneForward(beforeArrow).join(','),
  `the next arrow steps by one (${beforeArrow} -> ${afterArrow})`
);

await page.locator('[data-album-prev]').click();
await page.waitForTimeout(700);
const afterPrev = await trioOf();
ok(
  afterPrev.join(',') === beforeArrow.join(','),
  `the previous arrow steps back one (${afterArrow} -> ${afterPrev})`
);

// Left and right keys, with focus inside the album.
await page.locator('[data-album-next]').focus();
await page.waitForTimeout(250);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(700);
const afterKey = await trioOf();
ok(
  afterKey.join(',') === oneForward(beforeArrow).join(','),
  `ArrowRight with focus in the album steps forward (${beforeArrow} -> ${afterKey})`
);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(700);
ok(
  (await trioOf()).join(',') === beforeArrow.join(','),
  'ArrowLeft steps back'
);

// And with the row itself focused - the way a reader who never found the
// arrow buttons still gets there.
await page.locator('.album__row').focus();
await page.waitForTimeout(250);
ok(
  (await page.evaluate(() => document.activeElement?.classList.contains('album__row'))) === true,
  'the row itself is focusable'
);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(700);
const afterRowKey = await trioOf();
ok(
  afterRowKey.join(',') === oneForward(beforeArrow).join(','),
  `ArrowRight with the row focused steps forward (${beforeArrow} -> ${afterRowKey})`
);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(700);
ok((await trioOf()).join(',') === beforeArrow.join(','), 'ArrowLeft steps back from the row');

// Tabbing away, so the hold section below starts from a clean slate - a
// focused arrow keeps the row held, which would read as "never resumes".
await page.evaluate(() => document.activeElement?.blur());
await page.waitForTimeout(300);

/* --- 7. the row holds ------------------------------------------------------ */

console.log('\nholds');

const swaps = () => page.evaluate(() => Number(document.querySelector('[data-album]').dataset.swaps ?? 0));
const held = () => page.evaluate(() => document.querySelector('[data-album]').dataset.held);

await page.mouse.move(4, 4);
await page.waitForTimeout(300);
await page.locator('[data-album-stage]').hover({ position: { x: 400, y: 8 } });
await page.waitForTimeout(1200);
const h0 = await swaps();
await page.waitForTimeout(6000);
ok((await swaps()) === h0, `hovering the album stops the timer (${(await swaps()) - h0} steps in 6s)`);

await page.mouse.move(4, 4);
await page.waitForTimeout(300);
const h1 = await swaps();
await page.waitForTimeout(6000);
ok((await swaps()) > h1, `leaving it starts again (${(await swaps()) - h1} steps in 6s)`);

await page.locator('[data-album-next]').focus();
await page.waitForTimeout(1200);
const h2 = await swaps();
await page.waitForTimeout(6000);
ok((await swaps()) === h2, `focus inside the album stops the timer (${(await swaps()) - h2} steps in 6s)`);
console.log(`        held while focused: "${await held()}"`);

// The lightbox holds it too.
await page.evaluate(() => document.querySelector('.album__figure:not([hidden]) .album__link').click());
await page.waitForTimeout(400);
const h3 = await swaps();
await page.waitForTimeout(6000);
ok((await swaps()) === h3, `an open lightbox stops the timer (${(await swaps()) - h3} steps in 6s)`);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Off-screen.
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.mouse.move(4, 4);
await page.waitForTimeout(1500);
const h4 = await swaps();
await page.waitForTimeout(6000);
ok((await swaps()) === h4, `scrolled away stops the timer (${(await swaps()) - h4} steps in 6s)`);
console.log(`        held off-screen: "${await held()}"`);

// Hidden tab.
await page.evaluate(() =>
  document.querySelector('#album')?.scrollIntoView({ behavior: 'instant', block: 'center' })
);
await page.mouse.move(4, 4);
await page.waitForTimeout(1200);
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(500);
const h5 = await swaps();
await page.waitForTimeout(4000);
ok((await swaps()) === h5, `a hidden tab stops the timer (${(await swaps()) - h5} steps in 4s)`);
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(1200);

// And no pause control exists to have to press.
const noPause = await page.evaluate(() => ({
  pause: !!document.querySelector('[data-album-toggle]'),
  text: document.querySelector('[data-album]').textContent.replace(/\s+/g, ' '),
}));
ok(!noPause.pause, 'no pause control exists - the holds are the mechanism');

/* --- 8. the lightbox ------------------------------------------------------- */

console.log('\nlightbox');

await page.mouse.move(4, 4);
await page.waitForTimeout(300);
const opener = page.locator('.album__figure:not([hidden]) .album__link').first();
await opener.click();
await page.waitForTimeout(400);
const lb = await page.evaluate(() => {
  const box = document.querySelector('[data-album-lightbox]');
  const img = box.querySelector('[data-album-lightbox-img]');
  return {
    hidden: box.hidden,
    counter: box.querySelector('[data-album-lightbox-counter]')?.textContent?.trim(),
    alt: img.alt,
    natural: img.naturalWidth > 0,
    focus: document.activeElement?.getAttribute('data-album-lightbox-close') !== null,
    role: box.getAttribute('role'),
  };
});
ok(!lb.hidden, 'clicking a photograph opens the lightbox');
ok(/^\d{2} \/ 13$/.test(lb.counter ?? ''), `counter reads "${lb.counter}" - and only inside the lightbox`);
ok((lb.alt ?? '').length > 10, `the lightbox carries the alt text ("${(lb.alt ?? '').slice(0, 40)}…")`);
ok(lb.natural, 'the lightbox image has loaded');
ok(lb.focus, 'focus moves to the dialog');
ok(lb.role === 'dialog', 'and it is a modal dialog');

await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
const lb2 = await page.evaluate(() =>
  document.querySelector('[data-album-lightbox-counter]')?.textContent?.trim()
);
ok(lb2 !== lb.counter, `ArrowRight walks on (${lb.counter} -> ${lb2})`);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(300);
ok(
  (await page.evaluate(() => document.querySelector('[data-album-lightbox-counter]')?.textContent?.trim())) ===
    lb.counter,
  'ArrowLeft walks back'
);

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const closed = await page.evaluate(() => ({
  hidden: document.querySelector('[data-album-lightbox]').hidden,
  returned: document.activeElement?.hasAttribute('data-album-open') ?? false,
}));
ok(closed.hidden, 'Escape closes it');
ok(closed.returned, 'and focus returns to the photograph it opened from');

/* The row must not be walking while the dialog is up. */

/* --- 9. touch -------------------------------------------------------------- */

console.log('\ntouch');

const touchPage = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
await touchPage.goto(BASE, { waitUntil: 'networkidle' });
await touchPage.evaluate(() =>
  document.querySelector('#album')?.scrollIntoView({ behavior: 'instant', block: 'center' })
);
await touchPage.waitForTimeout(900);

/* Focused, so the row is held for the whole of this section. Every step
   below is then the gesture's own doing rather than the conveyor's, which
   matters far more now that it steps every 1.4s: an autoplay step landing
   inside an 800ms wait would otherwise look like a swipe that worked, or like
   a vertical one that should not have. The arrows' own rest state is checked
   after an explicit blur, further down. */
await touchPage.evaluate(() => document.querySelector('[data-album-row]')?.focus());
await touchPage.waitForTimeout(600);

const swipeBefore = await touchPage.evaluate(() =>
  [...document.querySelectorAll('.album__figure')]
    .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
    .map((f) => Number(f.dataset.i))
);
// A real touch swipe, through CDP, rather than a synthetic pointer event.
// The gesture has to start on the row itself - measured, not guessed, since
// where the section lands depends on its height at this viewport.
const rowBox = await touchPage.evaluate(() => {
  const r = document.querySelector('.album__row').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const swipeY = Math.round(rowBox.y + rowBox.h / 2);
ok(
  swipeY > 0 && swipeY < 844,
  `the row is on screen at this viewport and its centre is y=${swipeY}`
);
// Chromium gets a real touch gesture through CDP, which is what found the
// `pointercancel` that was eating swipes before `touch-action: pan-y` went
// on the row. Firefox has no CDP, so there the same gesture is played by
// hand as pointer events carrying `pointerType: 'touch'`: it exercises the
// album's own threshold and direction logic, but it cannot reproduce the
// browser cancelling the stream, so it is labelled as what it is.
const realTouch = ENGINE_NAME === 'chromium';
const cdp = realTouch ? await touchPage.context().newCDPSession(touchPage) : null;
if (!realTouch) console.log(`        (${ENGINE_NAME}: gestures are played as touch-typed pointer events)`);

/** Play a drag on `p`. With a CDP session it is a real touch; without one it
 *  is pointer events carrying a touch's pointerType. */
const drag = async (p, session, pts, pointerId = 1) => {
  if (session) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: pts[0][0], y: pts[0][1] }],
    });
    for (const [x, y] of pts.slice(1, -1)) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  await p.evaluate(
    ({ pts, pointerId }) => {
      const row = document.querySelector('.album__row');
      const target = document.elementFromPoint(pts[0][0], pts[0][1]) ?? row;
      const send = (type, [x, y]) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            buttons: 1,
          })
        );
      send('pointerdown', pts[0]);
      for (const pt of pts.slice(1, -1)) send('pointermove', pt);
      send('pointerup', pts[pts.length - 1]);
    },
    { pts, pointerId }
  );
};

/** A drag of `dx` sideways and `dy` upward from (x, y), `step` px per move. */
const line = (x, y, dx, dy, step = 12) => {
  const pts = [];
  const n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / step));
  for (let i = 0; i <= n; i++) pts.push([Math.round(x + (dx * i) / n), Math.round(y + (dy * i) / n)]);
  return pts;
};
const swipe = (fromX, toX, y = swipeY) => drag(touchPage, cdp, line(fromX, y, toX - fromX, 0));
const docScroll = () => touchPage.evaluate(() => window.scrollY);
const scrollBefore = await docScroll();
await swipe(330, 90);
await touchPage.waitForTimeout(800);
const swipeAfter = await touchPage.evaluate(() =>
  [...document.querySelectorAll('.album__figure')]
    .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
    .map((f) => Number(f.dataset.i))
);
ok(
  swipeAfter.join(',') === oneForward(swipeBefore).join(','),
  `swiping left steps to the next (${swipeBefore} -> ${swipeAfter})`
);
const scrollAfter = await docScroll();
ok(
  Math.abs(scrollAfter - scrollBefore) < 4,
  `and does not hijack the page scroll (scrollY ${scrollBefore.toFixed(0)} -> ${scrollAfter.toFixed(0)})`
);

// A vertical swipe is the reader scrolling, and is left alone. It starts on
// the row too, so this is a drag over the photographs, not beside them.
const vBefore = await docScroll();
const vTrio = JSON.stringify(swipeAfter);
const vX = Math.round(rowBox.x + rowBox.w / 2);
await drag(touchPage, cdp, line(vX, swipeY + 60, 0, -360, 14), 2);
await touchPage.waitForTimeout(700);
const vAfter = await docScroll();
const vTrio2 = JSON.stringify(
  await touchPage.evaluate(() =>
    [...document.querySelectorAll('.album__figure')]
      .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
      .map((f) => Number(f.dataset.i))
  )
);
if (cdp) {
  ok(
    Math.abs(vAfter - vBefore) > 40,
    `a vertical swipe scrolls the page (${vBefore.toFixed(0)} -> ${vAfter.toFixed(0)})`
  );
} else {
  // Synthetic events cannot scroll anything, so the browser's side of the
  // bargain is checked in the stylesheet instead: `pan-y` is what leaves
  // vertical drags to the page and hands horizontal ones to the album.
  const touchAction = await touchPage.evaluate(
    () => getComputedStyle(document.querySelector('.album__row')).touchAction
  );
  ok(touchAction === 'pan-y', `a vertical drag is the page's, not the album's (touch-action: ${touchAction})`);
}
ok(vTrio2 === vTrio, 'and does not step the album');

// On a touch screen the arrows stay out of the way until something is focused.
// Nothing is focused and the pointer is elsewhere, so this really is at rest.
await touchPage.evaluate(() => document.activeElement?.blur());
await touchPage.mouse.move(4, 4);
await touchPage.waitForTimeout(400);
const touchArrows = await touchPage.evaluate(() => {
  const a = document.querySelector('[data-album-prev]');
  return { opacity: getComputedStyle(a).opacity, pe: getComputedStyle(a).pointerEvents };
});
ok(
  parseFloat(touchArrows.opacity) === 0,
  `arrows stay invisible on touch at rest, where the swipe is the control (opacity ${touchArrows.opacity})`
);
// But focus still brings them up - that is the one way in on a device
// with a keyboard or a switch.
await touchPage.locator('[data-album-next]').focus();
await touchPage.waitForTimeout(350);
const touchFocusOp = await touchPage.evaluate(() =>
  parseFloat(getComputedStyle(document.querySelector('[data-album-next]')).opacity)
);
ok(touchFocusOp > 0.9, `focusing an arrow reveals it on touch too (opacity ${touchFocusOp})`);

/* The conveyor's own numbers, at the viewport a phone actually has. The
   desktop section above measures these on a wide stage; a 390px one packs
   three photographs into a row barely 120px tall, and it is worth knowing the
   interval and the frame cost survive that too. */
console.log('\nat 390px');
await touchPage.evaluate(() => document.activeElement?.blur());
await touchPage.mouse.move(4, 4);
await touchPage.waitForTimeout(500);

const mobile = await touchPage.evaluate(async () => {
  const root = document.querySelector('[data-album]');
  const long = [];
  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.duration > 50) long.push(Math.round(e.duration));
  });
  try {
    po.observe({ entryTypes: ['longtask'] });
  } catch {
    /* no longtask in Firefox */
  }
  const times = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    times.push(now - last);
    last = now;
    if (times.length < 600) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const seenAt = [];
  const first = Number(root.dataset.swaps ?? 0);
  const t0 = performance.now();
  let prev = first;
  while (performance.now() - t0 < 6200) {
    await new Promise((r) => setTimeout(r, 25));
    const s = Number(root.dataset.swaps ?? 0);
    if (s !== prev) {
      seenAt.push(performance.now());
      prev = s;
    }
  }
  po.disconnect();
  times.sort((a, b) => a - b);
  const intervals = seenAt.slice(1).map((t, i) => t - seenAt[i]);
  return {
    steps: seenAt.length,
    min: intervals.length ? Math.min(...intervals) : 0,
    max: intervals.length ? Math.max(...intervals) : 0,
    p95: times[Math.floor(times.length * 0.95)],
    n: times.length,
    long,
    rowH: document.querySelector('[data-album-row]').getBoundingClientRect().height,
  };
});
ok(
  mobile.steps >= 4 && mobile.min >= 1250 && mobile.max <= 1650,
  `the row steps on a 390px screen every ${mobile.min.toFixed(0)}-${mobile.max.toFixed(0)}ms over ${mobile.steps} steps`,
  `min ${mobile.min.toFixed(0)} max ${mobile.max.toFixed(0)}`
);
ok(
  mobile.p95 <= 16.7,
  `p95 frame time at 390px during steps is ${mobile.p95.toFixed(1)}ms (limit 16.7ms, n=${mobile.n})`,
  mobile.long.join(', ')
);
ok(mobile.long.length === 0, `no long task over 50ms at 390px (${mobile.long.length})`, mobile.long.join(', '));
await touchPage.close();

/* --- 10. reduced motion ----------------------------------------------------- */

console.log('\nreduced motion');

const rmPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await rmPage.emulateMedia({ reducedMotion: 'reduce' });
await rmPage.goto(BASE, { waitUntil: 'networkidle' });
await rmPage.evaluate(() =>
  document.querySelector('#album')?.scrollIntoView({ behavior: 'instant', block: 'center' })
);
await rmPage.mouse.move(4, 4);
await rmPage.waitForTimeout(600);
const rm0 = await rmPage.evaluate(() => ({
  swaps: Number(document.querySelector('[data-album]').dataset.swaps ?? 0),
  held: document.querySelector('[data-album]').dataset.held,
  trio: [...document.querySelectorAll('.album__figure')]
    .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
    .map((f) => Number(f.dataset.i)),
}));
await rmPage.waitForTimeout(6500);
const rm1 = await rmPage.evaluate(() => ({
  swaps: Number(document.querySelector('[data-album]').dataset.swaps ?? 0),
  trio: [...document.querySelectorAll('.album__figure')]
    .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
    .map((f) => Number(f.dataset.i)),
}));
ok(rm1.swaps === rm0.swaps, `no autoplay under reduced motion (${rm1.swaps - rm0.swaps} steps in 6.5s)`);
ok(/reduced|reduce/.test(rm0.held), `held for that reason (held "${rm0.held}")`);

// The arrows still work, and do it without moving anything.
await rmPage.locator('[data-album-next]').click({ force: true });
await rmPage.waitForTimeout(400);
const rm2 = await rmPage.evaluate(() => {
  const figs = [...document.querySelectorAll('.album__figure')].filter((f) => !f.hidden);
  return {
    trio: figs.filter((f) => !f.classList.contains('is-leaving')).map((f) => Number(f.dataset.i)),
    transforms: figs.map((f) => getComputedStyle(f).transform).filter((t) => t !== 'none'),
  };
});
ok(
  rm2.trio.join(',') === oneForward(rm0.trio).join(','),
  `the next arrow still steps under reduced motion (${rm0.trio} -> ${rm2.trio})`
);
ok(rm2.transforms.length === 0, 'with no transform animation at all');

// Keys too, from the row, without the autoplay that would have made them
// pointless.
await rmPage.locator('.album__row').focus();
await rmPage.keyboard.press('ArrowRight');
await rmPage.waitForTimeout(400);
const rm3 = await rmPage.evaluate(() =>
  [...document.querySelectorAll('.album__figure')]
    .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
    .map((f) => Number(f.dataset.i))
);
ok(
  rm3.join(',') === oneForward(rm2.trio).join(','),
  `the arrow keys still step under reduced motion (${rm2.trio} -> ${rm3})`
);
await rmPage.evaluate(() => document.activeElement?.blur());
await rmPage.close();

// And a swipe, on a touch screen that also asked for reduced motion.
const rmTouch = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
await rmTouch.emulateMedia({ reducedMotion: 'reduce' });
await rmTouch.goto(BASE, { waitUntil: 'networkidle' });
await rmTouch.evaluate(() =>
  document.querySelector('#album')?.scrollIntoView({ behavior: 'instant', block: 'center' })
);
await rmTouch.waitForTimeout(700);
const rmRowBox = await rmTouch.evaluate(() => {
  const r = document.querySelector('.album__row').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const rmY = Math.round(rmRowBox.y + rmRowBox.h / 2);
const rmTrioBefore = await rmTouch.evaluate(() =>
  [...document.querySelectorAll('.album__figure')]
    .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
    .map((f) => Number(f.dataset.i))
);
const rmCdp = realTouch ? await rmTouch.context().newCDPSession(rmTouch) : null;
await drag(rmTouch, rmCdp, line(330, rmY, -240, 0));
await rmTouch.waitForTimeout(500);
const rmTrioAfter = await rmTouch.evaluate(() =>
  [...document.querySelectorAll('.album__figure')]
    .filter((f) => !f.hidden && !f.classList.contains('is-leaving'))
    .map((f) => Number(f.dataset.i))
);
ok(
  rmTrioAfter.join(',') === oneForward(rmTrioBefore).join(','),
  `a swipe still steps under reduced motion (${rmTrioBefore} -> ${rmTrioAfter})`
);
await rmTouch.close();

/* --- 11. without script ------------------------------------------------------ */

console.log('\nno script');

const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
const njPage = await noJs.newPage();
await njPage.goto(BASE, { waitUntil: 'load' });
await njPage.evaluate?.(() => {}).catch(() => {});
const nj = await njPage.$$eval('.album__figure', (figs) =>
  figs.map((f) => ({
    hidden: f.hidden,
    display: getComputedStyle(f).display,
    h: f.getBoundingClientRect().height,
    w: f.getBoundingClientRect().width,
    link: !!f.querySelector('a[href]'),
    loaded: f.querySelector('img')?.naturalWidth > 0,
  }))
);
ok(nj.length === 13, `all thirteen photographs are in the page (${nj.length})`);
ok(
  nj.every((f) => f.display !== 'none' && f.h > 0),
  'every one of them is displayed, not just the opening three',
  nj.filter((f) => f.display === 'none' || f.h === 0).length + ' hidden'
);
ok(nj.every((f) => f.link), 'each is a real link to the full-size photograph');
ok(
  nj.every((f) => f.h > 0 && Math.abs(f.h - nj[0].h) < 0.6),
  `they share one height, so it is a plain gallery (${nj[0].h.toFixed(0)}px)`
);
const njArrows = await njPage.$$eval('.album__arrow', (els) =>
  els.map((e) => getComputedStyle(e).display)
);
ok(njArrows.every((d) => d === 'none'), `the arrows are switched off without script (${njArrows.join(', ')})`);
await noJs.close();

/* --- 12. the sizes promise ---------------------------------------------------- */

console.log('\nsrcset / sizes');

/* Every photograph has to be measured, not just the three on the row, and
   the three on the row are whichever three the timer happens to have left
   there. With script off the whole album is laid out at once at the same
   heights the conveyor uses, so one page answers for all thirteen - and at
   three widths, because the promise has three bands and the row is narrower
   at 1280 than at 1200 once the rail appears. */
const sweep = [];
for (const vw of [390, 1280, 1440]) {
  // Script off, so the gallery is the gallery: all thirteen laid out at the
  // same heights the conveyor uses, and nothing hidden by the timer.
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: vw, height: 900 } });
  const sweepPage = await ctx.newPage();
  await sweepPage.goto(BASE, { waitUntil: 'networkidle' });
  // Walk down the album so the lazy ones are asked for, then measure.
  await sweepPage.evaluate(() => {
    const top = document.querySelector('#album')?.getBoundingClientRect().top ?? 0;
    window.scrollTo(0, window.scrollY + top);
  });
  for (let y = 0; y < 14000; y += 700) {
    await sweepPage.evaluate((d) => window.scrollBy(0, d), 700);
    await sweepPage.waitForTimeout(60);
  }
  await sweepPage.evaluate(() => {
    const top = document.querySelector('#album')?.getBoundingClientRect().top ?? 0;
    window.scrollTo(0, window.scrollY + top);
  });
  await sweepPage.waitForTimeout(1200);
  await sweepPage
    .waitForFunction(() => [...document.querySelectorAll('.album__img')].every((i) => i.complete), null, {
      timeout: 10000,
    })
    .catch(() => {});
  const rows = await sweepPage.evaluate(() =>
    [...document.querySelectorAll('.album__figure')].map((f, i) => {
      const img = f.querySelector('.album__img');
      const r = img.getBoundingClientRect();
      return { i, box: r.width, natural: img.naturalWidth, loaded: img.complete && img.naturalWidth > 0 };
    })
  );
  for (const r of rows) sweep.push({ vw, ...r });
  await ctx.close();
}
const unloaded = sweep.filter((s) => !s.loaded);
ok(unloaded.length === 0, `every photograph loaded at each width (${sweep.length} measurements)`,
  unloaded.map((s) => `#${s.i}@${s.vw}`).join(' '));
const oversampled = sweep.filter((s) => s.natural && s.box && s.natural / s.box > 1.6);
ok(
  oversampled.length === 0,
  'no photograph is decoded far larger than its box, at any width',
  oversampled.map((s) => `#${s.i}@${s.vw} ${s.natural}px for a ${s.box.toFixed(0)}px box`).join(' | ')
);
ok(
  sweep.every((s) => s.natural >= s.box * 0.95),
  'and none is decoded smaller than its box',
  sweep.filter((s) => s.natural < s.box * 0.95).map((s) => `#${s.i}@${s.vw} ${s.natural} < ${s.box.toFixed(0)}`).join(' | ')
);
const worst = sweep.reduce((m, s) => Math.max(m, s.box ? s.natural / s.box : 0), 0);
console.log(`        worst decode/box ratio: ${worst.toFixed(2)}x`);

/* --- 13. console -------------------------------------------------------------- */

console.log('\nconsole');
ok(errors.length === 0, `clean${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);

await browser.close();

if (failures) {
  console.log(`\nFAIL: ${failures} album check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nPASS: the row is an ordered conveyor, and every hold and fallback behaves');
}

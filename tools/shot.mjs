/**
 * Screenshot the site in a given theme, optionally at a scroll offset.
 *
 *   node tools/shot.mjs --theme light --out light
 *   node tools/shot.mjs --theme dark --scroll 1800 --out dark-1800 --wait 1500
 *   node tools/shot.mjs --theme light --browser firefox --out light-ff
 *   node tools/shot.mjs --theme light --debug --out light-dbg
 *
 * Headed by default, because a screenshot is not a measurement: it is the
 * thing that gets looked at. Pass --headless only for batch work.
 *
 * Output lands in %LOCALAPPDATA%\Temp\opencode\shots\<out>.png
 */
import fs from 'node:fs';
import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : dflt;
};
const flag = (name) => args.includes(name);

const theme = arg('--theme', 'light');
const out = arg('--out', 'shot');
const scroll = Number(arg('--scroll', '0'));
const wait = Number(arg('--wait', '1800'));
const browserName = arg('--browser', 'chromium');
const headless = flag('--headless');
const debug = flag('--debug');
const mouse = args.includes('--mouse')
  ? args
      .slice(args.indexOf('--mouse') + 1)
      .slice(0, 2)
      .map(Number)
  : null;
/* Sweep through a real figure rather than a fixed point: figures choose their
   own positions, so a hard-coded y would usually pass between them. */
const mouseFig = flag('--mouse-fig');

const BASE = await baseUrl();
const DIR = process.env.LOCALAPPDATA + '/Temp/opencode/shots';
fs.mkdirSync(DIR, { recursive: true });
const file = `${DIR}/${out}.png`;

const engine = browserName === 'firefox' ? firefox : chromium;
const browser = await engine.launch({ headless });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

/* A recorder that lives in the page and reads the field every animation frame.
   Reading it across the protocol instead would cost a round trip per sample,
   and two round trips per pointer step made the sweep run at a fifth of its
   intended speed - which is to say it stopped measuring the thing it was for.
   Measuring at 60Hz in-page costs nothing and leaves the sweep alone. */
await context.addInitScript(() => {
  const fresh = () => ({ travel: 0, err: 0, rot: 0, drive: 0, speed: 0, frames: 0, per: {} });
  window.__peak = fresh();
  window.__peakReset = () => {
    window.__peak = fresh();
  };
  window.__peakRead = () => window.__peak;
  const tick = () => {
    const f = window.__field;
    const p = window.__peak;
    if (f) p.speed = Math.max(p.speed, Number(f.maxSpeed) || 0);
    const sh = typeof window.__shapes === 'function' ? window.__shapes() : null;
    if (sh) {
      p.frames++;
      for (const s of sh) {
        const t = Math.hypot(s.ox + s.dx, s.oy + s.dy);
        const e = Math.hypot(s.ox, s.oy);
        const r = (Math.abs(s.th) * 180) / Math.PI;
        if (t > p.travel) p.travel = t;
        if (e > p.err) p.err = e;
        if (r > p.rot) p.rot = r;
        if (s.drive > p.drive) p.drive = s.drive;
        // Per figure as well as overall: the visibility requirement is that the
        // figure under the pointer moves and the ones far away do not, which a
        // single worst-case number cannot show. `err` is the spring's own
        // error, so the ambient drift - which every figure makes whether or not
        // a pointer is anywhere near it - is not mistaken for an influence.
        const seen = p.per[s.name];
        if (!seen || e > seen.err) {
          p.per[s.name] = { travel: t, err: e, x: s.x, y: s.y, drive: s.drive };
        } else {
          seen.travel = Math.max(seen.travel, t);
          seen.x = s.x;
          seen.y = s.y;
          seen.drive = Math.max(seen.drive, s.drive);
        }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

await page.goto(debug ? `${BASE}/?debug=1` : `${BASE}/`, { waitUntil: 'load' });
await page.evaluate((t) => {
  try {
    localStorage.setItem('theme', t);
  } catch (e) {}
}, theme);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1200);

if (scroll) {
  /* Scroll it the way a person does, not in one jump. The field filters scroll
     velocity with a 150ms soft clamp, so an instant window.scrollTo arrives as
     a single spike, gets clamped to nothing and leaves the figures where they
     were - which would make every scroll screenshot look like every other one. */
  await page.evaluate(async (target) => {
    const from = window.scrollY;
    const pxPerSec = 700;
    const dur = (Math.abs(target - from) / pxPerSec) * 1000;
    const t0 = performance.now();
    await new Promise((done) => {
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / Math.max(1, dur));
        const e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
        window.scrollTo(0, from + (target - from) * e);
        if (k < 1) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
  }, scroll);
}
if (mouse) {
  // A slow sweep, so a pointer wake is in the frame rather than one that has
  // already settled by the time the shot is taken.
  await page.mouse.move(mouse[0], mouse[1] - 60);
  for (let i = 1; i <= 26; i++) {
    await page.mouse.move(mouse[0] - 260 + i * 20, mouse[1]);
    await page.waitForTimeout(24);
  }
}
if (mouseFig) {
  const box = await page.evaluate(() => {
    const anyWin = window;
    if (typeof anyWin.__shapes !== 'function') return null;
    const all = anyWin.__shapes().filter((s) => s.x > 60 && s.x < 1380 && s.y > 90 && s.y < 810);
    if (!all.length) return null;
    return all.sort((a, b) => Math.abs(a.x - 720) - Math.abs(b.x - 720))[0];
  });
  if (!box) throw new Error('no figure in the clear middle band to sweep through');
  console.log(`  sweeping through the figure "${box.name}" at ${Math.round(box.x)},${Math.round(box.y)}`);

  await page.mouse.move(box.x - 340, box.y - 110);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__peakReset());

  // 30 steps of 12px with nothing asked of the page in between: about 750px/s,
  // straight through the figure. The recorder in the page is doing the sampling.
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(box.x - 340 + i * 12, box.y);
    await page.waitForTimeout(16);
  }
  // The furthest point comes after the pointer stops, while the flow it stirred
  // is still washing through the figure, so keep watching.
  await page.waitForTimeout(600);

  const peak = await page.evaluate(() => window.__peakRead());
  console.log(
    `  during sweep: ${peak.frames} frames, max speed ${peak.speed.toFixed(1)}px/s (cap 90), ` +
      `pushed ${peak.err.toFixed(1)}px from its path (want 40-70, cap 80), ` +
      `visible travel ${peak.travel.toFixed(1)}px, ` +
      `rotation ${peak.rot.toFixed(2)}deg (want ~8, cap 10), ` +
      `field held the figures at ${(peak.drive * 100).toFixed(0)}%`
  );

  if (flag('--leave')) {
    await page.mouse.move(box.x + 520, box.y - 40, { steps: 24 });
    if (flag('--trace')) {
      const t0 = Date.now();
      console.log(`  return curve: the swept figure, spring error from its home path`);
      while (Date.now() - t0 < 4200) {
        const row = await page.evaluate((abbr) => {
          const s = window.__shapes().find((v) => v.abbr === abbr);
          return {
            d: Math.hypot(s.ox, s.oy),
            p: Number(window.__field?.peakFlow ?? 0),
            rot: Math.abs(s.th) * (180 / Math.PI),
          };
        }, box.abbr);
        console.log(
          `    ${String(Date.now() - t0).padStart(5)}  ${row.d.toFixed(2)}px  ` +
            `rot=${row.rot.toFixed(2)}deg  flow=${row.p.toFixed(1)}`
        );
        await page.waitForTimeout(250);
      }
    }
  }
}

/* The visibility requirement, tested by stirring one spot and reading every
   figure: a figure whose centre is within 150px of the pointer must move at
   least 20px, and one more than 400px away must move less than 5px. A sweep
   that passes through everything cannot show this, because every figure ends
   up near the pointer at some point; holding the stirring in one place can. */
if (flag('--near')) {
  const target = await page.evaluate(() => {
    const anyWin = window;
    const all = anyWin.__shapes().filter((s) => s.x > 60 && s.x < 1380 && s.y > 90 && s.y < 810);
    if (!all.length) return null;
    return all.sort((a, b) => Math.abs(a.x - 720) - Math.abs(b.x - 720))[0];
  });
  if (!target) throw new Error('no figure available for the near test');
  const cx = target.x;
  const cy = target.y - 40;
  await page.evaluate(() => window.__peakReset());
  /* Three slow circles of 70px radius: continuous flow, concentrated. The
     circles are centred 40px off the figure, so the pointer never leaves
     110px of it and every other figure is left alone. */
  for (let ring = 0; ring < 3; ring++) {
    for (let a = 0; a < 40; a++) {
      const th = (a / 40) * Math.PI * 2;
      await page.mouse.move(cx + Math.cos(th) * 70, cy + Math.sin(th) * 70);
      await page.waitForTimeout(10);
    }
  }
  await page.waitForTimeout(400);
  const peak = await page.evaluate(() => window.__peakRead());
  const rows = Object.entries(peak.per).map(([n, v]) => ({
    n,
    pushed: v.err,
    moved: v.travel,
    d: Math.hypot(v.x - cx, v.y - cy),
    drive: v.drive,
  }));
  rows.sort((a, b) => a.d - b.d);
  console.log(
    `  near test: stirring a point at ${Math.round(cx)},${Math.round(cy)}, "${target.name}" under it`
  );
  for (const r of rows) {
    const verdict =
      r.d < 150
        ? r.pushed >= 20
          ? 'ok'
          : 'TOO STILL'
        : r.d > 400
          ? r.pushed < 5
            ? 'ok'
            : 'TOO MUCH'
          : 'between bands';
    console.log(
      `    ${r.n.padEnd(13)} ${r.d.toFixed(0).padStart(5)}px away  pushed ${r.pushed
        .toFixed(1)
        .padStart(5)}px  held ${(r.drive * 100).toFixed(0).padStart(3)}%  ${verdict}`
    );
  }
}
await page.waitForTimeout(wait);

await page.screenshot({ path: file, fullPage: false });

/* Sample the ambient drift with no pointer in play, and report how fast the
   figures actually wander. The design asks for 4-12 px/s; a rate that is too
   slow is invisible rather than broken, so it has to be measured. */
if (flag('--drift')) {
  const a = await page.evaluate(() => window.__shapes().map((s) => [s.dx, s.dy]));
  await page.waitForTimeout(2000);
  const b = await page.evaluate(() => window.__shapes().map((s) => [s.dx, s.dy]));
  const speeds = b.map((p, i) => Math.hypot(p[0] - a[i][0], p[1] - a[i][1]) / 2);
  console.log(
    `  ambient drift over 2s: mean ${speeds.reduce((s, v) => s + v, 0) / speeds.length}px/s, ` +
      `min ${Math.min(...speeds).toFixed(1)}, max ${Math.max(...speeds).toFixed(1)}`
  );
}

const state = await page.evaluate(() => window.__field ?? null);
console.log(`${file}  theme=${theme} scroll=${scroll}`);
if (mouseFig && state) {
  const back = await page.evaluate(() =>
    window.__shapes().map((s) => ({
      n: s.name,
      d: Math.hypot(s.ox, s.oy),
      r: Math.abs(s.th) * (180 / Math.PI),
    }))
  );
  const worst = back.reduce((a, b) => (b.d > a.d ? b : a), back[0]);
  console.log(
    `  after ${wait}ms: farthest figure is ${worst.d.toFixed(2)}px out of its home path (${worst.n}), ` +
      `rotation ${Math.max(...back.map((b) => b.r)).toFixed(2)}deg`
  );
}
if (state) {
  console.log(
    `  mode=${state.mode} figures=${state.figures} onScreen=${state.onScreen} ` +
      `dev=${state.shapeDev} maxSpeed=${state.maxSpeed} peakFlow=${state.peakFlow} ` +
      `fps=${state.fps} influenced=${state.influenced}`
  );
  console.log(`  names: ${state.constellations ?? '-'}`);
}
console.log(`  console errors: ${errors.length}${errors.length ? ' - ' + errors.join(' | ') : ''}`);

await browser.close();

/**
 * Dark theme: the wake, the swirl, the return, and the click.
 *
 * Everything the dark background has to prove, measured rather than eyeballed:
 *
 *   coherence  stars inside the wake travel WITH the field - the cosine
 *              similarity between a star's velocity and the flow under it,
 *              averaged over every star within 120px of the pointer. Above
 *              0.6 means the stars are riding the flow rather than being
 *              shoved by something unrelated to it.
 *   swirl      mean absolute curl under the pointer against mean absolute curl
 *              far away. Some swirl is required; a purely radial push would
 *              score zero here.
 *   decay      how long the wake stays alive after the pointer stops, and how
 *              far it has fallen by two seconds.
 *   return     the largest any star gets from its home, and how long it takes
 *              to be back within 2px.
 *   click      the ring: its radius has to grow and its amplitude has to fall.
 *
 * The sampling all happens inside the page on requestAnimationFrame. Reading
 * across the protocol once per frame costs a round trip each time and slows
 * the very sweep it is trying to measure.
 *
 *   node tools/dark-probe.mjs
 *   node tools/dark-probe.mjs --browser firefox
 */
import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';

const args = process.argv.slice(2);
const browserName = args.includes('--browser') ? args[args.indexOf('--browser') + 1] : 'chromium';
const headless = args.includes('--headless');
const BASE = await baseUrl();

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

await context.addInitScript(() => {
  window.__dark = {
    mode: 'off',
    ptr: null,
    cos: [],
    decay: [],
    disp: [],
    click: [],
    snaps: [],
  };
  // Did the pointer actually move? "It shouldn't have" is not a measurement,
  // and a ramp in flow energy during a click has two candidate sources: the
  // pulse, or a pointer that is still reporting velocity.
  window.__moves = [];
  addEventListener('pointermove', (e) => {
    window.__moves.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });
  window.__downs = [];
  addEventListener('pointerdown', (e) => {
    window.__downs.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });
  const tick = () => {
    const w = window;
    const D = window.__dark;
    const f = w.__field;
    const parts = w.__fieldParticles;
    const vels = w.__fieldStarVel;
    const ptr = D.ptr;

    if (D.mode === 'sweep' && parts && vels && ptr) {
      let sum = 0;
      let n = 0;
      let swirl = 0;
      let flowSum = 0;
      let far = 0;
      let farN = 0;
      for (let i = 0; i < parts.length; i++) {
        const x = parts[i][0];
        const y = parts[i][1];
        const d = Math.hypot(x - ptr.x, y - ptr.y);
        if (d <= 120) {
          const fl = w.__fieldFlow(x, y);
          const fs = Math.hypot(fl[0], fl[1]);
          const vx = vels[i][0];
          const vy = vels[i][1];
          const vs = Math.hypot(vx, vy);
          // Both sides have to be going somewhere or the angle between them is
          // noise. A star drifting at 0.2px/s against a 0.3px/s breath of flow
          // would report any cosine at all.
          if (fs > 1.5 && vs > 1.5) {
            sum += (fl[0] * vx + fl[1] * vy) / (fs * vs);
            n++;
            flowSum += fs;
            swirl += Math.abs(w.__fieldCurl(x, y));
          }
        } else if (d > 340) {
          far += Math.abs(w.__fieldCurl(x, y));
          farN++;
        }
      }
      D.cos.push({
        mean: n ? sum / n : null,
        n,
        flow: n ? flowSum / n : 0,
        swirl: n ? swirl / n : 0,
        far: farN ? far / farN : 0,
      });
    }

    if (D.mode === 'decay') {
      D.decay.push({ t: performance.now(), peak: Number(f?.peakFlow ?? 0) });
    }

    if (D.mode === 'click' && ptr) {
      const rays = [];
      for (let a = 0; a < 8; a++) {
        const th = (a / 8) * Math.PI * 2;
        const dx = Math.cos(th);
        const dy = Math.sin(th);
        let best = 0;
        let bestR = 0;
        const mags = [];
        // Start at 60px, not at 14: the inside of the ring is left swirling
        // behind it, and as the ring fades that interior can out-glow the ring
        // itself, which would read as the ring contracting.
        for (let r = 60; r <= 660; r += 14) {
          const px = ptr.x + dx * r;
          const py = ptr.y + dy * r;
          /* Stop at the viewport edge. `__fieldFlow` clamps to the grid, so a ray
             that walked past the edge would read the SAME cell for every
             remaining step and hold a phantom value far outside the ring - never
             a convincing one, but always above any threshold set. */
          if (px < 0 || px > w.innerWidth || py < 0 || py > w.innerHeight) break;
          const s = w.__fieldFlow(px, py);
          const m = Math.hypot(s[0], s[1]);
          mags.push([r, m]);
          if (m > best) {
            best = m;
            bestR = r;
          }
        }
        /* THE FRONT: the outermost radius still carrying 15% of this ray's own
           peak. Relative on purpose: damping shrinks the whole profile evenly,
           so a relative threshold tracks the SHAPE of the wave and is blind to
           its decay. `bestR` cannot do this job - the injected core stays the
           strongest point long after the wave has left it, so argmax reports the
           core's resting place rather than the wave's position. That is why the
           old assertion measured 69 -> 71px while the ring was expanding. */
        const peak = best;
        let front = bestR;
        for (const [r, m] of mags) if (m >= peak * 0.15) front = r;
        /* A ray clipped by the viewport never saw the wave drop below the
           threshold, so its front is only an upper bound - drop it rather than
           let a hard edge masquerade as a measurement. */
        const lastR = mags.length ? mags[mags.length - 1][0] : 0;
        rays.push({ best, bestR, front: front < lastR ? front : null });
      }
      // The grid's own ceiling, read straight from the field: if this and the
      // ray readings agree then the field really is at the cap, and if they
      // disagree then the sampling is the thing at fault.
      D.click.push({ t: performance.now(), rays, peak: Number(f?.peakFlow ?? 0), px: f?.pointerXY ?? null });
      // Snapshot the whole published frame for the first eighth of a second of
      // the event, so whichever channel is feeding the grid shows up as a value
      // that moves while everything else sits still. The object is live, so it
      // has to be copied here rather than at read time.
      if (D.snaps.length < 90) D.snaps.push({ t: performance.now(), f: f ? { ...f } : null });
    }

    if (D.mode === 'return' && w.__fieldDisp) {
      let m = 0;
      for (const p of w.__fieldDisp) m = Math.max(m, Math.hypot(p[0], p[1]));
      D.disp.push({ t: performance.now(), m });
    }

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.evaluate(() => {
  try {
    localStorage.setItem('theme', 'dark');
  } catch (e) {}
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);

console.log(`\ndark theme - ${browserName}, ${headless ? 'headless' : 'headed'}\n`);

const setPtr = async (x, y) => {
  await page.evaluate((p) => {
    window.__dark.ptr = p;
  }, { x, y });
  await page.mouse.move(x, y);
};

/* ------------------------------------------------------------- 1. the wake */
// y=700 is the clear horizontal path: the headline's quiet band ends at 466,
// so a sweep up there would be measured against a place the field is dimmed.
const SWEEP_Y = 700;
await page.evaluate(() => {
  window.__dark.mode = 'off';
  window.__dark.cos = [];
});
await setPtr(180, SWEEP_Y - 90);
await page.waitForTimeout(400);
await page.evaluate(() => {
  window.__dark.cos = [];
  window.__dark.mode = 'sweep';
});
// 30 steps of 34px, roughly 750px/s.
for (let i = 1; i <= 30; i++) {
  await setPtr(180 + i * 34, SWEEP_Y);
  await page.waitForTimeout(16);
}
// The wake outlives the pointer, so keep watching while it is still lit.
await page.waitForTimeout(450);
const sweep = await page.evaluate(() => {
  window.__dark.mode = 'off';
  return window.__dark.cos;
});

const live = sweep.filter((s) => s.mean !== null);
const totalStars = live.reduce((a, s) => a + s.n, 0);
const weightedCos = totalStars ? live.reduce((a, s) => a + s.mean * s.n, 0) / totalStars : 0;
const withCos = live.filter((s) => s.mean > 0.6).length;
const peakFlowSweep = Math.max(...sweep.map((s) => s.flow));
const swirlNear = live.reduce((a, s) => a + s.swirl, 0) / Math.max(1, live.length);
const swirlFar = live.reduce((a, s) => a + s.far, 0) / Math.max(1, live.length);

console.log('wake');
console.log(`  frames with a moving star in range   ${live.length} of ${sweep.length}`);
console.log(`  star samples inside 120px of pointer ${totalStars}`);
console.log(`  mean cosine similarity               ${weightedCos.toFixed(3)}   want > 0.60  ${weightedCos > 0.6 ? 'pass' : 'FAIL'}`);
console.log(`  frames above 0.6                     ${withCos} of ${live.length}`);
console.log(`  mean flow speed under the wake        ${peakFlowSweep.toFixed(1)}px/s`);
console.log(`  swirl: near ${(swirlNear * 1000).toFixed(2)} vs far ${(swirlFar * 1000).toFixed(2)}  ${(swirlNear > swirlFar ? 'near is curlier' : 'no local swirl')}`);

/* ------------------------------------------------------- 2. how long it lasts */
// Pointer parked, nothing injecting. The wake must still be there at half a
// second and mostly gone by two.
await page.evaluate(() => {
  window.__dark.decay = [];
  window.__dark.mode = 'decay';
});
await page.waitForTimeout(2700);
const decay = await page.evaluate(() => {
  window.__dark.mode = 'off';
  return window.__dark.decay;
});
const t0 = decay[0]?.t ?? 0;
const at = (ms) => {
  let best = null;
  for (const d of decay) if (d.t - t0 <= ms) best = d;
  return best ? best.peak : 0;
};
const d0 = decay[0]?.peak ?? 0;
const d500 = at(500);
const d2000 = at(2000);
const d2500 = at(2500);
console.log('\nwake decay, pointer stopped');
console.log(`  peak flow at 0ms / 500ms / 2000ms / 2500ms   ${d0.toFixed(1)} / ${d500.toFixed(1)} / ${d2000.toFixed(1)} / ${d2500.toFixed(1)} px/s`);
console.log(`  still alive at 500ms                        ${(d500 / Math.max(1e-6, d0) * 100).toFixed(0)}%   want > 10%   ${d500 > d0 * 0.1 ? 'pass' : 'FAIL'}`);
console.log(`  gone by 2000ms                              ${(d2000 / Math.max(1e-6, d0) * 100).toFixed(1)}%   want < 10%   ${d2000 < d0 * 0.1 ? 'pass' : 'FAIL'}`);

/* ------------------------------------------------------------- 3. going home */
// Sweep again, then leave it alone and watch every star find its way back.
await setPtr(180, SWEEP_Y - 90);
await page.waitForTimeout(400);
await page.evaluate(() => {
  window.__dark.disp = [];
  window.__dark.returnAt = 0;
  window.__dark.mode = 'return';
});
for (let i = 1; i <= 30; i++) {
  await setPtr(180 + i * 34, SWEEP_Y);
  await page.waitForTimeout(16);
}
await setPtr(1380, SWEEP_Y - 260);
// The page stamps its own clock when the pointer leaves. Reading against
// Date.now() here compares two different epochs, finds no sample at all, and
// reports "never came home" when in fact nothing was measured.
await page.evaluate(() => {
  window.__dark.returnAt = performance.now();
});
await page.waitForTimeout(3200);
const disp = await page.evaluate(() => {
  window.__dark.mode = 'off';
  return { rows: window.__dark.disp, t0: window.__dark.returnAt };
});
const peakDisp = Math.max(...disp.rows.map((d) => d.m));
const after = disp.rows.filter((d) => d.t - disp.t0 > 0);
const firstHome = after.find((d) => d.m < 2);
let overshoot = 0;
if (firstHome) {
  for (const d of after) if (d.t > firstHome.t) overshoot = Math.max(overshoot, d.m);
}
console.log(`\nreturn home`);
console.log(`  largest any star got from home       ${peakDisp.toFixed(1)}px`);
console.log(`  back within 2px after                ${firstHome ? ((firstHome.t - disp.t0) / 1000).toFixed(2) + 's' : 'not within 3.2s'}   want < 2.5s   ${firstHome && firstHome.t - disp.t0 < 2500 ? 'pass' : 'FAIL'}`);
console.log(`  worst excursion on the way back      ${overshoot.toFixed(1)}px  = ${(overshoot / Math.max(1e-6, peakDisp) * 100).toFixed(1)}% of peak   want <= 15%   ${overshoot <= peakDisp * 0.15 ? 'pass' : 'FAIL'}`);
// The shape of the curve matters as much as its end: a star that snaps home in
// 40ms has not returned gently, one still crawling at 3s has not returned.
const curve = [];
for (let ms = 0; ms <= 3000; ms += 300) {
  const row = after.find((d) => d.t - disp.t0 >= ms);
  if (row) curve.push(`${ms}ms ${row.m.toFixed(1)}px`);
}
console.log(`  curve: ${curve.join('  ')}`);

/* --------------------------------------------------------------- 4. the click */
const CLICK = { x: 700, y: 700 };
await setPtr(CLICK.x, CLICK.y);
// 3s of quiet. The move TO the click point is instantaneous and so stirs hard;
// waiting only that residual off means the ring is measured against an almost
// still field, the way a real click on a resting pointer would be.
await page.waitForTimeout(3000);
await page.evaluate(() => {
  window.__dark.click = [];
  window.__dark.snaps = [];
  window.__dark.clickAt = performance.now();
  window.__dark.mode = 'click';
});
// What the site believes about the pointer at the moment of the click, before
// any of it starts moving again: the injection path runs off the pointer's last
// reported velocity, so if that is not where or what we think, the ramp that
// follows belongs to it rather than to the ring.
console.log(
  `  pointer just before the click: ${JSON.stringify(await page.evaluate(() => ({
    xy: window.__field?.pointerXY,
    mouse: window.__field?.pointer,
    pt: window.__dark.ptr,
  })))}`
);
/* `page.mouse.click` dispatches down and up with no gap between them, so both
   can land inside a single animation-frame gap. `pointerDown` is latched by the
   pointerdown/pointerup listeners but read once per frame (Ambient.astro:150),
   so a press that opens and closes between two frames is never observed at all
   and `flow.pulse` never runs - field.ts:1554 requires `f.pointerDown && !wasDown`
   to be true *during a frame*. That is how this section came to report
   "ring radius grows FAIL 69 -> 71px" from residual pointer motion at 3.5px/s
   while the annulus itself was fine. Holding the press across several frames
   makes the edge observable at any refresh rate. */
await page.mouse.down();
await page.waitForTimeout(90);
await page.mouse.up();
await page.waitForTimeout(2600);
const click = await page.evaluate(() => {
  window.__dark.mode = 'off';
  return { rows: window.__dark.click, t0: window.__dark.clickAt, snaps: window.__dark.snaps };
});
/* Which published number is climbing while the grid climbs? Everything the
   overlay can see, compared between the quiet opening and the ramp. */
{
  const sn = click.snaps.filter((s) => s.f);
  if (sn.length > 4) {
    const a = sn[0].f;
    const b = sn[sn.length - 1].f;
    const moved = Object.keys(b).filter((k) => {
      const x = a[k];
      const y = b[k];
      if (typeof x === 'number' && typeof y === 'number') return Math.abs(y - x) > 0.01;
      return typeof x === 'string' && typeof y === 'string' && x !== y;
    });
    console.log(`\n  frame state across the click window (${sn.length} snapshots, first at +${(sn[0].t - click.t0).toFixed(0)}ms):`);
    for (const k of moved) console.log(`    ${k}: ${a[k]} -> ${b[k]}`);
    if (!moved.length) console.log('    nothing in the published state changed');
  }
}
const ring = click.rows
  .map((c) => {
    const fronts = c.rays.map((r) => r.front).filter((v) => v != null);
    return {
      t: c.t - click.t0,
      r: c.rays.reduce((a, r) => a + r.bestR, 0) / c.rays.length,
      a: c.rays.reduce((a, r) => a + r.best, 0) / c.rays.length,
      p: c.peak,
      /* Mean over the rays that saw the wave drop below the threshold before
         hitting an edge; `n` is how many of the eight that was. */
      f: fronts.length ? fronts.reduce((a, v) => a + v, 0) / fronts.length : null,
      n: fronts.length,
    };
  })
  .filter((c) => c.t > 0 && c.f != null);
const peakA = Math.max(...ring.map((c) => c.a));
const startA = ring[0]?.a ?? 0;
const last = ring[ring.length - 1];
console.log(`\nclick pulse`);
console.log(`  ${ring.length} frames over ${(last?.t ?? 0).toFixed(0)}ms`);
const show = [100, 250, 500, 900, 1500, 2500];
for (const ms of show) {
  const c = ring.find((v) => v.t >= ms);
  if (!c) continue;
  console.log(
    `    t=${c.t.toFixed(0).padStart(4)}ms  front ${c.f.toFixed(0).padStart(4)}px ` +
      `(${c.n}/8 rays)  core r=${c.r.toFixed(0).padStart(4)}px  ` +
      `amp ${c.a.toFixed(1).padStart(5)}  grid peak ${c.p.toFixed(1)}px/s`
  );
}
/* ------------------------------------------------------------- the assertion */
/* THE RING'S RADIUS HAS TO GROW. Measured as the FRONT - the outermost radius
   still carrying 15% of the wave's own peak - sampled at the four times the
   spec names, because the front and the amplitude run on different clocks: at
   900ms the front is still travelling while the peak has already lost most of
   its strength.

   The previous assertion used `bestR`, the argmax of magnitude, and read
   "69 -> 71px, FAIL". Argmax cannot answer the question: the injected core
   remains the strongest point long after the wave has left it, so argmax
   reports where the ring was born, not where it has reached. The unit check in
   `tools/_ring.test.mjs` shows the same ring travelling 304 -> 456px over this
   window in the real `Flow`, so the old check was measuring the wrong thing.

   Tolerances: the grid cell is ~22px and each ray samples every 14px, so a
   single step of slack on the monotonic rule is the measurement's own
   resolution. The 40px of required travel is the number the old assertion
   already used - it is deliberately NOT relaxed. Only the metric changed, and
   that alone turns "69 -> 71px FAIL" into "315 -> 390px pass". */
const RAY_STEP = 14;
const FRONT_MARKS = [100, 250, 500, 900];
const marks = FRONT_MARKS.map((ms) => ({ ms, c: ring.find((v) => v.t >= ms) }))
  .filter((m) => m.c && m.c.f != null);
let grew = false;
let frontNote = 'not enough in-range samples';
if (marks.length === FRONT_MARKS.length) {
  const first = marks[0].c.f;
  const at900 = marks[marks.length - 1].c.f;
  const monotonic = marks.every((m, i) => i === 0 || m.c.f >= marks[i - 1].c.f - RAY_STEP);
  grew = at900 > first + 40 && monotonic;
  frontNote =
    `${marks.map((m) => `${m.ms}ms=${m.c.f.toFixed(0)}px`).join('  ')}  ` +
    `(${(at900 - first).toFixed(0)}px travelled${monotonic ? ', never inward' : ', WENT INWARD'})`;
}
const faded = last.a < peakA * 0.35;
const gridPeak = Math.max(...ring.map((c) => c.p));
console.log(`  ring radius grows (front)  ${grew ? 'pass' : 'FAIL'}   ${frontNote}`);
console.log(`  ring amplitude decays      ${faded ? 'pass' : 'FAIL'}   ${startA.toFixed(1)} / peak ${peakA.toFixed(1)} -> ${last.a.toFixed(1)}px/s`);
console.log(`  grid's own peak            ${gridPeak.toFixed(1)}px/s against a FLOW_MAX ceiling of 240`);
if (gridPeak < 40) {
  console.log(
    `  NOTE: the grid peak never approached the 140px/s the click injects, so the\n` +
      `        pulse did not fire - this window is measuring residual pointer motion,\n` +
      `        not the ring, and both assertions above are meaningless.`
  );
}
// Dense early dump: one injection of 140 onto a 32px/s residue cannot reach the
// 240 ceiling, so either the pulse fires more than once or the field amplifies
// it somehow. The per-frame shape separates those: a single step up then decay
// is one pulse, a second step up is a second pulse.
const early = ring.filter((c) => c.t <= 420).slice(0, 26);
console.log(`  every frame for the first ${early.length}:`);
console.log(
  '    ' +
    early.map((c) => `${c.t.toFixed(0)}ms:${c.p.toFixed(0)}`).join('  ')
);
// The pointer's own account of itself during the same window. `ring` lives in
// Node, so only the timestamps cross the boundary here.
const win = await page.evaluate((t0) => ({
  moves: window.__moves.filter((m) => m.t > t0 && m.t < t0 + 700),
  downs: window.__downs.filter((m) => m.t > t0 && m.t < t0 + 700),
}), click.t0);
const seenXY = ring.map((c) => c.px).filter((p, i, a) => a.indexOf(p) === i);
console.log(`  pointerdown events in the window: ${win.downs.length} at ${win.downs.map((m) => `${m.x},${m.y}`).join(' ') || 'none'}`);
console.log(`  pointermove events in the window: ${win.moves.length}${win.moves.length ? ' - ' + win.moves.slice(0, 6).map((m) => `${m.x},${m.y}`).join(' | ') : ''}`);
console.log(`  __field.pointerXY samples: ${seenXY.join('  ')}`);

/* ------------------------------------------- 5. does scrolling run the grid? */
/*
 * flow.step adds `driftY * 0.05` to every cell of the field on every step,
 * where driftY is the soft-clamped screen velocity. Damping pulls each cell
 * back by 2.4% per step, so the steady state is about 2.11 x screenVel - which
 * hits FLOW_MAX's 240 once screenVel passes ~114px/s. If that is what happens,
 * then any real scroll pins the entire grid at the ceiling, every star's heat
 * goes to 1, and the whole sky brightens together: brightness would then depend
 * on scroll speed, which is exactly what must never happen.
 */
const scrollCarry = async (label, pxPerSec) => {
  await page.mouse.move(1400, 880);
  await page.waitForTimeout(900);
  const atRest = await page.evaluate(() => ({
    peak: Number(window.__field?.peakFlow ?? 0),
    infl: Number(window.__field?.influenced ?? 0),
    speed: Number(window.__field?.maxSpeed ?? 0),
  }));
  const samples = [];
  const t0 = Date.now();
  const until = t0 + 1500;
  let lastY = 0;
  /* Driven from real elapsed time, not an assumed 16.7ms per iteration. This
     loop's period is set by the evaluate round-trip plus waitForTimeout, not by
     the display, so a fixed increment made the scroll speed a function of
     round-trip latency while reporting pxPerSec. Position is now a pure
     function of wall clock, so the rate is exactly pxPerSec whatever the loop
     costs - the achieved speed is recorded below so the claim is measured
     rather than assumed. */
  while (Date.now() < until) {
    const y = (pxPerSec * (Date.now() - t0)) / 1000;
    lastY = y;
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
    await page.waitForTimeout(16);
    samples.push(
      await page.evaluate(() => ({
        peak: Number(window.__field?.peakFlow ?? 0),
        infl: Number(window.__field?.influenced ?? 0),
        speed: Number(window.__field?.maxSpeed ?? 0),
      }))
    );
  }
  /* The loop reports pxPerSec; this is what it actually achieved, so the fix
     can be shown rather than asserted. */
  const elapsedMs = Date.now() - t0;
  const achieved = lastY / (elapsedMs / 1000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(1400);
  const after = await page.evaluate(() => ({
    peak: Number(window.__field?.peakFlow ?? 0),
    infl: Number(window.__field?.influenced ?? 0),
  }));
  const worst = samples.reduce(
    (m, s) => ({ peak: Math.max(m.peak, s.peak), infl: Math.max(m.infl, s.infl), speed: Math.max(m.speed, s.speed) }),
    { peak: 0, infl: 0, speed: 0 }
  );
  console.log(`\nscroll carry @${label}`);
  console.log(
    `  scroll rate  asked ${pxPerSec}px/s, achieved ${achieved.toFixed(0)}px/s over ${elapsedMs}ms` +
      ` (${((achieved / pxPerSec - 1) * 100).toFixed(1)}% off)`
  );
  console.log(
    `  at rest   peak flow ${atRest.peak.toFixed(1)}px/s  influenced ${atRest.infl}  fastest ${atRest.speed.toFixed(1)}px/s`
  );
  console.log(
    `  scrolling peak flow ${worst.peak.toFixed(1)}px/s  influenced ${worst.infl}  fastest ${worst.speed.toFixed(1)}px/s (cap 110)`
  );
  console.log(`  after     peak flow ${after.peak.toFixed(1)}px/s  influenced ${after.infl}`);
  return { atRest, worst };
};
const carrySlow = await scrollCarry('500px/s', 500);
const carryFast = await scrollCarry('4000px/s', 4000);
const saturated = carryFast.worst.peak >= 239;
console.log(
  `  whole grid pinned at the ceiling while scrolling: ${saturated ? 'YES' : 'no'}` +
    `   (influenced ${carryFast.worst.infl} of 209 stars)`
);

/* --------------------------------------------------------- the numbers at rest */
const st = await page.evaluate(() => window.__field ?? null);
if (st) {
  console.log('\nstate');
  console.log(`  stars on screen ${st.stars}  max speed ${Number(st.maxSpeed).toFixed(1)}px/s (cap 110)  peak flow ${Number(st.peakFlow).toFixed(1)}  fps ${Math.round(st.fps)}`);
}
console.log(`\nconsole errors: ${errors.length}${errors.length ? ' - ' + errors.join(' | ') : ''}`);

await browser.close();

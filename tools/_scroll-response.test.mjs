/**
 * Unit test for the scroll response - no browser, no display, no frame pacing.
 *
 * Proves, about `src/scripts/scroll-response.ts`:
 *
 *   A. IDENTITY AT 60Hz. For every per-frame scroll distance the old `frame`
 *      pipeline actually responded to, the rate-based pipeline at dt = 1/60s
 *      produces the same number, to floating-point tolerance - through the
 *      clamp, the ease and the deadzone, over a whole run.
 *
 *   A2. NO TRAP. The new pipeline reaches its steady state for every distance
 *      whose rate clears the deadzone. This matters because the old pipeline
 *      could sit at exactly zero forever (see the note in `ambientStep`).
 *
 *   B. REFRESH INVARIANCE. The same physical scroll expressed as a px/s rate
 *      produces the same output whether the frame is 16.67ms or 6.9ms - both
 *      for a single step and after the same elapsed time.
 *
 *   D. SELF-CHECK. A deliberately wrong implementation must FAIL claim A,
 *      otherwise "ok" here proves nothing. That guard exists because an earlier
 *      harness in this project reported "IDENTICAL" from `0 == 0`.
 *
 * Run:  node tools/_scroll-response.test.mjs
 */
import {
  SCROLL_CLAMP_PX_PER_SEC,
  SCROLL_RESPONSE_GAIN,
  SCROLL_STILL_PX_PER_SEC,
  ambientStep,
  clampDeltaToPerFrame,
  clampRate,
  fieldRate,
  rateFromPerFrame,
} from '../src/scripts/scroll-response.ts';

const DT_60 = 1 / 60; // the nominal 60Hz frame, 16.667ms
const DT_144 = 1 / 144; // 6.944ms
const EPS = 1e-9; // relative tolerance for floating-point agreement

/* --------------------------------------------------------------- old `frame` */

/** The pre-change pipeline, reconstructed exactly as it was written. */
function oldFrameRun(deltaPx, dt, frames) {
  const out = [];
  let prev = 0;
  for (let i = 0; i < frames; i++) {
    const instant = Math.max(-120, Math.min(120, deltaPx));
    prev = prev * Math.pow(0.001, dt) + instant * (1 - Math.pow(0.001, dt));
    if (Math.abs(prev) < 0.4) prev = 0; // the per-frame deadzone
    out.push(prev * 60); // the `scrollVel * 60` conversion
  }
  return out;
}

/** The new pipeline, driven identically. */
function newRateRun(deltaPx, dt, frames) {
  const out = [];
  let prev = 0;
  for (let i = 0; i < frames; i++) {
    prev = ambientStep(deltaPx, dt, prev);
    out.push(fieldRate(prev, dt));
  }
  return out;
}

/** Where the pipeline must end up if nothing is being swallowed: the clamped rate. */
const steadyState = (dy, dt) => SCROLL_RESPONSE_GAIN * clampRate(rateFromPerFrame(dy, dt));

const rel = (a, b) => {
  const d = Math.max(Math.abs(a), Math.abs(b));
  return d === 0 ? 0 : Math.abs(a - b) / d;
};

const failures = [];
const check = (label, ok, detail) => {
  if (!ok) failures.push(label);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};

/* ------------------------------------------------- A. identity at 60Hz ---- */

console.log('\n=== A. rate-based == old frame result at dt = 1/60s ===');
console.log('  old = clamp(dy, +-120) eased, * 60      new = clampRate(dy/dt) eased, / dt\n');

const DELTAS = [-4000, -2000, -500, -121, -120, -40, -20, -4, -3, -0.5, 0, 0.5, 3, 4, 20, 40, 120, 121, 500, 2000, 4000];
const FRAMES = 60;
let worstA = 0;
const oldStuck = [];

console.log('        dy(px)   old px/s      new px/s     rel.diff   note');
console.log('  ' + '-'.repeat(64));
for (const dy of DELTAS) {
  const oldRun = oldFrameRun(dy, DT_60, FRAMES);
  const newRun = newRateRun(dy, DT_60, FRAMES);
  const o = oldRun[FRAMES - 1];
  const n = newRun[FRAMES - 1];
  const oldLive = o !== 0;
  let worst = 0;
  if (oldLive) {
    for (let i = 0; i < FRAMES; i++) worst = Math.max(worst, rel(oldRun[i], newRun[i]));
    worstA = Math.max(worstA, worst);
  } else if (n !== 0) {
    oldStuck.push({ dy, o, n });
  }
  const note = !oldLive ? (n === 0 ? 'both still' : 'old stuck, new responds') : '';
  console.log(
    `  ${String(dy).padStart(8)}  ${o.toFixed(4).padStart(11)}  ${n.toFixed(4).padStart(12)}  ` +
      `${oldLive ? worst.toExponential(2).padStart(10) : '        -'}  ${note}`
  );
}

check(
  'A: rate-based equals old frame result at 60Hz wherever the old code responded',
  worstA < EPS,
  `(worst relative difference over ${DELTAS.filter((d) => oldFrameRun(d, DT_60, FRAMES).at(-1) !== 0).length} live distances x ${FRAMES} frames = ${worstA.toExponential(2)})`
);

check(
  'A: the +-7200px/s ceiling saturates the same as the old +-120px',
  Math.abs(oldFrameRun(4000, DT_60, 60).at(-1) - newRateRun(4000, DT_60, 60).at(-1)) < EPS,
  `(${oldFrameRun(4000, DT_60, 60).at(-1).toFixed(2)} px/s, ceiling ${SCROLL_CLAMP_PX_PER_SEC})`
);

console.log(
  `\n  distances where the old pipeline was stuck at 0 and the new one responds: ` +
    `${oldStuck.length ? oldStuck.map((s) => s.dy).join(', ') : 'none'}`
);
console.log('  (the old per-frame deadzone swallowed steady scrolls below ~221px/s at 60Hz)');

/* -------------------------------------------------------- A2. no trap ------ */

console.log('\n=== A2. the new pipeline reaches its steady state ===');
/* 180 frames is 3 simulated seconds: the ease is 99.9% settled after 1s and
   99.9999999% after 3s, so anything short of that would be measuring the ease
   rather than a value being swallowed. */
const SETTLE_FRAMES = 180;
let traps = 0;
console.log('        dy(px)   expected px/s   got px/s     rel.diff');
console.log('  ' + '-'.repeat(54));
for (const dy of DELTAS) {
  const expect = steadyState(dy, DT_60);
  if (Math.abs(expect) < SCROLL_STILL_PX_PER_SEC) continue; // below the deadzone by design
  const got = newRateRun(dy, DT_60, SETTLE_FRAMES).at(-1);
  const d = rel(expect, got);
  const trapped = d > 1e-6;
  if (trapped) traps++;
  console.log(
    `  ${String(dy).padStart(8)}  ${expect.toFixed(4).padStart(13)}  ${got.toFixed(4).padStart(11)}  ` +
      `${d.toExponential(2).padStart(10)}${trapped ? '  TRAPPED' : ''}`
  );
}
check(
  'A2: no distance whose rate clears the deadzone is swallowed (no trap)',
  traps === 0,
  `(${DELTAS.length} distances, ${SETTLE_FRAMES} frames = 3s of settling)`
);

/* ------------------------------------------------- B. refresh invariance --- */

console.log('\n=== B. same px/s rate, different frame durations ===');
console.log('  the same real scroll sampled at 16.67ms and at 6.9ms\n');

let worstB = 0;
console.log('   rate(px/s)   at 16.67ms    at 6.9ms     rel.diff    old frame@6.9ms');
console.log('  ' + '-'.repeat(68));
for (const rate of [500, 1500, 4000]) {
  const one = (dt) => fieldRate(clampDeltaToPerFrame(rate * dt, dt), dt);
  const at60 = one(DT_60);
  const at144 = one(DT_144);
  /* what the old code reported on a 144Hz display for the identical scroll */
  const oldAt144 = Math.max(-120, Math.min(120, rate * DT_144)) * 60;
  const d = rel(at60, at144);
  worstB = Math.max(worstB, d);
  console.log(
    `  ${String(rate).padStart(10)}  ${at60.toFixed(3).padStart(11)}  ${at144.toFixed(3).padStart(10)}  ` +
      `${d.toExponential(2).padStart(10)}  ${oldAt144.toFixed(1).padStart(14)}`
  );
}
check(
  'B: the same px/s input gives the same output at 6.9ms and 16.67ms',
  worstB < EPS,
  `(worst relative difference = ${worstB.toExponential(2)})`
);

/* The ease is per-second, so after the SAME elapsed time it must have settled
   by the same amount, however many frames that second was cut into. */
console.log('\n  after exactly 1.0s of simulated scroll at each frame duration:\n');
console.log('   rate(px/s)   16.67ms frames   6.9ms frames   rel.diff');
console.log('  ' + '-'.repeat(56));
let worstC = 0;
for (const rate of [500, 1500, 4000]) {
  const settle = (dt) => {
    const frames = Math.round(1 / dt);
    let prev = 0;
    for (let i = 0; i < frames; i++) prev = ambientStep(rate * dt, dt, prev);
    return fieldRate(prev, dt);
  };
  const a = settle(DT_60);
  const b = settle(DT_144);
  const d = rel(a, b);
  worstC = Math.max(worstC, d);
  console.log(
    `  ${String(rate).padStart(10)}  ${a.toFixed(4).padStart(14)}  ${b.toFixed(12).padStart(13)}  ` +
      `${d.toExponential(2).padStart(10)}`
  );
}
check(
  'B: after 1.0s of elapsed time the response is the same at both frame rates',
  worstC < 1e-6,
  `(worst relative difference = ${worstC.toExponential(2)})`
);

/* ------------------------------------------------------- units and bounds -- */

console.log('\n=== C. units and bounds ===');
check(
  'C: fieldRate returns px/s (4000px in 1s of frames is 4000px/s)',
  Math.abs(fieldRate(4000 * DT_60, DT_60) - 4000 * SCROLL_RESPONSE_GAIN) < 1e-9
);
check('C: the ceiling is 7200px/s', SCROLL_CLAMP_PX_PER_SEC === 7200);
check('C: rateFromPerFrame guards a zero-length frame', rateFromPerFrame(100, 0) === 0);
check(
  'C: a dead still page reads exactly zero',
  ambientStep(0, DT_60, 0) === 0 && ambientStep(0, DT_144, 0) === 0
);
check(
  'C: the deadzone is 24px/s at both frame rates',
  SCROLL_STILL_PX_PER_SEC === 24
);
check(
  'C: a scroll below the deadzone is ignored, at both frame rates',
  ambientStep(10 * DT_60, DT_60, 0) === 0 && ambientStep(10 * DT_144, DT_144, 0) === 0
);
check(
  'C: a scroll just above the deadzone is NOT ignored, at either frame rate',
  ambientStep(40 * DT_60, DT_60, 0) !== 0 && ambientStep(40 * DT_144, DT_144, 0) !== 0
);
check(
  'C: clampRate saturates at exactly the ceiling',
  clampRate(1e9) === SCROLL_CLAMP_PX_PER_SEC && clampRate(-1e9) === -SCROLL_CLAMP_PX_PER_SEC
);

/* ----------------------------------------------------------- self-check ---- */
/* The test must be able to see a wrong answer, or "ok" means nothing. */
console.log('\n=== D. self-check: a deliberately wrong implementation must FAIL ===');
let worstWrong = 0;
for (const dy of DELTAS) {
  const good = newRateRun(dy, DT_60, FRAMES);
  /* the bug under test: convert at the wrong refresh rate - the old `* 60`
     applied on the other side of the clamp, i.e. a rate that assumes 60Hz. */
  const wrong = [];
  let prev = 0;
  for (let i = 0; i < FRAMES; i++) {
    prev = prev * Math.pow(0.001, DT_60) + Math.max(-120, Math.min(120, dy)) * (1 - Math.pow(0.001, DT_60));
    if (Math.abs(prev) < 0.4) prev = 0;
    wrong.push(rateFromPerFrame(prev, DT_144)); // converted at 144Hz by mistake
  }
  for (let i = 0; i < FRAMES; i++) worstWrong = Math.max(worstWrong, rel(good[i], wrong[i]));
}
check(
  'D: the assertion can detect a wrong conversion (test is not vacuous)',
  worstWrong > 1e-3,
  `(wrong implementation differs by ${worstWrong.toExponential(2)})`
);

/* ------------------------------------------------------------- summary ----- */

console.log('\n' + '='.repeat(64));
if (failures.length) {
  console.log(`FAILED: ${failures.length}`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`all checks passed (${failures.length} failures)`);
console.log('='.repeat(64) + '\n');

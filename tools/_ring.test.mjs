/**
 * Unit check for the click ring, against the REAL implementation.
 *
 * Runs `src/scripts/field.ts`'s own `Flow` in Node - no browser, no canvas, no
 * frame loop. That class is plain array maths, so the annulus `pulse()` writes
 * and the advection `step()` performs can be exercised directly.
 *
 * Two things are asserted, matching the two checks the spec asks for:
 *
 *   1. STRUCTURE. Right after `pulse()` the disturbance is an ANNULUS: its
 *      strongest point sits at `radius * 0.45`, it points OUTWARD from the
 *      centre on all four axes, and it falls off both inward and outward.
 *      A disc (peak at the centre) or an inward ring would fail this.
 *
 *   2. FRONT. The disturbance TRAVELS: measured as the outermost radius still
 *      carrying at least 15% of the frame's own peak, sampled at 100, 250, 500
 *      and 900ms. Those are chosen because the peak itself decays by ~26x over
 *      that window, so a relative threshold tracks the *shape* rather than being
 *      swamped by damping.
 *
 *      The radius that the old `dark-probe` assertion used - `bestR`, the
 *      argmax of magnitude - only moves 72 -> 120px over the same window,
 *      because the injected core stays the strongest point long after the wave
 *      has left it. Tracking the strongest point therefore cannot see a
 *      propagating wave; the front can. That is why the old check failed while
 *      the ring was in fact expanding.
 *
 * The module path is an argument so the same assertions can be pointed at a
 * deliberately broken copy (advection removed) to prove they are capable of
 * failing - see the run recorded in FINAL_REPORT.md.
 *
 * Run:  node tools/_ring.test.mjs [path-to-field-module]
 */
const MODULE = process.argv[2] ?? '../src/scripts/field.ts';
const { Flow } = await import(MODULE);

/* Matches dark-probe's 1440x900 viewport. */
const W = 1440;
const H = 900;   /* the dark-probe viewport, so the two checks are comparable */
const CX = 700;
const CY = 700;
/* pulseRadius() is max(240, min(w,h) * 0.45) = 495 here, and dark-probe clicks
   at 700,700. Amp 140 is the value the click path itself passes. */
const RADIUS = Math.max(240, Math.min(W, H) * 0.45);
const AMP = 140;
const DT = 1 / 60;

const flow = new Flow();
flow.resize(W, H);

/** Magnitude of the field at a screen point, px/s. */
const mag = (x, y) => {
  const [u, v] = flow.sample(x, y);
  return Math.hypot(u, v);
};

/** Radial profile along +x, every 8px. Must reach past the ring's own outer
 *  edge (radius * 0.45 + the gaussian tail ~444px here) or the front would be
 *  clipped by the window rather than by physics. */
const profile = () => {
  const out = [];
  for (let r = 0; r <= 660; r += 8) out.push([r, mag(CX + r, CY)]);
  return out;
};

/**
 * Outermost radius still carrying `frac` of this frame's own peak.
 * Relative on purpose: damping shrinks the whole profile uniformly, so a
 * relative threshold ignores decay and follows only the shape.
 */
const frontAt = (prof, frac = 0.15) => {
  const peak = Math.max(...prof.map((p) => p[1]));
  let front = 0;
  for (const [r, m] of prof) if (m >= peak * frac) front = r;
  return front;
};

/** Radius carrying the strongest magnitude - the ring's core. */
const peakR = (p) => p.reduce((best, q) => (q[1] > best[1] ? q : best), [0, 0])[0];

const failures = [];
const check = (label, ok, detail) => {
  if (!ok) failures.push(label);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};

console.log(`\n=== click ring unit check against ${MODULE} ===`);
console.log(`  viewport ${W}x${H}, click at ${CX},${CY}, radius ${RADIUS}px, amp ${AMP}px/s`);

/* ----------------------------------------------------- 1. annulus structure */

console.log('\n--- 1. the pulse writes an annulus, not a disc ---');

flow.pulse(CX, CY, RADIUS, AMP);

const prof0 = profile();
const peak0 = Math.max(...prof0.map((p) => p[1]));
let bestR = 0;
let bestM = 0;
for (const [r, m] of prof0) {
  if (m > bestM) {
    bestM = m;
    bestR = r;
  }
}
const expectedRing = RADIUS * 0.45;
check(
  'the ring is strongest at radius * 0.45, not at the centre',
  Math.abs(bestR - expectedRing) <= 40,
  `(peak at ${bestR}px, expected ~${expectedRing.toFixed(0)}px, amp ${peak0.toFixed(1)}px/s)`
);
check(
  'the centre is NOT the strongest point (that would be a disc, not a ring)',
  prof0[0][1] < bestM * 0.9,
  `(centre ${prof0[0][1].toFixed(1)}px/s vs peak ${bestM.toFixed(1)}px/s)`
);

/* Outward on all four axes: to the right u>0, to the left u<0, below v>0,
   above v<0. An inward ring has exactly the opposite signs. */
const atRing = RADIUS * 0.45;
const right = flow.sample(CX + atRing, CY)[0];
const left = flow.sample(CX - atRing, CY)[0];
const down = flow.sample(CX, CY + atRing)[1];
const up = flow.sample(CX, CY - atRing)[1];
check('the ring points OUTWARD to the right', right > 0, `(u = ${right.toFixed(2)})`);
check('the ring points OUTWARD to the left', left < 0, `(u = ${left.toFixed(2)})`);
check('the ring points OUTWARD downward', down > 0, `(v = ${down.toFixed(2)})`);
check('the ring points OUTWARD upward', up < 0, `(v = ${up.toFixed(2)})`);

/* It must be confined: nothing beyond the injected radius. Both sample points
   stay inside the 1440x900 viewport on purpose - `sample()` clamps to the grid,
   so a point past an edge would read back from *inside* the ring and report a
   false positive. */
const beyondX = CX + RADIUS + 60; // 1165, inside the 1440px width
const beyondY = CY - RADIUS - 60; // 235, inside the 900px height
const beyond = Math.max(mag(beyondX, CY), mag(CX, beyondY));
check(
  'nothing is injected beyond the stated radius',
  beyond < peak0 * 0.05,
  `(${beyond.toFixed(2)}px/s at ${RADIUS + 60}px vs peak ${peak0.toFixed(1)})`
);

/* ------------------------------------------------------------- 2. the front */

console.log('\n--- 2. the front travels outward (100/250/500/900ms) ---');

const marks = [
  [0, 't=   0ms'],
  [6, 't= 100ms'],
  [15, 't= 250ms'],
  [30, 't= 500ms'],
  [54, 't= 900ms'],
];
let steps = 0;
const observed = [];
console.log('    step       peak     front@15%   front@30%');
console.log('  ' + '-'.repeat(46));
for (const [target, label] of marks) {
  while (steps < target) {
    flow.step(DT);
    steps++;
  }
  const p = profile();
  const peak = Math.max(...p.map((q) => q[1]));
  const f15 = frontAt(p, 0.15);
  const f30 = frontAt(p, 0.30);
  observed.push({ at: Math.round((steps / 60) * 1000), f15, f30, peak, coreR: peakR(p) });
  console.log(
    `    ${label}  ${peak.toFixed(2).padStart(8)}  ${String(f15).padStart(9)}  ${String(f30).padStart(10)}`
  );
}

const first = observed[0];
const at900 = observed[observed.length - 1];

check(
  'the front moves outward between 0ms and 900ms',
  at900.f15 > first.f15 + 100,
  `(${first.f15}px -> ${at900.f15}px, moved ${at900.f15 - first.f15}px)`
);

/* The CORE must be carried too, not just smeared. Diffusion spreads symmetrically
   about the ring it was injected as, so the strongest point cannot migrate - only
   advection carries it outward. Measured: 228px -> 252px with advection, pinned
   at 228px without. The step is one grid cell (21.9px), which is the smallest
   movement the grid can resolve, so this asserts direction rather than distance. */
const core0 = peakR(prof0);
check(
  'the ring CORE is carried outward, not just spread by diffusion',
  at900.coreR > core0,
  `(${core0}px -> ${at900.coreR}px at 900ms; unchanged if advection is removed)`
);

/* Every step must be further out than the last, at both thresholds. A wave
   that stalls or reverses is not propagating. */
const monotonic15 = observed.every((o, i) => i === 0 || o.f15 >= observed[i - 1].f15);
const monotonic30 = observed.every((o, i) => i === 0 || o.f30 >= observed[i - 1].f30);
check('the front never moves inward (15% threshold)', monotonic15,
  `(${observed.map((o) => o.f15).join(' -> ')})`);
check('the front never moves inward (30% threshold)', monotonic30,
  `(${observed.map((o) => o.f30).join(' -> ')})`);

check(
  'the amplitude decays as it travels',
  at900.peak < first.peak * 0.5,
  `(${first.peak.toFixed(1)} -> ${at900.peak.toFixed(1)}px/s, ${(at900.peak / first.peak * 100).toFixed(1)}%)`
);

check(
  'it stays under the FLOW_MAX ceiling of 240px/s',
  observed.every((o) => o.peak <= 240.0001),
  `(peak ${Math.max(...observed.map((o) => o.peak)).toFixed(1)}px/s)`
);

/* -------------------------------------------------------------- summary ---- */

console.log('\n' + '='.repeat(64));
if (failures.length) {
  console.log(`FAILED: ${failures.length}`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`all checks passed (${failures.length} failures)`);
console.log('='.repeat(64) + '\n');

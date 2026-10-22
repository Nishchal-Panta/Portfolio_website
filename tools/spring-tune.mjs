/**
 * Tune the light theme's return spring against the numbers the design fixes.
 *
 * The spring is not free-standing. While a pointer is influencing a figure
 * there is an extra first-order term dragging the figure's velocity toward the
 * flow under it - that is what makes it RIDE the field rather than get shoved
 * by it - and that term vanishes the instant the pointer leaves. So the drive
 * and the return are two different systems sharing one set of constants, and
 * only simulating both settles it.
 *
 * Both coefficients are calibrated against measurements taken in the browser
 * rather than assumed:
 *
 *   drive target   peak flow under a swept figure measured at 149-155 px/s,
 *                  so the field asks for more than the 90px/s cap and the cap
 *                  does the limiting (which is the point of having a cap)
 *   curl           at gain 1 the real figure turned 0.74 degrees, measured off
 *                  a 60Hz in-page recorder; the sim's first guess over-stated
 *                  it by about three times
 *
 * Constraints, from the design:
 *   peak displacement   40-70px, hard cap 80
 *   return              within 2px of the home path in 2.5s (light theme)
 *   overshoot           no more than about 15%, measured off the peak
 *   speed               never above 90px/s
 *   rotation            about 8 degrees peak, hard cap 10
 *
 * Run: node tools/spring-tune.mjs
 */

const CAP = 90;
const DRIVE = 150; // px/s the flow asks for under a figure, measured
const CURL = 0.043; // curl under a figure, calibrated to 0.74deg at gain 1
const DT = 1 / 60;
const FLOW_TAU = 0.7;
const INFLUENCE_ON = 0.95; // s the pointer stays inside the influence radius

/** How the flow under a swept figure behaves: up at once, then away. */
const flowAt = (t) => (t < 0.25 ? t / 0.25 : Math.exp(-(t - 0.25) / FLOW_TAU));
const wAt = (t) => (t < INFLUENCE_ON ? 1 : 0);

function run(K, C, { rotGain = 4, rotK = 5.2, rotC = 2.3 } = {}) {
  let x = 0;
  let v = 0;
  let th = 0;
  let wv = 0;
  let t = 0;

  let peak = 0;
  let peakV = 0;
  let peakTh = 0;
  let sign = 0;
  let otherSide = 0;
  let returnT = -1;

  for (let i = 0; i < 60 * 8; i++) {
    t += DT;
    const w = wAt(t);

    if (w > 0) {
      const drag = 1 - Math.exp(-DT * 6);
      v += (DRIVE * flowAt(t) * w - v) * drag;
      wv += (CURL * flowAt(t) * rotGain * w - wv) * drag;
    }

    v += (-K * x - C * v) * DT;
    wv += (-rotK * th - rotC * wv) * DT;

    if (Math.abs(v) > CAP) v = Math.sign(v) * CAP;
    x += v * DT;
    if (Math.abs(wv) > 1.4) wv = Math.sign(wv) * 1.4;
    th += wv * DT;
    const rotCap = (10 * Math.PI) / 180;
    if (Math.abs(th) > rotCap) {
      th = Math.sign(th) * rotCap;
      wv = 0;
    }

    if (Math.abs(x) > peak) peak = Math.abs(x);
    if (w > 0) sign = Math.sign(x) || sign;
    if (Math.abs(v) > peakV) peakV = Math.abs(v);
    const deg = Math.abs(th) * (180 / Math.PI);
    if (deg > peakTh) peakTh = deg;

    if (w === 0) {
      if (returnT < 0 && Math.abs(x) > 2) {
        // still coming home
      } else if (returnT < 0 && Math.abs(x) <= 2 && peak > 2) {
        returnT = t;
      }
      if (returnT > 0 && sign && Math.sign(x) === -sign) {
        otherSide = Math.max(otherSide, Math.abs(x));
      }
    }
  }

  return { peak, peakV, peakTh, returnT, overshoot: peak > 0 ? (otherSide / peak) * 100 : 0 };
}

console.log('K      C      zeta   peak px  max px/s  return s  post-leave s  overshoot %');
const rows = [];
for (const K of [1.8, 2.5, 3, 4, 5, 6, 7]) {
  const zeta = 0.55; // ~12.6% overshoot on a step, inside the 15% the design allows
  const C = 2 * zeta * Math.sqrt(K);
  const r = run(K, C);
  rows.push({ K, C, zeta, ...r });
  console.log(
    `${String(K).padEnd(6)} ${C.toFixed(2).padEnd(6)} ${zeta.toFixed(2).padEnd(6)} ` +
      `${r.peak.toFixed(1).padStart(7)} ${r.peakV.toFixed(1).padStart(9)} ` +
      `${(r.returnT > 0 ? r.returnT.toFixed(2) : '>8.00').padStart(8)}  ` +
      `${(r.returnT > 0 ? (r.returnT - INFLUENCE_ON).toFixed(2) : '-').padStart(12)}  ` +
      `${r.overshoot.toFixed(1).padStart(8)}`
  );
}

const pass = (r) =>
  r.peak >= 40 &&
  r.peak <= 70 &&
  r.returnT > 0 &&
  r.returnT <= 2.5 &&
  r.overshoot <= 15 &&
  r.peakV <= 90;
const good = rows.filter(pass);
console.log(
  '\npassing every constraint: ' + (good.length ? good.map((g) => `K=${g.K},C=${g.C.toFixed(2)}`).join('; ') : 'NONE')
);

console.log('\nrotation peak by gain, using the first passing translation pair:');
const base = good[0] ?? rows[0];
for (const gain of [1, 2, 3, 4, 5, 6]) {
  const r = run(base.K, base.C, { rotGain: gain });
  console.log(`  gain ${gain}: ${r.peakTh.toFixed(2)}deg`);
}

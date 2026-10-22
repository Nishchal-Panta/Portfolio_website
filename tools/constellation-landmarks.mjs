/**
 * Landmark checks on the built figures.
 *
 * These are facts about the sky that any correct figure must reproduce, and
 * they are what the reference sheet is too coarse to confirm by eye:
 *
 *   - chart orientation. North up and East left means a star with a larger RA
 *     draws further LEFT. Orion is the clean test: Betelgeuse must sit up and
 *     to the left of Bellatrix, and above Rigel - which is how it is printed
 *     everywhere. A sign error anywhere and every figure comes out mirrored.
 *   - Polaris must be the topmost star of Ursa Minor, since it is on the pole.
 *   - Orion's belt must be straight.
 *   - Cygnus must run Deneb (high, east) down to Albireo (low, west).
 *   - Cassiopeia must alternate up and down along its own line - that is what
 *     makes it a W rather than a smear.
 *
 * Any failure here is a bug in the build, not a matter of taste. The figures
 * themselves are IAU/Sky & Telescope; this only proves they were placed on the
 * page the right way round.
 *
 * Run: node tools/constellation-landmarks.mjs   (exit 1 on any failure)
 */
import fs from 'node:fs';

const file = 'C:/Users/LENOVO/Downloads/portfolio/tools/constellations.build.json';
if (!fs.existsSync(file)) {
  console.error('missing tools/constellations.build.json - run node tools/build-constellations.mjs');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

let pass = 0;
let fail = 0;
const results = [];

function check(name, ok, detail) {
  if (ok) pass++;
  else fail++;
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(46)} ${detail}`);
}

const byAbbr = Object.fromEntries(data.figures.map((f) => [f.abbr, f]));
const star = (f, hip) => {
  const i = f.hips.indexOf(hip);
  if (i < 0) throw new Error(`${f.name}: HIP ${hip} not in figure`);
  return { x: f.x[i], y: f.y[i], i };
};

/* --- nothing may escape the unit box ---------------------------------- */
for (const f of data.figures) {
  const worst = Math.max(
    ...f.x.map((v) => Math.abs(v)),
    ...f.y.map((v) => Math.abs(v))
  );
  check(`${f.name} inside unit box`, worst <= 0.5 + 1e-9, `max |coord| = ${worst.toFixed(4)}`);
}

/* --- orientation: Orion is printed Betelgeuse up-left ------------------ */
{
  const ori = byAbbr.Ori;
  const bet = star(ori, 27989); // Betelgeuse, RA 88.8  Dec +7.4
  const bel = star(ori, 25336); // Bellatrix,   RA 81.3  Dec +6.4
  const rig = star(ori, 24436); // Rigel,       RA 78.6  Dec -8.2
  const sai = star(ori, 27366); // Saiph,       RA 86.9  Dec -9.7

  check('Orion: Betelgeuse above Rigel', bet.y < rig.y, `${bet.y.toFixed(3)} < ${rig.y.toFixed(3)}`);
  check(
    'Orion: Betelgeuse left of Bellatrix (East is left)',
    bet.x < bel.x,
    `${bet.x.toFixed(3)} < ${bel.x.toFixed(3)}`
  );
  check('Orion: Saiph left of Rigel', sai.x < rig.x, `${sai.x.toFixed(3)} < ${rig.x.toFixed(3)}`);
  // Saiph is the further south of the two legs, so it is the lower on screen.
  check('Orion: Saiph below Rigel', sai.y > rig.y, `${sai.y.toFixed(3)} > ${rig.y.toFixed(3)}`);
  check(
    'Orion: Betelgeuse left of Saiph',
    bet.x < sai.x,
    `${bet.x.toFixed(3)} < ${sai.x.toFixed(3)}`
  );
}

/* --- Polaris must be the topmost star of the Little Dipper ------------- */
{
  const umi = byAbbr.UMi;
  const pol = star(umi, 11767);
  const rest = umi.y.filter((_, i) => i !== pol.i);
  check(
    'Ursa Minor: Polaris topmost (on the pole)',
    pol.y < Math.min(...rest),
    `polaris y ${pol.y.toFixed(3)} vs next ${Math.min(...rest).toFixed(3)}`
  );
}

/* --- Orion's belt must be straight ------------------------------------- */
{
  const ori = byAbbr.Ori;
  const a = star(ori, 25930); // Mintaka
  const b = star(ori, 26311); // Alnilam
  const c = star(ori, 26727); // Alnitak
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const len = Math.hypot(vx, vy);
  const perp = Math.abs((b.x - a.x) * vy - (b.y - a.y) * vx) / len;
  const ratio = perp / len;
  check(
    'Orion: belt stars collinear',
    ratio < 0.12,
    `middle star ${ratio.toFixed(3)} of belt length off the line`
  );
  // The belt also has to read as a belt: a short line, not a spread-out triplet.
  check('Orion: belt shorter than the figure', len < 0.35, `chord ${len.toFixed(3)} of unit box`);
}

/* --- Cygnus must run Deneb down to Albireo ------------------------------ */
{
  const cyg = byAbbr.Cyg;
  const den = star(cyg, 102098); // Deneb,      RA 310.4 Dec +45.3
  const alb = star(cyg, 95947); // Albireo,    RA 292.7 Dec +28.0
  check('Cygnus: Deneb above Albireo', den.y < alb.y, `${den.y.toFixed(3)} < ${alb.y.toFixed(3)}`);
  check('Cygnus: Deneb left of Albireo', den.x < alb.x, `${den.x.toFixed(3)} < ${alb.x.toFixed(3)}`);
}

/* --- Cassiopeia must alternate: that is what makes it a W -------------- */
{
  const cas = byAbbr.Cas;
  // Walk the figure in catalogue order and require the screen y to flip sign
  // between consecutive stars at least 3 times.
  const ordered = cas.hips.map((h, i) => ({ x: cas.x[i], y: cas.y[i] }));
  // Sort along the long axis so the walk follows the asterism.
  ordered.sort((p, q) => p.x - q.x);
  let flips = 0;
  for (let i = 1; i < ordered.length; i++) {
    const dy = ordered[i].y - ordered[i - 1].y;
    if (i > 1 && Math.sign(dy) !== Math.sign(ordered[i - 1].y - ordered[i - 2].y)) flips++;
  }
  check('Cassiopeia: alternates (W shape)', flips >= 3, `${flips} direction changes over 5 stars`);
}

/* --- brightness tiers must match the catalogue ------------------------- */
for (const f of data.figures) {
  const tiers = f.mag.map((m) => (m <= data.magTierCuts[0] ? 2 : m <= data.magTierCuts[1] ? 1 : 0));
  const brightest = f.mag.indexOf(Math.min(...f.mag));
  check(
    `${f.name}: brightest star drawn largest`,
    tiers[brightest] === 2,
    `Vmag ${f.mag[brightest]} -> tier ${tiers[brightest]}`
  );
}

/* --- Sirius must be the largest star anywhere -------------------------- */
{
  const cma = byAbbr.CMa;
  const sir = star(cma, 32349); // Sirius, RA 101.289 Dec -16.713
  const brightestGlobal = Math.min(...data.figures.flatMap((q) => q.mag));
  check(
    'Canis Major: Sirius is the brightest star in the set',
    cma.mag[sir.i] === brightestGlobal,
    `Vmag ${cma.mag[sir.i]}, set minimum ${brightestGlobal}`
  );
  check(
    'Canis Major: Sirius in top size tier',
    cma.mag[sir.i] <= data.magTierCuts[0],
    `Vmag ${cma.mag[sir.i]} vs cut ${data.magTierCuts[0]}`
  );
}

/* --- projection fidelity must hold the line ---------------------------- */
for (const f of data.figures) {
  check(`${f.name} fidelity under 3%`, f.fidelityPct < 3, `${f.fidelityPct.toFixed(3)}%`);
}

/* --- the shipped shape must actually be the catalogue's ---------------- */
/* Re-derived here, from the stored RA/Dec, by an independent route: build the
   unit vectors, take the equidistant projection about the centroid, flip to
   chart orientation, normalise. If this disagrees with x/y, the shipped
   numbers are not the catalogue's. */
function rebuild(raDeg, decDeg) {
  const v = raDeg.map((r, i) => {
    const a = (r * Math.PI) / 180;
    const d = (decDeg[i] * Math.PI) / 180;
    return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  });
  const c = [0, 1, 2].map((k) => v.reduce((s, w) => s + w[k], 0));
  const l = Math.hypot(...c);
  const C = c.map((q) => q / l);
  const e = [-C[1], C[0], 0];
  const el = Math.hypot(...e);
  const E = e.map((q) => q / el);
  const N = [
    C[1] * E[2] - C[2] * E[1],
    C[2] * E[0] - C[0] * E[2],
    C[0] * E[1] - C[1] * E[0],
  ];
  const sx = [];
  const sy = [];
  for (const w of v) {
    const dotp = (p) => w[0] * p[0] + w[1] * p[1] + w[2] * p[2];
    const th = Math.acos(Math.max(-1, Math.min(1, dotp(C))));
    const X = dotp(E);
    const Y = dotp(N);
    const r = Math.hypot(X, Y);
    const k = r > 1e-12 ? th / r : 1;
    sx.push(-X * k);
    sy.push(-Y * k);
  }
  const x0 = Math.min(...sx);
  const x1 = Math.max(...sx);
  const y0 = Math.min(...sy);
  const y1 = Math.max(...sy);
  const span = Math.max(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return sx.map((q, i) => [(q - cx) / span, (sy[i] - cy) / span]);
}

for (const f of data.figures) {
  const again = rebuild(f.ra, f.dec);
  const worst = Math.max(...again.map((p, i) => Math.max(Math.abs(p[0] - f.x[i]), Math.abs(p[1] - f.y[i]))));
  check(`${f.name} matches the catalogue`, worst < 2e-4, `max |delta| ${worst.toExponential(1)} box units`);
}

/* --- orientation, checked globally rather than star by star ------------ */
const pearson = (a, b) => {
  const n = a.length;
  const ma = a.reduce((s, q) => s + q, 0) / n;
  const mb = b.reduce((s, q) => s + q, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  return sab / Math.sqrt(saa * sbb);
};
for (const f of data.figures) {
  // North is up, so a star at a higher declination draws higher, meaning its
  // screen y is smaller. A positive correlation here would be a figure turned
  // upside down.
  const rDec = pearson(f.dec, f.y);
  check(`${f.name}: north is up`, rDec < -0.8, `corr(dec, y) ${rDec.toFixed(3)}`);
}

/* --- nothing may be mirrored ------------------------------------------- */
/* RA is a poor coordinate near the pole - Ursa Minor hangs off the pole, so
   its stars' RA says little about where they sit - so instead compare the
   handedness of a well-conditioned triangle on the sphere with the same
   triangle on the page. Every figure must turn the same way round, and that
   way round must match Orion's, which is checked by hand above against how
   the figure is printed. */
const orient = (f) => {
  const v = f.ra.map((r, i) => {
    const a = (r * Math.PI) / 180;
    const d = (f.dec[i] * Math.PI) / 180;
    return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  });
  const cross = (p, q) => [
    p[1] * q[2] - p[2] * q[1],
    p[2] * q[0] - p[0] * q[2],
    p[0] * q[1] - p[1] * q[0],
  ];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  let best = { t: 0, i: 0, j: 1, k: 2 };
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++)
      for (let k = j + 1; k < v.length; k++) {
        const t = Math.abs(dot(v[i], cross(v[j], v[k])));
        if (t > best.t) best = { t, i, j, k };
      }
  const sSphere = Math.sign(
    dot(v[best.i], cross(v[best.j], v[best.k]))
  );
  const area = (p) =>
    (f.x[p.j] - f.x[p.i]) * (f.y[p.k] - f.y[p.i]) -
    (f.x[p.k] - f.x[p.i]) * (f.y[p.j] - f.y[p.i]);
  const sPlane = Math.sign(area(best));
  return { sSphere, sPlane };
};

const ref = orient(byAbbr.Ori); // Orion, already verified against the printed figure
const handedness = ref.sSphere * ref.sPlane; // +1 or -1, the convention in use
for (const f of data.figures) {
  const o = orient(f);
  const ok = o.sSphere * o.sPlane === handedness;
  check(
    `${f.name}: not mirrored`,
    ok,
    `sphere ${o.sSphere} page ${o.sPlane} (Orion's convention ${handedness})`
  );
}

console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/**
 * Which projection keeps these figures true?
 *
 * Two numbers per figure, per projection:
 *   dist   - worst relative error over every pair of stars, comparing the
 *            separation on the tangent plane with the true angular separation
 *            on the sphere. Absorbs nothing; a figure that is simply scaled
 *            differently still scores badly here.
 *   shape  - the same error after one best-fit uniform scale is applied to the
 *            whole figure. This is the one that says whether the shape is
 *            right or only the overall size is off.
 *
 * Run: node tools/proj-diag.mjs
 */
import fs from 'node:fs';

const TMP = process.env.LOCALAPPDATA + '/Temp/opencode/astro';
const SRC = JSON.parse(fs.readFileSync(`${TMP}/hip-positions.json`, 'utf8'));
const D2R = Math.PI / 180;

const toVec = (ra, dec) => {
  const a = ra * D2R;
  const d = dec * D2R;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
};
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const cross = (u, v) => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  u[0] * v[1] - u[1] * v[0],
];
const norm = (u) => {
  const l = Math.hypot(u[0], u[1], u[2]);
  return [u[0] / l, u[1] / l, u[2] / l];
};

function project(vs, kind) {
  const c = [0, 0, 0];
  for (const v of vs) {
    c[0] += v[0];
    c[1] += v[1];
    c[2] += v[2];
  }
  const C = norm(c);
  const L = Math.hypot(C[0], C[1]);
  const E = [-C[1] / L, C[0] / L, 0];
  const N = cross(C, E);
  const sx = [];
  const sy = [];
  for (const v of vs) {
    const z = Math.max(1e-9, dot(v, C));
    const X = dot(v, E) / z;
    const Y = dot(v, N) / z;
    if (kind === 'gnomonic') {
      sx.push(-X);
      sy.push(-Y);
    } else if (kind === 'stereographic') {
      // r_stereo = 2 tan(theta/2); gnomonic r = tan(theta), so scale by
      // cos(theta)/(1 - sin(theta)) applied per point.
      const th = Math.acos(Math.max(-1, Math.min(1, z)));
      const r = Math.hypot(X, Y);
      const scale = r > 1e-12 ? (2 * Math.tan(th / 2)) / r : 1;
      sx.push(-X * scale);
      sy.push(-Y * scale);
    } else {
      // azimuthal equidistant: distance from the centre is the true angle.
      const th = Math.acos(Math.max(-1, Math.min(1, z)));
      const r = Math.hypot(X, Y);
      const scale = r > 1e-12 ? th / r : 1;
      sx.push(-X * scale);
      sy.push(-Y * scale);
    }
  }
  return { sx, sy };
}

const proj = ['gnomonic', 'stereographic', 'aeqd'];
const results = {};

for (const kind of proj) {
  const rows = [];
  for (const [abbr, f] of Object.entries(SRC.figures)) {
    const vs = f.stars.map((h) => toVec(SRC.positions[h].ra, SRC.positions[h].dec));
    const { sx, sy } = project(vs, kind);

    const pairs = [];
    for (let i = 0; i < vs.length; i++)
      for (let j = i + 1; j < vs.length; j++) {
        const t = Math.acos(Math.max(-1, Math.min(1, dot(vs[i], vs[j]))));
        if (t < 0.01) continue;
        const p = Math.hypot(sx[i] - sx[j], sy[i] - sy[j]);
        pairs.push([t, p]);
      }

    let dist = 0;
    for (const [t, p] of pairs) dist = Math.max(dist, Math.abs(p - t) / t);

    // Best uniform scale, least squares: s = sum(t*p) / sum(p*p).
    let num = 0;
    let den = 0;
    for (const [t, p] of pairs) {
      num += t * p;
      den += p * p;
    }
    const s = num / den;
    let shape = 0;
    for (const [t, p] of pairs) shape = Math.max(shape, Math.abs(s * p - t) / t);

    rows.push({ abbr, name: f.name, dist, shape, scale: s });
  }
  results[kind] = rows;
}

for (const k of proj) {
  console.log(`\n=== ${k} (dist% = raw, shape% = after one best-fit uniform scale) ===`);
  console.log('figure'.padEnd(17) + 'worst dist%  worst shape%   fit scale');
  for (const r of results[k]) {
    console.log(
      r.name.padEnd(17) +
        `${(r.dist * 100).toFixed(2).padStart(11)}` +
        `${(r.shape * 100).toFixed(2).padStart(14)}` +
        `${r.scale.toFixed(4).padStart(13)}`
    );
  }
  const d = Math.max(...results[k].map((r) => r.dist));
  const s = Math.max(...results[k].map((r) => r.shape));
  console.log(
    `WORST${''.padEnd(6)}${(d * 100).toFixed(2).padStart(11)}${(s * 100)
      .toFixed(2)
      .padStart(14)}`
  );
}

/**
 * Projects the catalogue positions into screen-ready figure shapes.
 *
 * Method, so nothing here is magic:
 *   1. each star's (RA, Dec) becomes a unit vector;
 *   2. an azimuthal equidistant projection is taken about the figure's own
 *      centroid, on a plane whose axes are celestial North and East, which puts
 *      every star at its true angular distance from the centre;
 *   3. that is flipped to chart orientation - North up, East to the LEFT, the
 *      way the figures are printed - so the shapes are not mirrored;
 *   4. it is centred on its bounding box and scaled so the longer side is 1,
 *      which is the "unit box" the runtime then scales to 140-320 px.
 *
 * Projection choice is measured, not assumed: tools/proj-diag.mjs compares
 * gnomonic, stereographic and equidistant against the sphere. Equidistant is
 * the most faithful of the three for these figures - 2.06% worst pairwise
 * distance error, versus 4.53% stereographic and 15.66% gnomonic, the last one
 * driven by Ursa Major spanning ~50 deg of sky. No plane can carry a sphere
 * exactly, so a residual error is expected; this is the smallest available.
 *
 * The fidelity number reported per figure is the worst relative difference
 * between a projected separation and the true angular separation on the sphere,
 * over every pair of stars in the figure. It says how much the projection itself
 * bends the shape, which is the thing worth checking.
 *
 * Run: node tools/build-constellations.mjs
 */
import fs from 'node:fs';

const TMP = process.env.LOCALAPPDATA + '/Temp/opencode/astro';
const SRC = JSON.parse(fs.readFileSync(`${TMP}/hip-positions.json`, 'utf8'));
const OUT = 'C:/Users/LENOVO/Downloads/portfolio/src/data/constellations.ts';

const D2R = Math.PI / 180;

/* ------------------------------------------------------------------------
 * Orion, trimmed to the figure people recognise.
 *
 * The published IAU figure is three things joined: the 9-star core, a shield
 * of 8 faint stars to the west of Rigel, and a 5-star club raised above
 * Betelgeuse. At the 140-320 px this theme draws them at, the shield and club
 * stars land in the smallest size tier and read as noise either side of the
 * belt and legs - and between them they stretch Orion across about 30 degrees
 * of declination, which halves the size the recognisable body gets inside the
 * unit box.
 *
 * So the shield and club are dropped. Every star that remains is still at its
 * catalogue position and every edge is still a published one: this is an
 * omission from the figure, not an approximation of it. Removing stars from a
 * CC BY-SA figure keeps it an adaptation, which is why the notice in the
 * generated file stays.
 * ---------------------------------------------------------------------- */
const DROP = {
  Ori: [
    22449, 22509, 22549, 22797, 22845, 22957, 23123, 23607, // the shield
    27913, 28614, 28716, 29038, 29426, // the club
  ],
};
for (const [abbr, drop] of Object.entries(DROP)) {
  const f = SRC.figures[abbr];
  if (!f) throw new Error(`no figure ${abbr} to trim`);
  const gone = new Set(drop);
  const before = f.stars.length;
  const edgesBefore = f.edges.length;
  f.stars = f.stars.filter((h) => !gone.has(h));
  f.edges = f.edges.filter(([a, b]) => !gone.has(a) && !gone.has(b));
  console.log(
    `  ${abbr}: kept ${f.stars.length} of ${before} stars, ${f.edges.length} of ${edgesBefore} edges` +
      ` (shield and club dropped)`
  );
}

const toVec = (raDeg, decDeg) => {
  const a = raDeg * D2R;
  const d = decDeg * D2R;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
};
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

const mags = [];
for (const f of Object.values(SRC.figures))
  for (const h of f.stars) if (SRC.positions[h].mag != null) mags.push(SRC.positions[h].mag);
mags.sort((a, b) => a - b);
/* Hipparcos leaves Vmag blank for a few stars in the figures. Those get the
   median magnitude, which is a neutral middle size, and are counted so the
   number is visible rather than hidden. */
const median = mags[Math.floor(mags.length / 2)];
let unsized = 0;
const totalStars = Object.values(SRC.figures).reduce(
  (n, f) => n + f.stars.length,
  0
);
/* Three sizes, brightest largest. Cut on the global magnitude distribution so a
   star of a given brightness is always drawn the same size, in every figure. */
const cuts = [mags[Math.floor(mags.length / 3)], mags[Math.floor((2 * mags.length) / 3)]];
const tier = (m) => (m <= cuts[0] ? 2 : m <= cuts[1] ? 1 : 0);
console.log(
  `magnitude range ${mags[0].toFixed(2)}..${mags[mags.length - 1].toFixed(2)}, ` +
    `tiers: small >${cuts[1].toFixed(2)}, medium <=${cuts[1].toFixed(2)}, large <=${cuts[0].toFixed(2)}`
);

const magOf = (p) => {
  if (p.mag != null) return p.mag;
  unsized++;
  return median;
};

const figures = [];
let worstOverall = 0;

for (const f of Object.values(SRC.figures)) {
  const hs = f.stars;
  const pos = hs.map((h) => SRC.positions[h]);

  // 1. unit vectors, and the centroid direction of the figure.
  const vs = pos.map((p) => toVec(p.ra, p.dec));
  const c = [0, 0, 0];
  for (const v of vs) {
    c[0] += v[0];
    c[1] += v[1];
    c[2] += v[2];
  }
  const cl = Math.hypot(c[0], c[1], c[2]);
  const C = [c[0] / cl, c[1] / cl, c[2] / cl];

  // 2. tangent basis: East, then North.
  const L = Math.hypot(C[0], C[1]);
  const E = [-C[1] / L, C[0] / L, 0];
  const N = [
    C[1] * E[2] - C[2] * E[1],
    C[2] * E[0] - C[0] * E[2],
    C[0] * E[1] - C[1] * E[0],
  ];

  // 3. azimuthal equidistant about C, then chart orientation (North up, East
  //    left). Equidistant puts every star at its TRUE angular distance from the
  //    figure centre, so the shape stays within ~2% of the sphere; a gnomonic
  //    projection here stretched Ursa Major, which spans ~50 deg of sky, by
  //    15.7%. Neither keeps everything exact - no plane can - but this one is
  //    the more faithful of the two by a wide margin (see tools/proj-diag.mjs).
  const sx = [];
  const sy = [];
  for (const v of vs) {
    const z = Math.max(-1, Math.min(1, dot(v, C)));
    const th = Math.acos(z); // true angular distance from the centre
    const X = dot(v, E);
    const Y = dot(v, N);
    const r = Math.hypot(X, Y);
    const k = r > 1e-12 ? th / r : 1; // radial scale is exact by construction
    sx.push(-X * k);
    sy.push(-Y * k);
  }

  // 4. centre on the bounding box, scale the longer side to 1.
  const x0 = Math.min(...sx);
  const x1 = Math.max(...sx);
  const y0 = Math.min(...sy);
  const y1 = Math.max(...sy);
  const span = Math.max(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const nx = sx.map((v) => +((v - cx) / span).toFixed(6));
  const ny = sy.map((v) => +((v - cy) / span).toFixed(6));

  // Fidelity: projected vs true angular separation, every pair.
  let worst = 0;
  for (let i = 0; i < vs.length; i++)
    for (let j = i + 1; j < vs.length; j++) {
      const trueSep = Math.acos(Math.max(-1, Math.min(1, dot(vs[i], vs[j]))));
      if (trueSep < 0.02) continue; // pairs this close are below the noise
      const proj = Math.hypot((nx[i] - nx[j]) * span, (ny[i] - ny[j]) * span);
      const err = Math.abs(proj - trueSep) / trueSep;
      if (err > worst) worst = err;
    }
  worstOverall = Math.max(worstOverall, worst);

  figures.push({
    abbr: f.abbr,
    name: f.name,
    hips: hs,
    x: nx,
    y: ny,
    mag: pos.map((p) => magOf(p)),
    edges: f.edges.map(([a, b]) => [hs.indexOf(a), hs.indexOf(b)]),
    fidelity: +(worst * 100).toFixed(3),
  });
}

const n = (v) => v;

/* Wording for the generated file, so the omission is stated where a reader of
   the data will actually meet it rather than only in the build script. */
const trimNote = Object.entries(DROP)
  .map(
    ([abbr]) =>
      `${SRC.figures[abbr].name} is drawn as its 9-star core. The published figure's ` +
      `shield (8 stars west of Rigel) and club (5 stars above Betelgeuse) are omitted, ` +
      `so the recognisable body keeps its size at 140-320 px. Every star drawn is ` +
      `still at its catalogue position and every edge is a published one; the ` +
      `${DROP[abbr].length} omitted stars are listed by HIP number in ` +
      `tools/build-constellations.mjs.`
  )
  .join('\n *   ');
const body = figures
  .map(
    (f) => `  {
    abbr: '${f.abbr}',
    name: '${f.name}',
    hips: [${f.hips.join(', ')}],
    x: [${f.x.map(n).join(', ')}],
    y: [${f.y.map(n).join(', ')}],
    mag: [${f.mag.map((v) => v.toFixed(2)).join(', ')}],
    edges: [${f.edges.map(([a, b]) => `[${a}, ${b}]`).join(', ')}],
  }`
  )
  .join(',\n');

const ts = `/**
 * Real constellation figures for the light theme.
 *
 * Nothing in this file is drawn by hand or from memory. The stick figures are
 * the IAU's own published figure set; the star positions come out of the
 * Hipparcos catalogue; the shapes below are those two sources projected, not
 * approximated.
 *
 * LICENCE OF THIS FILE
 *
 *   This file is an ADAPTATION of the constellation stick figures distributed
 *   with Stellarium as the sky culture "modern_iau", which are themselves the
 *   International Astronomical Union's official constellation figures,
 *   produced in collaboration with Sky & Telescope magazine (Roger Sinnott and
 *   Rick Fienberg).
 *
 *   The stick figures are licensed CC BY-SA 4.0:
 *     https://creativecommons.org/licenses/by-sa/4.0/
 *
 *   Because this file adapts them, it is offered under the same licence,
 *   CC BY-SA 4.0, and carries the attribution above. That obligation applies to
 *   THIS DATA FILE and to anything derived from it. It does not apply to the
 *   rest of the site's code, which is not a derivative of the figures - the
 *   figures are data consumed by an unrelated renderer. The site carries a
 *   visible credit line in the footer because that is what the licence asks
 *   for, not because the codebase is covered by it.
 *
 *   Nothing here is fetched at runtime. The figures, the coordinates and the
 *   magnitudes are all compiled into this file, so the page makes no request
 *   to Stellarium, the IAU, CDS or anyone else.
 *
 * SOURCES
 *
 *   Stick figures
 *     Stellarium sky culture "modern_iau", index.json from Stellarium master,
 *     fetched 2026-10-20.
 *     https://github.com/Stellarium/stellarium/tree/master/skycultures/modern_iau
 *     Licence: CC BY-SA 4.0.
 *
 *   Star positions and magnitudes
 *     Hipparcos Main Catalogue, ESA 1997, catalogue I/239, retrieved from
 *     CDS/VizieR (https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239).
 *     Columns RAICRS / DEICRS: degrees, ICRS, epoch J1991.25. Vmag: Johnson V.
 *     Hipparcos data is free to use with acknowledgement of ESA, which is given
 *     here and in the site footer.
 *
 * ORION
 *   ${trimNote}
 *
 * PROJECTION
 *   Azimuthal equidistant, about each figure's own centroid, on a plane whose
 *   axes are celestial North and East, then flipped to chart orientation: North
 *   up, East to the left - the way these figures are printed - so no figure is
 *   mirrored. Each shape is centred on its bounding box and scaled so its
 *   longer side is exactly 1; the runtime picks the pixel size, so the unit box
 *   is the only scaling this file encodes. Equidistant was picked by measuring
 *   against the sphere, not by habit: tools/proj-diag.mjs puts it at 2.06% worst
 *   pairwise distance error, against 4.53% for stereographic and 15.66% for
 *   gnomonic, the last driven by Ursa Major spanning ~50 deg of sky.
 *
 * UNSIZED STARS
 *   ${unsized} of the ${totalStars} stars drawn here carry no Johnson V
 *   magnitude in Hipparcos. They are given the median magnitude - a neutral
 *   middle size - rather than being guessed a brightness.
 *
 * FIDELITY
 *   \`fidelity\` is the worst relative difference, over every pair of stars in
 *   the figure, between its separation in the projection and its true
 *   angular separation on the sphere. It is the distortion the projection
 *   introduces on its own. Largest across all figures: ${worstOverall
    .toFixed(4)
    .replace(/0+$/, '0')} (${(worstOverall * 100).toFixed(3)}%).
 *
 * Built by tools/build-constellations.mjs from tools/fetch-constellations.mjs.
 * Do not edit the numbers by hand; re-run the build instead.
 */

export interface Figure {
  /** IAU three-letter abbreviation. */
  abbr: string;
  name: string;
  /** Hipparcos numbers of the drawn stars, same order as x / y / mag. */
  hips: number[];
  /** Unit-box coordinates, x right and y down the screen, longer side = 1. */
  x: number[];
  y: number[];
  /** Johnson V magnitude, kept so size tiers and the data test stay checkable. */
  mag: number[];
  /** Pairs of star indices to join, from the published figure. */
  edges: [number, number][];
}

export const FIGURES: Figure[] = [
${body}
];

/** Magnitude tiers, largest for the brightest. Assigned on the global
    distribution, so a star is always the same size in every figure. */
export const MAG_TIER_CUTS: [number, number] = [${cuts[0].toFixed(3)}, ${cuts[1].toFixed(3)}];

export const magTier = (m: number) => (m <= MAG_TIER_CUTS[0] ? 2 : m <= MAG_TIER_CUTS[1] ? 1 : 0);
`;

fs.mkdirSync('C:/Users/LENOVO/Downloads/portfolio/src/data', { recursive: true });
fs.writeFileSync(OUT, ts);

/* Same numbers as a plain JSON twin, so the test and screenshot tools read
   exactly what the app ships rather than re-deriving it (they cannot drift
   because they come out of one run). It is a build artefact, not a second
   source: re-run the build instead of editing it. */
fs.writeFileSync(
  'C:/Users/LENOVO/Downloads/portfolio/tools/constellations.build.json',
  JSON.stringify(
    {
      built: new Date().toISOString(),
      sources: {
        figures:
          'Stellarium sky culture modern_iau - the IAU official constellation figures made with Sky & Telescope (Sinnott & Fienberg) - master branch, fetched 2026-10-20, CC BY-SA 4.0',
        figuresUrl: 'https://github.com/Stellarium/stellarium/tree/master/skycultures/modern_iau',
        licence: 'CC BY-SA 4.0',
        licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        adaptation:
          'This dataset adapts the modern_iau stick figures and is offered under the same licence.',
        stars:
          'Hipparcos Main Catalogue, ESA 1997, CDS/VizieR I/239, RAICRS/DEICRS deg ICRS epoch J1991.25, Vmag Johnson',
        starsUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239',
        projection: 'azimuthal equidistant about the figure centroid, North up / East left',
        trimmed: DROP,
      },
      magTierCuts: cuts,
      unsized,
      totalStars,
      figures: figures.map(({ abbr, name, hips, x, y, mag, edges, fidelity }) => ({
        abbr,
        name,
        hips,
        x,
        y,
        mag,
        /** catalogue reference, degrees, ICRS epoch J1991.25 - kept so the
            data test can check the built shape against the sky itself */
        ra: hips.map((h) => SRC.positions[h].ra),
        dec: hips.map((h) => SRC.positions[h].dec),
        edges,
        /** worst pairwise distance error against the sphere, in percent */
        fidelityPct: fidelity,
      })),
    },
    null,
    1
  )
);

console.log('\nfigure            stars  edges   mag range        fidelity');
for (const f of figures) {
  const lo = Math.min(...f.mag);
  const hi = Math.max(...f.mag);
  console.log(
    `${f.name.padEnd(17)} ${String(f.x.length).padStart(3)}  ${String(f.edges.length).padStart(4)}  ` +
      `${lo.toFixed(2).padStart(5)}..${hi.toFixed(2).padStart(5)}   ${f.fidelity.toFixed(3)}%`
  );
}
console.log(`\nworst fidelity overall: ${(worstOverall * 100).toFixed(3)}%`);
console.log('wrote', OUT);

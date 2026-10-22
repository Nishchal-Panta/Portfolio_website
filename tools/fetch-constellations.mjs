/**
 * Builds the constellation dataset from two sources, and records both.
 *
 *   Stick figures  : Stellarium sky culture "modern_iau" (CC BY-SA 4.0), which
 *                    is the IAU's official figure set drawn with Sky &
 *                    Telescope (Roger Sinnott and Rick Fienberg) and published
 *                    on the IAU website. Stellarium master, index.json fetched
 *                    2026-10-20.
 *   Star positions : Hipparcos Main Catalogue, ESA 1997, catalogue I/239,
 *                    retrieved from CDS/VizieR. Columns RAICRS/DEICRS are
 *                    degrees, ICRS, epoch J1991.25.
 *
 * Nothing here is drawn from memory. The figure lines are the published ones
 * and the coordinates come out of the catalogue, so the shapes can be checked
 * against the reference sheet rather than against my recollection of them.
 *
 * Run: node tools/fetch-constellations.mjs
 */
import fs from 'node:fs';

const TMP = process.env.LOCALAPPDATA + '/Temp/opencode/astro';
const INDEX = `${TMP}/iau-index.json`;
const OUT = `${TMP}/hip-positions.json`;

/* The 14 requested. Abbreviations are the IAU three-letter codes. */
const TARGETS = {
  Ori: 'Orion',
  UMa: 'Ursa Major',
  UMi: 'Ursa Minor',
  Cas: 'Cassiopeia',
  Cyg: 'Cygnus',
  Lyr: 'Lyra',
  Sco: 'Scorpius',
  Leo: 'Leo',
  Gem: 'Gemini',
  Tau: 'Taurus',
  Aql: 'Aquila',
  Per: 'Perseus',
  CMa: 'Canis Major',
  Sgr: 'Sagittarius',
};

const raw = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const byAbbr = new Map();
for (const c of raw.constellations) {
  const m = /^CON\s+\S+\s+(\S+)$/.exec(c.id);
  if (m) byAbbr.set(m[1], c);
}

const missing = Object.keys(TARGETS).filter((a) => !byAbbr.has(a));
if (missing.length) throw new Error(`missing from sky culture: ${missing.join(', ')}`);

/** Polylines -> unique undirected edges. A polyline that doubles back on
    itself (the IAU figures do) yields a zero-length segment, dropped. */
const figures = {};
const hips = new Set();
for (const [abbr, name] of Object.entries(TARGETS)) {
  const c = byAbbr.get(abbr);
  const edges = [];
  const seen = new Set();
  for (const poly of c.lines) {
    for (const hip of poly) hips.add(hip);
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1];
      const b = poly[i];
      if (a === b) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([a, b]);
    }
  }
  figures[abbr] = { abbr, name, stars: [...new Set(c.lines.flat())], edges };
}

const list = [...hips];
console.log(
  `${Object.keys(figures).length} figures, ${list.length} unique stars, ` +
    `${Object.values(figures).reduce((n, f) => n + f.edges.length, 0)} edges`
);

/* Catalogue lookup in batches, so the query string stays a sane length. */
const BATCH = 90;
const positions = {};
for (let i = 0; i < list.length; i += BATCH) {
  const batch = list.slice(i, i + BATCH);
  const url =
    'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=I/239/hip_main' +
    `&HIP=${batch.join(',')}&-out=HIP,RAhms,DEdms,RAICRS,DEICRS,Vmag&-out.max=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`VizieR ${res.status} for batch ${i / BATCH}`);
  const text = await res.text();
  let rows = 0;
  /* Split on TABS, not whitespace. RAhms / DEdms are themselves space
     separated ("11 18 11.24"), and Hipparcos leaves RAICRS / DEICRS blank for
     some entries - HIP 55203 is one - so splitting on whitespace slid the
     columns and silently gave that star a position near (3.79, 0). */
  for (const line of text.split('\n')) {
    const f = line.split('\t').map((s) => s.trim());
    if (f.length < 6 || !/^\d+$/.test(f[0])) continue;
    const [hip, rahms, dedms, raicrs, decicrs, vmag] = f;
    // Prefer the degrees columns; fall back to parsing the h m s / d m s pair.
    // Number('') is 0, not NaN, so an empty field has to be treated as missing
    // explicitly or a blank RAICRS becomes a star at the origin.
    let ra = raicrs === '' ? NaN : Number(raicrs);
    let dec = decicrs === '' ? NaN : Number(decicrs);
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) {
      const a = /^(\d+)\s+(\d+)\s+([\d.]+)$/.exec(rahms);
      const b = /^([+-]?)(\d+)\s+(\d+)\s+([\d.]+)$/.exec(dedms);
      if (!a || !b) continue;
      ra = (Number(a[1]) + Number(a[2]) / 60 + Number(a[3]) / 3600) * 15;
      dec =
        (Number(b[2]) + Number(b[3]) / 60 + Number(b[4]) / 3600) * (b[1] === '-' ? -1 : 1);
    }
    if (!Number.isFinite(ra) || !Number.isFinite(dec) || Math.abs(dec) > 90) continue;
    positions[hip] = {
      ra: +ra.toFixed(8),
      dec: +dec.toFixed(8),
      mag: vmag === '' ? null : Number(vmag),
    };
    rows++;
  }
  console.log(`  batch ${i / BATCH + 1}: ${rows} stars`);
  await new Promise((r) => setTimeout(r, 350));
}

const missingStars = list.filter((h) => !positions[h]);
console.log(`resolved ${Object.keys(positions).length}/${list.length}`);
if (missingStars.length) console.log('missing HIP:', missingStars.slice(0, 20).join(', '));

/* Fail loudly rather than ship a star that never got a coordinate. */
const bad = list.filter((h) => {
  const p = positions[h];
  return !p || !Number.isFinite(p.ra) || !Number.isFinite(p.dec) || Math.abs(p.dec) > 90;
});
if (bad.length) throw new Error(`no usable position for HIP ${bad.join(', ')}`);

fs.writeFileSync(OUT, JSON.stringify({ figures, positions }, null, 0));
console.log('wrote', OUT);

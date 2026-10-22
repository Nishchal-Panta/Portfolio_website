/**
 * Reference sheet: every constellation at rest, named, at a fixed size.
 *
 * This is the thing to hold up against a printed star chart. The figures are
 * drawn North up / East left (the card says so) with star size by magnitude
 * tier and edges from the published IAU figure. Stars are solid here so the
 * shape is easy to judge - the light theme draws them at ~37% ink instead.
 *
 * Run: node tools/reference-sheet.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const SHOTS = process.env.LOCALAPPDATA + '/Temp/opencode/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const data = JSON.parse(
  fs.readFileSync('C:/Users/LENOVO/Downloads/portfolio/tools/constellations.build.json', 'utf8')
);

const CARD = 268; // px, also the SVG box
const R_PX = [2.4, 3.6, 5.2]; // small / medium / large
const tierOf = (m) =>
  m <= data.magTierCuts[0] ? 2 : m <= data.magTierCuts[1] ? 1 : 0;

function svgFor(f) {
  const pts = f.x.map((x, i) => ({ x, y: f.y[i], m: f.mag[i] }));
  const lines = f.edges
    .map(
      ([a, b]) =>
        `<line x1="${pts[a].x}" y1="${pts[a].y}" x2="${pts[b].x}" y2="${pts[b].y}"
               stroke="#6b7d9e" stroke-width="1.15" vector-effect="non-scaling-stroke"/>`
    )
    .join('');
  const stars = pts
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="${R_PX[tierOf(p.m)] / CARD}" fill="#141a24"/>`
    )
    .join('');
  return `<svg width="${CARD}" height="${CARD}" viewBox="-0.5 -0.5 1 1"
              style="overflow:visible">${lines}${stars}</svg>`;
}

const cards = data.figures
  .map(
    (f) => `
    <figure class="card">
      <div class="art">${svgFor(f)}</div>
      <figcaption>
        <b>${f.name}</b><span>${f.abbr}</span>
        <em>${f.x.length} stars · ${f.edges.length} edges · fidelity ${f.fidelityPct.toFixed(
      2
    )}%</em>
      </figcaption>
    </figure>`
  )
  .join('');

const html = `<!doctype html><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 26px 30px 34px; width: 1240px;
    background: #f6f4ef; color: #141a24;
    font: 13px/1.45 ui-sans-serif, system-ui, "Segoe UI", sans-serif;
  }
  h1 { font-size: 19px; margin: 0 0 4px; letter-spacing: -0.01em; font-weight: 640; }
  .meta { font-size: 11.5px; color: #5d6470; margin: 0 0 20px; max-width: 1000px; }
  .grid { display: grid; grid-template-columns: repeat(4, 286px); gap: 18px; }
  .card {
    margin: 0; width: 286px; padding: 9px 9px 10px;
    background: #fff; border: 1px solid #e2ded4; border-radius: 4px;
  }
  .art { width: ${CARD}px; height: ${CARD}px; position: relative; }
  .art::after {
    content: "N\\2191  E\\2190"; position: absolute; right: 2px; bottom: 0;
    font-size: 9.5px; color: #9aa2af; letter-spacing: .04em;
  }
  figcaption { display: flex; align-items: baseline; gap: 7px; margin-top: 7px; }
  figcaption b { font-size: 13.5px; font-weight: 620; }
  figcaption span { font-size: 11px; color: #7b8494; }
  figcaption em { font-size: 10px; color: #98a0ad; font-style: normal; margin-left: auto; }
</style>
<h1>Constellation figures — reference sheet</h1>
<p class="meta">
  Hipparcos (ESA 1997, CDS/VizieR I/239) positions · IAU figures made with Sky &amp; Telescope,
  via Stellarium <code>modern_iau</code> (CC BY-SA 4.0) · azimuthal equidistant about each
  figure's centroid · chart orientation, North up and East to the left, so nothing is mirrored ·
  unit box scaled to ${CARD}px · star size by magnitude tier.
  ${data.totalStars} stars drawn, ${data.unsized} with no catalogue V magnitude.
</p>
<div class="grid">${cards}</div>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1240, height: 1200 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(250);
const out = `${SHOTS}/constellations-reference.png`;
await page.screenshot({ path: out, fullPage: true });
await browser.close();

const h = await fs.promises.stat(out);
console.log(`wrote ${out} (${h.size} bytes), ${data.figures.length} figures`);

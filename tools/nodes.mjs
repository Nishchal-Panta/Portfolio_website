/**
 * Where the light constellation actually is, and how bright each node is.
 *
 * The full-resolution crop of the band under the lede came back empty, so this
 * asks directly: how many nodes fall in that band, what alpha would each be
 * painted at, and where the constellation is concentrated instead.
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const URL = `${BASE}?debug=1`;
const b = await chromium.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  document.dispatchEvent(new Event('themechange'));
});
await p.waitForTimeout(1800);

const report = await p.evaluate(() => {
  const F = window.__field || {};
  const pos = window.__fieldParticles || [];
  const boxes = window.__textBoxes || [];
  const region = { x0: 220, y0: 620, x1: 980, y1: 880 };

  // Unfiltered: where the missing nodes actually are matters more than where
  // the visible ones are.
  const yBins = new Array(12).fill(0); // -170..1070 in 100px steps, offset
  const xBins = new Array(14).fill(0);
  let yMin = Infinity, yMax = -Infinity, xMin = Infinity, xMax = -Infinity;
  let inRegion = 0;
  let onScreen = 0;
  const rows = new Array(9).fill(0);
  for (const [x, y] of pos) {
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    const yi = Math.floor((y + 170) / 100);
    if (yi >= 0 && yi < 12) yBins[yi]++;
    const xi = Math.floor(x / 100);
    if (xi >= 0 && xi < 14) xBins[xi]++;
    if (y >= 0 && y <= 900 && x >= 0 && x <= 1440) {
      onScreen++;
      rows[Math.min(8, Math.floor(y / 100))]++;
      if (x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1) inRegion++;
    }
  }

  return {
    total: pos.length,
    onScreen,
    inRegion,
    yRange: [+yMin.toFixed(1), +yMax.toFixed(1)],
    xRange: [+xMin.toFixed(1), +xMax.toFixed(1)],
    yBins100_from_minus170: yBins,
    xBins100: xBins,
    rowsPer100px: rows,
    links: F.links,
    orphans: F.orphans,
    mix: F.mix,
    boxes: boxes.map((b) => [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]),
  };
});

console.log(JSON.stringify(report, null, 2));

// Alpha actually painted: count non-paper pixels of the field canvas in bands.
const painted = await p.evaluate(() => {
  const c = document.getElementById('motes');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const dpr = c.width / parseFloat(getComputedStyle(c).width);
  const bands = [
    ['y 0-300', 0, 300],
    ['y 300-600', 300, 600],
    ['y 600-900', 600, 900],
  ];
  const out = {};
  for (const [name, y0, y1] of bands) {
    let n = 0;
    let sum = 0;
    for (let y = y0 * dpr; y < y1 * dpr; y++) {
      for (let x = 0; x < c.width; x++) {
        const a = d[(Math.floor(y) * c.width + Math.floor(x)) * 4 + 3];
        if (a > 3) {
          n++;
          sum += a;
        }
      }
    }
    out[name] = { lit: n, meanAlpha: n ? +(sum / n).toFixed(1) : 0 };
  }
  return out;
});
console.log('painted by band:', JSON.stringify(painted, null, 2));

await b.close();

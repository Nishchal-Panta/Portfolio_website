/**
 * Where the constellation sits, per scroll step.
 *
 * The first-frame reshuffle bug parked 81 nodes off-screen and confined the
 * rest to the top 450px, and no assertion caught it. This prints the grid
 * spread, the row/column balance and the hub count at each scroll step so a
 * distribution assertion can be written against numbers actually observed
 * rather than invented.
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const URL = `${BASE}?debug=1`;
const STEPS = [0, 600, 1200, 2400];

const b = await chromium.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  document.dispatchEvent(new Event('themechange'));
});
await p.waitForTimeout(1500);

const read = () =>
  p.evaluate(() => {
    const pts = window.__fieldParticles || [];
    const F = window.__field || {};
    const CX = 10;
    const CY = 7;
    const grid = new Array(CX * CY).fill(0);
    const rows = new Array(CY).fill(0);
    const cols = new Array(CX).fill(0);
    let on = 0;
    let off = 0;
    for (const [x, y] of pts) {
      if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) {
        off++;
        continue;
      }
      on++;
      const cx = Math.min(CX - 1, Math.max(0, Math.floor((x / innerWidth) * CX)));
      const cy = Math.min(CY - 1, Math.max(0, Math.floor((y / innerHeight) * CY)));
      grid[cy * CX + cx]++;
      rows[cy]++;
      cols[cx]++;
    }
    const filled = grid.filter((v) => v > 0).length;
    return {
      on,
      off,
      filled,
      cells: CX * CY,
      pct: +((100 * filled) / (CX * CY)).toFixed(0),
      maxRow: Math.max(...rows),
      maxCol: Math.max(...cols),
      perRow: +(on / CY).toFixed(1),
      perCol: +(on / CX).toFixed(1),
      rows,
      links: F.links,
      born: F.born,
      nodes: F.nodes,
    };
  });

for (const y of STEPS) {
  await p.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
  await p.waitForTimeout(750);
  const r = await read();
  console.log(
    `@${String(y).padStart(4)}px  on=${String(r.on).padStart(3)} off=${String(r.off).padStart(3)}` +
      `  cells=${r.filled}/${r.cells} (${r.pct}%)  maxRow=${r.maxRow} vs avg ${r.perRow}` +
      `  maxCol=${r.maxCol} vs avg ${r.perCol}  links=${r.links} born=${r.born} nodes=${r.nodes}`
  );
  console.log(`        rows [${r.rows.join(', ')}]`);
}

await b.close();

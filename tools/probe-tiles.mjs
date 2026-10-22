/**
 * Per-tile geometry: is every name in a row on the same baseline, and how much
 * of each row is empty at rest?
 *
 *   node tools/probe-tiles.mjs [plate-id]
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';

const ONLY = process.argv[2];
const BASE = await baseUrl();

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  const el = document.querySelector('#skills-movement');
  window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: 'instant' });
});
await page.waitForTimeout(1200);

const rows = await page.evaluate((only) => {
  const out = [];
  for (const plate of document.querySelectorAll('.plate')) {
    if (only && plate.id !== `plate-${only}`) continue;
    const items = [...plate.querySelectorAll('.tile')];
    // offsetTop is the grid row position, so tiles in one row share it even
    // when their boxes have drifted apart - which is the thing being checked.
    const groups = new Map();
    for (const t of items) {
      const key = t.offsetTop;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    const plateTop = plate.getBoundingClientRect().top;
    for (const [top, tiles] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      const first = tiles[0].getBoundingClientRect();
      out.push({
        plate: plate.id.replace('plate-', ''),
        rowTop: Math.round(first.top - plateTop),
        cells: tiles.map((t) => {
          const name = t.querySelector('.tile__name');
          const slot = t.querySelector('.tile__slot');
          const ctx = t.querySelector('.tile__context');
          const glyph = t.querySelector('svg');
          const tr = t.getBoundingClientRect();
          const nr = name.getBoundingClientRect();
          const sr = slot.getBoundingClientRect();
          return {
            name: name.textContent.trim().slice(0, 26),
            mark: t.querySelector('[data-mark]')?.dataset.mark ?? '-',
            tileH: Math.round(tr.height),
            slotH: +(sr.height).toFixed(1),
            glyphH: glyph ? +glyph.getBoundingClientRect().height.toFixed(1) : 0,
            // name top relative to the tile top: the number that must match
            nameOffset: +(nr.top - tr.top).toFixed(1),
            ctxLines: ctx ? Math.round(ctx.getBoundingClientRect().height / 17) : 0,
            ink: Math.round(
              (name.getBoundingClientRect().height || 0) +
              (ctx ? ctx.getBoundingClientRect().height : 0) +
              (glyph ? glyph.getBoundingClientRect().height : 0)
            ),
          };
        }),
      });
    }
  }
  return out;
}, ONLY);

let bad = 0;
for (const row of rows) {
  const offs = row.cells.map((c) => c.nameOffset);
  const spread = Math.max(...offs) - Math.min(...offs);
  const flag = spread > 0.6 ? '  <-- BASELINES DIFFER' : '';
  if (spread > 0.6) bad++;
  const ink = Math.max(...row.cells.map((c) => c.ink));
  console.log(
    `\n${row.plate} row @${row.rowTop}  height ${row.cells[0].tileH}px  ` +
      `ink ${ink}px  void ${row.cells[0].tileH - ink}px${flag}`
  );
  for (const c of row.cells) {
    console.log(
      `   ${c.name.padEnd(27)} mark=${c.mark.padEnd(13)} slot=${c.slotH}` +
        ` glyph=${c.glyphH} nameOffset=${c.nameOffset} ctx=${c.ctxLines}L`
    );
  }
}
console.log(`\nrows with mismatched baselines: ${bad}`);
await browser.close();

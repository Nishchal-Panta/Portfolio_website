/**
 * The step, captured at the browser's frame rate.
 *
 * The brief asks for twelve frames 50ms apart through a single step.
 * Screenshotting the element cannot do that: one element.screenshot() takes
 * longer than the whole 500ms step, so the very first frame already shows the
 * end state and the sheet proves nothing about the slide.
 *
 * CDP screencast sidesteps it - the browser composites and streams frames on
 * its own clock, and this just collects them. Twelve frames at ~50ms are
 * selected afterwards by nearest-timestamp.
 *
 * What it is for: seeing whether the outgoing photograph leaves to the left
 * while the other two slide into place and the next one enters from the
 * right, and whether a gap, a stretch, a fourth photograph in the flow or a
 * row that changes height ever appears.
 *
 *   node tools/transition-sheet.mjs --base http://localhost:4322/
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const OUT = `${process.env.LOCALAPPDATA}/Temp/opencode/shots`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() =>
  document.querySelector('#album')?.scrollIntoView({ behavior: 'instant', block: 'center' })
);
await page.mouse.move(4, 4);
await page.waitForTimeout(1200);

// Where the row sits, so the screencast can be cropped to it afterwards.
const box = await page.locator('[data-album-row]').boundingBox();

// Held by hovering the album - that is the pause now, there is no button -
// so the only thing moving in the capture is the step we ask for. The
// pointer stays over the album for the whole capture.
await page.locator('[data-album-stage]').hover({ position: { x: 20, y: 20 } });
await page.waitForTimeout(1200);

const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ data: f.data, ts: f.metadata.timestamp * 1000 });
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', {
  format: 'png',
  everyNthFrame: 1,
  maxWidth: 1280,
  maxHeight: 900,
});

await page.waitForTimeout(200);
const t0 = Date.now();
await page.locator('[data-album-next]').click();
await page.waitForTimeout(1200);
await cdp.send('Page.stopScreencast');

const geometry = await page.evaluate(() => {
  const row = document.querySelector('[data-album-row]');
  const figs = [...row.querySelectorAll('.album__figure')].filter(
    (f) => !f.hidden && !f.classList.contains('is-leaving')
  );
  return { rowH: Math.round(row.getBoundingClientRect().height), n: figs.length };
});
await browser.close();

if (frames.length < 4) {
  console.log(`only ${frames.length} screencast frames; nothing to sheet`);
  process.exit(0);
}

// Twelve frames evenly spread across the capture, which begins just before
// the click and runs past the end of the 500ms step - 50ms apart, which is
// the interval the brief asks for.
const START = 100; // ms after the click - just before the first frame moves
const SPAN = 550; // 12 frames at 50ms
const chosen = [];
for (let i = 0; i < 12; i++) {
  const want = t0 - frames[0].ts + START + (SPAN * i) / 11;
  let best = frames[0];
  for (const f of frames) {
    if (Math.abs(f.ts - frames[0].ts - want) < Math.abs(best.ts - frames[0].ts - want)) best = f;
  }
  chosen.push({ ...best, ms: Math.round(best.ts - t0) });
}

/* Twelve frames in a 3 x 4 grid, left to right then down. The row is wide
   and short - about 835 x 165 - so a single line of twelve would be either
   tiny or 4000px across; at a legible height, three across keeps the sheet
   to a size that can actually be looked at. */
const COLS = 3;
const CELL_H = 140;
const gap = 8;
const LABEL_H = 22;

const cells = [];
let cellW = 0;
for (let i = 0; i < chosen.length; i++) {
  const buf = Buffer.from(chosen[i].data, 'base64');
  const meta = await sharp(buf).metadata();
  const cell = await sharp(buf)
    .extract({
      left: Math.max(0, Math.round(box.x)),
      top: Math.max(0, Math.round(box.y)),
      width: Math.min(Math.round(box.width), meta.width - Math.max(0, Math.round(box.x))),
      height: Math.min(Math.round(box.height), meta.height - Math.max(0, Math.round(box.y))),
    })
    .resize({ height: CELL_H })
    .png()
    .toBuffer();
  const m = await sharp(cell).metadata();
  cellW = m.width;
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  cells.push({ input: cell, left: gap + col * (cellW + gap), top: LABEL_H + gap + row * (CELL_H + gap) });
}

const rows = Math.ceil(chosen.length / COLS);
const sheetW = COLS * cellW + (COLS + 1) * gap;
const sheetH = LABEL_H + rows * (CELL_H + gap) + gap;

const labels = chosen.map((c, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return {
    input: Buffer.from(
      `<svg width="${cellW}" height="${LABEL_H}"><text x="4" y="16" font-family="monospace" font-size="14" fill="#111">${i} &#183; ${c.ms >= 0 ? '+' : ''}${c.ms}ms</text></svg>`
    ),
    left: gap + col * (cellW + gap),
    top: row * (CELL_H + gap),
  };
});

await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: '#ffffff' } })
  .composite([...cells, ...labels])
  .png()
  .toFile(`${OUT}/album-transition.png`);

await writeFile(
  `${OUT}/album-transition.json`,
  JSON.stringify({ chosen: chosen.map((c) => c.ms), framesAvailable: frames.length, geometry }, null, 2)
);

// Every frame, uncropped and unscaled. At 0.2x a gap in the row and a crop
// artefact of the sheet look identical, so the frames get dumped at full size
// to be looked at directly.
for (let i = 0; i < chosen.length; i++) {
  await writeFile(`${OUT}/album-frame-${String(i).padStart(2, '0')}.png`, Buffer.from(chosen[i].data, 'base64'));
}

console.log(`sheet: ${OUT}/album-transition.png  (${sheetW}x${sheetH})`);
console.log(`${frames.length} screencast frames captured, 12 selected at +${START}..+${START + SPAN}ms`);
console.log(`frame offsets (ms from the click): ${chosen.map((c) => c.ms).join(', ')}`);
console.log(`row after the swap: ${geometry.rowH}px, ${geometry.n} figures`);

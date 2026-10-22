/**
 * Inventory of the album's source photographs, and a labelled contact sheet.
 *
 * The new album is built from `assets/Carousel_photos`, and the layout needs
 * each photograph's real aspect ratio before a single trio can be chosen. The
 * sheet exists because alt text cannot be written from a filename: it is the
 * thing to look at when deciding what each photograph actually shows, and
 * which ones are not clear enough to describe without guessing.
 *
 *   node tools/album-inventory.mjs
 */
import fs from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'C:/Users/LENOVO/Downloads/portfolio/assets/Carousel_photos';
const SHOTS = process.env.LOCALAPPDATA + '/Temp/opencode/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();

const rows = [];
const tiles = [];
for (const name of files) {
  const path = join(SRC, name);
  const meta = await sharp(path).metadata();
  const bytes = fs.statSync(path).size;
  rows.push({
    name,
    w: meta.width,
    h: meta.height,
    ratio: meta.width / meta.height,
    kb: Math.round(bytes / 1024),
  });
  // 300px wide thumbnail, letterboxed into a fixed cell so the grid lines up.
  const thumb = await sharp(path)
    .resize(300, 200, { fit: 'contain', background: { r: 24, g: 24, b: 26, alpha: 1 } })
    .png()
    .toBuffer();
  tiles.push({ name, thumb });
}

for (const r of rows) {
  console.log(
    `${r.name.padEnd(26)} ${String(r.w).padStart(5)}x${String(r.h).padEnd(5)} ` +
      `ratio ${r.ratio.toFixed(3)}  ${String(r.kb).padStart(5)} KB` +
      (r.ratio < 1 ? '  portrait' : r.ratio > 1.35 ? '  landscape' : '  square-ish')
  );
}

// Contact sheet: 4 columns, cell 320x240 with the name under each thumb.
const CELL_W = 320;
const CELL_H = 236;
const COLS = 4;
const LABEL_H = 30;
const rowsN = Math.ceil(tiles.length / COLS);

const composites = [];
for (let i = 0; i < tiles.length; i++) {
  const left = (i % COLS) * CELL_W + 10;
  const top = Math.floor(i / COLS) * CELL_H + 10;
  composites.push({ input: tiles[i].thumb, left, top });
  const label = await sharp({
    create: { width: CELL_W - 20, height: LABEL_H, channels: 3, background: { r: 24, g: 24, b: 26 } },
  })
    .composite([
      {
        input: {
          create: {
            width: CELL_W - 20,
            height: LABEL_H,
            channels: 4,
            background: { r: 240, g: 238, b: 232, alpha: 1 },
          },
        },
        left: 0,
        top: 0,
      },
      {
        input: Buffer.from(
          `<svg width="${CELL_W - 20}" height="${LABEL_H}"><text x="4" y="14" font-family="monospace" font-size="12" fill="#111">${i}. ${tiles[i].name}</text><text x="4" y="28" font-family="monospace" font-size="11" fill="#444">${rows[i].w}x${rows[i].h}  ratio ${rows[i].ratio.toFixed(2)}  ${rows[i].kb}KB</text></svg>`
        ),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  composites.push({ input: label, left, top: top + 200 });
}

const out = join(SHOTS, 'album-contact-sheet.png');
await sharp({
  create: {
    width: CELL_W * COLS,
    height: CELL_H * rowsN,
    channels: 3,
    background: { r: 24, g: 24, b: 26 },
  },
})
  .composite(composites)
  .png()
  .toFile(out);

console.log(`\nwrote ${out}  (${tiles.length} photos, ${rowsN} rows)`);

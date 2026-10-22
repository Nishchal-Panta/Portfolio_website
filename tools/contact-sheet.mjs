/**
 * A contact sheet of the background: twelve frames of one theme, tiled 4x3 at
 * quarter size, so the whole behaviour of a run can be judged in one image
 * instead of opened twelve times.
 *
 * The sheet is what `tools/zoom.mjs` consumes - it assumes 360x225 tiles in
 * four columns and three rows - so the geometry here is fixed rather than
 * chosen per run. A quarter downscale loses a 0.55px star, which is why
 * `tools/crops.mjs` exists for judging brightness; this sheet is for judging
 * composition, motion and whether the field is drawing at all.
 *
 * The twelve frames are three phases of four:
 *
 *   0..3   right after a cursor sweep at y=700, 60ms apart - the wake arriving
 *   4..7   held still, 400ms apart - the wake dying down
 *   8..11  four scroll steps, 150ms apart - parallax, and in the light theme
 *          the constellations coming in and out as the strip moves
 *
 *   node tools/contact-sheet.mjs --theme dark
 *   node tools/contact-sheet.mjs --theme light --browser firefox
 */

import fs from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const SHOTS = process.env.LOCALAPPDATA + '/Temp/opencode/shots';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : dflt;
};

const THEME = opt('theme', 'dark');
const ENGINE = opt('browser', 'chrome');
/** Chromium only: hands the rasteriser over to the CPU so the software path
 *  can be looked at rather than inferred from a frame-rate number. */
const GPU_OFF = opt('gpu', 'on') === 'off';
const W = 1440;
const H = 900;
const TW = 360;
const TH = 225; // 0.25x, the geometry zoom.mjs expects
const COLS = 4;

fs.mkdirSync(SHOTS, { recursive: true });

const launcher = ENGINE === 'firefox' ? firefox : chromium;
const browser = await launcher.launch({
  headless: false,
  ...(GPU_OFF && ENGINE !== 'firefox'
    ? { args: ['--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-rasterization'] }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  colorScheme: THEME === 'dark' ? 'dark' : 'light',
});
await context.addInitScript((t) => {
  try {
    localStorage.setItem('theme', t);
  } catch (e) {
    /* private mode */
  }
}, THEME);

const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });
// Top of the page, so the phases start from the same place every run.
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(1400);

// What the rasteriser is actually doing, so a GPU-off sheet is provably one.
const raster = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl');
  if (!gl) return 'webgl unavailable';
  const d = gl.getExtension('WEBGL_debug_renderer_info');
  return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'renderer unknown';
});

const frames = [];
const legend = [];
const tmp = join(SHOTS, `_cs-${THEME}-${ENGINE}`);

/** Shutter, then keep a plain label of what was happening when it fired. */
async function take(label) {
  const file = `${tmp}-${frames.length}.png`;
  await page.screenshot({ path: file });
  frames.push(file);
  legend.push(`${String(frames.length - 1).padStart(2, ' ')}  ${label}`);
}

// --- phase 1: a sweep, then the wake while it is still fresh ---------------
for (const x of [260, 480, 700, 920, 1140, 1180]) {
  await page.mouse.move(x, 700);
}
for (let i = 0; i < 4; i++) {
  await take(`wake +${i * 60}ms after the sweep`);
  await page.waitForTimeout(60);
}

// --- phase 2: pointer parked, the field settling back ----------------------
for (let i = 0; i < 4; i++) {
  await take(`idle +${400 * (i + 1)}ms, wake decaying`);
  await page.waitForTimeout(400);
}

// --- phase 3: scroll steps, so parallax and the figures move ---------------
for (let i = 0; i < 4; i++) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), 400 * (i + 1));
  await take(`scrolled to ${400 * (i + 1)}px`);
  await page.waitForTimeout(150);
}

const tiles = [];
for (const file of frames) {
  tiles.push(await sharp(file).resize({ width: TW, height: TH, fit: 'fill' }).png().toBuffer());
  fs.unlinkSync(file);
}

const rows = Math.ceil(frames.length / COLS);
const out = join(SHOTS, `sheet-${THEME}-${ENGINE}${GPU_OFF ? '-gpuoff' : ''}.png`);
await sharp({
  create: { width: TW * COLS, height: TH * rows, channels: 3, background: '#000' },
})
  .composite(
    tiles.map((input, i) => ({
      input,
      left: (i % COLS) * TW,
      top: Math.floor(i / COLS) * TH,
    }))
  )
  .png()
  .toBuffer()
  .then((b) => fs.writeFileSync(out, b));

// A hairline grid, drawn last, so a tile boundary is never mistaken for
// something the site painted.
await sharp(out)
  .composite(
    Array.from({ length: COLS - 1 }, (_, i) => ({
      input: {
        create: { width: 1, height: TH * rows, channels: 4, background: { r: 70, g: 70, b: 70, alpha: 1 } },
      },
      left: (i + 1) * TW,
      top: 0,
    })).concat(
      Array.from({ length: rows - 1 }, (_, i) => ({
        input: {
          create: { width: TW * COLS, height: 1, channels: 4, background: { r: 70, g: 70, b: 70, alpha: 1 } },
        },
        left: 0,
        top: (i + 1) * TH,
      }))
    )
  )
  .png()
  .toFile(out + '.tmp')
  .then(() => fs.renameSync(out + '.tmp', out));

console.log(
  `${THEME} / ${ENGINE}${GPU_OFF ? ' / gpu off' : ''}  ->  ${out}\n  rasteriser: ${raster}`
);
console.log(legend.join('\n'));
console.log(errors.length ? `console: ${errors.join(' | ')}` : 'console clean');

await browser.close();

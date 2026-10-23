/**
 * SCRATCH (delete at cleanup): does any field pixel land inside a quieted box?
 *
 * The claim the box cache exists to preserve is "the field keeps out of the
 * type". Screenshots can argue it; this counts it. Every box the running field
 * published this frame is compared against the pixels the canvas actually
 * painted, and the overlaps are reported per box.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { baseUrl } from './base-url.mjs';

const OUT = process.env.OUT ?? 'C:/Users/LENOVO/AppData/Local/Temp/opencode/shots';
mkdirSync(OUT, { recursive: true });
const BASE = await baseUrl();

const browser = await chromium.launch({ headless: false, args: ['--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}?debug=1`, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
let worst = [];
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('theme', t);
  }, theme);
  await page.waitForTimeout(600);

  for (const frac of [0.0, 0.28, 0.55, 0.82, 1.0]) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), Math.round(H * frac));
    await page.waitForTimeout(1500);

    const boxes = await page.evaluate(() =>
      (window.__textBoxes || []).map((b) => ({
        left: Math.round(b.left),
        top: Math.round(b.top),
        right: Math.round(b.right),
        bottom: Math.round(b.bottom),
        kind: b.kind,
        mode: b.mode,
        drift: !!b.driftEl,
        who: b.el
          ? `${(b.el.tagName || '').toLowerCase()}${typeof b.el.className === 'string' && b.el.className.trim() ? '.' + b.el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`
          : '?',
      }))
    );

    const aPath = `${OUT}/ov-${theme}-${Math.round(frac * 100)}-on.png`;
    const bPath = `${OUT}/ov-${theme}-${Math.round(frac * 100)}-off.png`;
    await page.screenshot({ path: aPath });
    await page.evaluate(() => {
      const c = document.querySelector('#motes');
      if (c) c.style.visibility = 'hidden';
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: bPath });
    await page.evaluate(() => {
      const c = document.querySelector('#motes');
      if (c) c.style.visibility = '';
    });
    await page.waitForTimeout(250);

    const A = await sharp(aPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const B = await sharp(bPath).removeAlpha().raw().toBuffer();
    const { data, info } = A;
    const W = info.width;
    const per = new Map();
    let lit = 0;
    for (let p = 0; p < data.length; p += 3) {
      const d = Math.max(
        Math.abs(data[p] - B[p]),
        Math.abs(data[p + 1] - B[p + 1]),
        Math.abs(data[p + 2] - B[p + 2])
      );
      if (d <= 14) continue;
      lit++;
      const x = p / 3 % W;
      const y = Math.floor(p / 3 / W);
      for (const b of boxes) {
        if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
          const k = `${b.who} [${b.left},${b.top}..${b.right},${b.bottom}]`;
          per.set(k, (per.get(k) ?? 0) + 1);
          break;
        }
      }
    }
    const hits = [...per].sort((a, b2) => b2[1] - a[1]);
    const total = hits.reduce((s, h) => s + h[1], 0);
    console.log(
      `${theme} @${Math.round(frac * 100)}%  field painted ${lit}px, ${total}px inside ${hits.length} published text boxes (${boxes.length} published, ${((100 * total) / Math.max(1, lit)).toFixed(1)}% of the field)`
    );
    for (const [k, n] of hits.slice(0, 4)) console.log(`      ${n}px  ${k}`);
    worst.push({ theme, frac, total, lit, hits: hits.slice(0, 3) });
  }
}

console.log(`\nany box that took field pixels at all: ${worst.filter((w) => w.total > 0).length} of ${worst.length} frames`);
await browser.close();

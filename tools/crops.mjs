/**
 * Full-resolution crops around the cursor.
 *
 * The contact sheet is a 0.25x downscale, where a 0.55px star disappears. This
 * writes native-size crops so the brightening can be judged rather than
 * inferred, with an idle frame for comparison.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const SHOT = 'C:/Users/LENOVO/AppData/Local/Temp/opencode/shots';
const URL = `${BASE}?debug=1`;

const theme = process.argv[2] || 'dark';
const b = await chromium.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate((t) => {
  document.documentElement.setAttribute('data-theme', t);
  document.dispatchEvent(new Event('themechange'));
  const d = document.getElementById('debug-overlay');
  if (d) d.style.display = 'none';
}, theme);
await p.waitForTimeout(1500);

// Region under the lede, clear of every measured text box.
const REGION = { left: 220, top: 620, width: 760, height: 260 };
const crop = async (name) => {
  const buf = await p.screenshot();
  await sharp(buf).extract(REGION).resize({ width: 1520, kernel: 'nearest' }).png()
    .toFile(`${SHOT}/crop-${name}.png`);
};

// Idle: cursor parked off to one side, field settled.
await p.mouse.move(60, 660);
await p.waitForTimeout(2600);
await crop(`${theme}-1-idle`);

// Swept: drive through the region with the cursor inside it when captured, so
// proximity and the trailing wake are both in frame.
await p.mouse.move(60, 660);
await p.waitForTimeout(600);
for (let i = 0; i <= 16; i++) {
  await p.mouse.move(60 + i * 55, 660);
  await p.waitForTimeout(18);
}
await crop(`${theme}-2-peak`);
await p.mouse.move(60, 860);
await p.waitForTimeout(140);
await crop(`${theme}-2b-tail`);

await p.waitForTimeout(2200);
await crop(`${theme}-3-settled`);

console.log('wrote', `${SHOT}/crop-${theme}-*.png`);
await b.close();

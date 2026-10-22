import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();

const SHOT = 'C:/Users/LENOVO/AppData/Local/Temp/opencode/shots';
const b = await chromium.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(`${BASE}?debug=1`, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.dispatchEvent(new Event('themechange'));
  const d = document.getElementById('debug-overlay');
  if (d) d.style.display = 'none';
});
await p.waitForTimeout(1200);

console.log('text boxes', JSON.stringify(await p.evaluate(() => window.__textBoxes)));

// Count lit pixels so star visibility is measured, not guessed.
const lit = () => p.evaluate(() => {
  const c = document.getElementById('motes');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0, sum = 0, max = 0;
  for (let i = 3; i < d.length; i += 4) { if (d[i] > 8) { n++; sum += d[i]; if (d[i] > max) max = d[i]; } }
  return { lit: n, meanAlpha: n ? Math.round(sum / n) : 0, maxAlpha: max };
});
console.log('idle      ', JSON.stringify(await lit()));

// Sweep through the empty bottom band instead of the headline.
const frames = [];
await p.mouse.move(300, 815);
await p.waitForTimeout(900);
for (let i = 0; i < 12; i++) {
  frames.push(await p.screenshot());
  await p.mouse.move(300 + i * 82, 815 + Math.sin(i / 2) * 20);
  await p.waitForTimeout(80);
}
console.log('during    ', JSON.stringify(await lit()));

const { default: sharp } = await import('sharp');
const tiles = await Promise.all(frames.map((f) => sharp(f).extract({ left: 0, top: 620, width: 1440, height: 280 }).resize(720, 140).png().toBuffer()));
await sharp({ create: { width: 720, height: 140 * 4, channels: 3, background: '#000' } })
  .composite([0, 1, 2, 3].map((i) => ({ input: tiles[i * 3], left: 0, top: i * 140 })))
  .png().toFile(`${SHOT}/band-dark.png`);
console.log('wrote band-dark.png (frames 1,4,7,10 of the bottom band)');
await b.close();

/* Scratch: full stacks for rect/style calls, bucketed by stack shape. */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:4323/';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.mouse.move(4, 4);
await page.waitForTimeout(1200);

const out = await page.evaluate(async () => {
  const tally = new Map();
  const shape = (st) => {
    const lines = (st ?? '').split('\n').slice(1, 6).map((l) =>
      l
        .trim()
        .replace(/^at\s+/, '')
        .replace(/https?:\/\/[^/]+/g, '')
        .replace(/\?[^:]*$/, '')
    );
    return lines.join(' <- ');
  };
  const bump = (what, s) => {
    const k = `${what} | ${s}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  };

  const origRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    bump('rect', shape(new Error().stack));
    return origRect.call(this);
  };
  const origCS = window.getComputedStyle;
  window.getComputedStyle = function (...a) {
    bump('style', shape(new Error().stack));
    return origCS.apply(this, a);
  };

  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 6000));
  const elapsed = performance.now() - t0;
  Element.prototype.getBoundingClientRect = origRect;
  window.getComputedStyle = origCS;

  const media = document.querySelectorAll('img, video, canvas').length;
  const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  return {
    media,
    elapsed,
    rows: rows.slice(0, 6).map(([k, v]) => [k, v, +(v / (elapsed / 1000)).toFixed(0)]),
  };
});

console.log(`img/video/canvas in the document: ${out.media}`);
console.log(`window: ${(out.elapsed / 1000).toFixed(1)}s`);
for (const [k, v, ps] of out.rows) {
  console.log(`\n  ${v} total, ${ps}/s\n    ${k.replace(/ \| /g, '\n    ')}`);
}
await browser.close();

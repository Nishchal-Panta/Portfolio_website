/**
 * The hover contract, measured rather than eyeballed: hovering a tile must
 * lift it, reveal its context line in place, and never move anything else.
 *
 *   node tools/probe-hover.mjs [item name]
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const WANT = process.argv[2] || 'PyTorch';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  const el = document.querySelector('#skills-movement');
  window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: 'instant' });
});
await page.waitForTimeout(1200);

const read = () =>
  page.evaluate((want) => {
    const tiles = [...document.querySelectorAll('.tile')];
    const tile = tiles.find((t) => t.querySelector('.tile__name').textContent.trim() === want);
    if (!tile) return { error: `no tile named ${want}` };
    const ctx = tile.querySelector('.tile__context');
    const cs = ctx ? getComputedStyle(ctx) : null;
    const r = tile.getBoundingClientRect();
    const cr = ctx ? ctx.getBoundingClientRect() : null;
    const plate = tile.querySelector('.tile__plate');
    const before = tiles
      .filter((t) => t !== tile && Math.abs(t.getBoundingClientRect().top - r.top) < 40)
      .map((t) => ({
        name: t.querySelector('.tile__name').textContent.trim().slice(0, 20),
        top: +t.getBoundingClientRect().top.toFixed(1),
        left: +t.getBoundingClientRect().left.toFixed(1),
      }));
    return {
      name: want,
      contextText: ctx ? ctx.textContent.trim() : null,
      contextDisplay: cs?.display,
      contextOpacity: cs?.opacity,
      contextHeight: cr ? +cr.height.toFixed(1) : null,
      contextTop: cr ? +cr.top.toFixed(1) : null,
      tileTop: +r.top.toFixed(1),
      tileHeight: +r.height.toFixed(1),
      plateTranslate: getComputedStyle(plate).translate || getComputedStyle(plate).transform,
      plateBg: getComputedStyle(plate).backgroundColor,
      glyphColor: (() => {
        const g = plate.querySelector('.tile__glyph');
        return g ? getComputedStyle(g).color : null;
      })(),
      hasLink: Boolean(tile.querySelector('a')),
      neighbours: before,
    };
  }, WANT);

console.log('at rest:');
console.log(await read());

// `hasText` on the tile matches its context line as well, and the context of
// "Introduction to Deep Learning with PyTorch" contains "PyTorch" - so the
// name has to be pinned separately, and it is whitespace-padded in the markup.
const esc = WANT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const name = page.locator('.tile__name', { hasText: new RegExp(`^\\s*${esc}\\s*$`) });
const tile = page.locator('.tile').filter({ has: name }).first();
await tile.hover();
await page.waitForTimeout(400);

console.log('\non hover:');
const hov = await read();
console.log(hov);

await browser.close();

if (!hov.contextText) {
  console.log(`\nNOTE: ${WANT} has no verified context - nothing should appear.`);
} else if (String(hov.contextOpacity) !== '1') {
  console.log(`\nFAIL: context exists but opacity is ${hov.contextOpacity}`);
  process.exitCode = 1;
}

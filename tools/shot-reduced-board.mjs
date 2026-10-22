/**
 * The specimen board under prefers-reduced-motion, and with JavaScript off.
 *
 * Both are states the brief requires to stay readable - "the same plates as a
 * clean static layout" - and neither has a screenshot yet. Reduced motion is
 * driven by the browser context option; JavaScript-off is driven by blocking
 * every script before the page loads, which is also the honest test of the
 * no-JS path rather than a guess about it.
 *
 *   node tools/shot-reduced-board.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const OUT = `${process.env.LOCALAPPDATA}/Temp/opencode/shots`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false });

const shoot = async (label, { reduced, js, theme }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 2400 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    javaScriptEnabled: js,
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await page.waitForTimeout(900);

  // Scroll the board to the top of the viewport, then let the layout settle.
  await page.evaluate(() => {
    const el = document.querySelector('#skills-movement');
    if (el) {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 96,
        behavior: 'instant',
      });
    }
  });
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.tile')];
    const plates = [...document.querySelectorAll('.plate')];
    const hidden = tiles.filter((t) => parseFloat(getComputedStyle(t).opacity) < 0.5);
    const rows = tiles.map((t) => {
      const n = t.querySelector('.tile__name');
      return n ? { text: n.textContent.trim(), h: +n.getBoundingClientRect().height.toFixed(1) } : null;
    });
    const blankNames = rows.filter((r) => !r || !r.text || r.h < 4);
    return {
      tiles: tiles.length,
      plates: plates.length,
      hidden: hidden.length,
      blank: blankNames.length,
      tallestName: Math.max(...rows.filter(Boolean).map((r) => r.h)),
    };
  });

  const board = await page.$('#skills-movement');
  if (board) await board.screenshot({ path: `${OUT}/board-${label}.png` });

  console.log(
    `  ${label.padEnd(22)} ${state.tiles} tiles, ${state.plates} plates, ` +
      `${state.hidden} still faded, ${state.blank} blank names, ` +
      `tallest name ${state.tallestName}px`
  );
  await context.close();
  return state;
};

const runs = [
  ['reduced-light', { reduced: true, js: true, theme: 'light' }],
  ['reduced-dark', { reduced: true, js: true, theme: 'dark' }],
  ['nojs-light', { reduced: false, js: false, theme: 'light' }],
  ['nojs-dark', { reduced: false, js: false, theme: 'dark' }],
];

console.log('\nspecimen board in its static states');
const fails = [];
for (const [label, opts] of runs) {
  const s = await shoot(label, opts);
  if (s.tiles !== 32) fails.push(`${label}: ${s.tiles} tiles, expected 32`);
  if (s.plates !== 5) fails.push(`${label}: ${s.plates} plates, expected 5`);
  if (s.hidden) fails.push(`${label}: ${s.hidden} tile(s) still faded in`);
  if (s.blank) fails.push(`${label}: ${s.blank} tile(s) with no visible name`);
}

await browser.close();

console.log(`\n${'='.repeat(60)}`);
if (fails.length) {
  console.log(`FAILED: ${fails.length}`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('PASS: the board is complete and legible with reduced motion and without JS');
}

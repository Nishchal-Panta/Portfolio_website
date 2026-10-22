/**
 * Screenshots of the specimen board, for looking at rather than measuring.
 *
 * Every shot this produces is meant to be opened and described: a board in a
 * theme, each plate on its own, one plate with an item hovered so the context
 * line and brand colour are visible, the board after a group filter, and the
 * logo credits table.
 *
 * A tall viewport is used for the whole-board shots on purpose. The section
 * reveals as it enters the window, so fitting it means every tile has settled
 * by the time the shutter goes; a short viewport would photograph half a
 * reveal and call it the design.
 *
 *   node tools/specimen-shots.mjs --browser chrome --width desktop
 *   node tools/specimen-shots.mjs --browser firefox --width mobile --theme dark
 *   node tools/specimen-shots.mjs --only board,plate
 *
 * Options: --browser chrome|firefox   --width desktop|mobile|all
 *          --theme light|dark|all     --only board,plate,hover,filter,credits
 *          --out <dir>
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = process.env.SHOT_BASE ?? (await baseUrl());
const OUT =
  process.env.SHOT_OUT ??
  join(process.env.LOCALAPPDATA ?? '.', 'Temp', 'opencode', 'shots');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const BROWSER = opt('browser', 'chrome');
const WIDTH = opt('width', 'all');
const THEME = opt('theme', 'all');
const ONLY = new Set(
  opt('only', 'board,plate,hover,filter,credits')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
};
/* Tall enough that the whole section fits and has finished settling. */
const BOARD_VIEWS = {
  desktop: { width: 1280, height: 2400 },
  mobile: { width: 390, height: 2400 },
};

const PLATE_IDS = [
  'machine-learning',
  'backend-data',
  'web-interface',
  'cloud-platform',
  'practice',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });

const launcher = BROWSER === 'firefox' ? firefox : chromium;
const browser = await launcher.launch({ headless: false });
let count = 0;

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  count++;
  console.log(`  ${name}.png`);
}

/** Element shot. `page.screenshot({clip})` uses one coordinate space and the
 *  sticky header another, so a clipped capture pulled in a sliver of the
 *  scroll-progress bar across the top of the plate and read as a blue rule. */
async function shotEl(page, loc, name) {
  const path = join(OUT, `${name}.png`);
  await loc.screenshot({ path });
  count++;
  console.log(`  ${name}.png`);
}

/**
 * Hover a tile and report what actually happened. A shot of a hover state is
 * worthless if the pointer was nowhere near the tile by the time the shutter
 * fired, so the state is read back and printed with the filename.
 */
async function hoverTile(page, name) {
  // The names come from the content and contain parentheses, so the pattern
  // has to be escaped before it can be anchored.
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page
    .locator('.tile')
    .filter({ has: page.locator('.tile__name', { hasText: new RegExp(`^\\s*${esc}\\s*$`) }) })
    .first()
    .hover();
  await page.waitForTimeout(450);
  return page.evaluate((want) => {
    const t = [...document.querySelectorAll('.tile')].find(
      (el) => el.querySelector('.tile__name').textContent.trim() === want
    );
    const ctx = t.querySelector('.tile__context');
    const plate = t.querySelector('.tile__plate');
    // Read the path, not the svg: the path carries fill="currentColor", while
    // the svg's own `fill` is still the initial black and says nothing.
    const glyph = t.querySelector('path');
    return {
      context: ctx.textContent.trim() ? getComputedStyle(ctx).opacity : 'none',
      lift: getComputedStyle(plate).translate || 'none',
      tint: getComputedStyle(plate).backgroundColor,
      glyph: glyph ? getComputedStyle(glyph).fill : '-',
    };
  }, name);
}

async function scrollInto(page, selector, pad = 90) {  await page.evaluate(
    ([sel, p]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - p;
      window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    },
    [selector, pad]
  );
}

async function open(theme, viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  });
  // The page reads this before it paints, so the shot is never of a theme
  // that is about to change underneath it.
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch (e) {
      /* private mode - the media query below still decides it */
    }
  }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return { context, page, errors };
}

for (const width of WIDTH === 'all' ? ['desktop', 'mobile'] : [WIDTH]) {
  for (const theme of THEME === 'all' ? ['light', 'dark'] : [THEME]) {
    const tag = `${BROWSER}-${width}-${theme}`;
    console.log(`\n${tag}`);
    const v = VIEWPORTS[width];
    const { context, page, errors } = await open(theme, v);

    if (ONLY.has('board')) {
      await page.setViewportSize(BOARD_VIEWS[width]);
      await sleep(300);
      await scrollInto(page, '#skills-movement', 70);
      await sleep(1400);
      await shot(page, `specimen-board-${tag}`);

      // The reveal in flight: back to a normal window, section just arriving.
      await page.setViewportSize(v);
      await sleep(200);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await sleep(300);
      await scrollInto(page, '#skills-movement', v.height - 120);
      await sleep(220);
      await shot(page, `specimen-arriving-${tag}`);
      await sleep(1200);
    }

    if (ONLY.has('plate')) {
      await page.setViewportSize(BOARD_VIEWS[width]);
      await sleep(200);
      for (const id of PLATE_IDS) {
        // 96 clears the sticky header, so nothing is drawn over the plate.
        await scrollInto(page, `#plate-${id}`, 96);
        await sleep(1100);
        await shotEl(page, page.locator(`#plate-${id}`), `plate-${id}-${tag}`);
      }
    }

    if (ONLY.has('hover')) {
      await page.setViewportSize(BOARD_VIEWS[width]);
      await sleep(200);
      await scrollInto(page, '#plate-cloud-platform', 96);
      await sleep(1100);
      console.log(
        `  hover AWS  ${JSON.stringify(await hoverTile(page, 'Amazon Web Services (AWS)'))}`
      );
      await shotEl(page, page.locator('#plate-cloud-platform'), `hover-cloud-${tag}`);

      // One with a brand colour that only survives on one theme, so the
      // suppression is visible rather than assumed.
      await scrollInto(page, '#plate-machine-learning', 96);
      await sleep(900);
      console.log(`  hover PyTorch  ${JSON.stringify(await hoverTile(page, 'PyTorch'))}`);
      await shotEl(page, page.locator('#plate-machine-learning'), `hover-ml-${tag}`);
    }

    if (ONLY.has('filter')) {
      await page.setViewportSize(v);
      await sleep(200);
      await scrollInto(page, '#skills-movement', 60);
      await sleep(1300);
      await page.locator('.specimen__group[data-plate="web-interface"]').click();
      await sleep(500);
      await shot(page, `filter-web-${tag}`);
      await page.locator('.specimen__group[data-plate="all"]').click();
      await sleep(600);
    }

    if (ONLY.has('credits')) {
      await page.setViewportSize(v);
      await page.goto(`${BASE.replace(/\/$/, '')}/logos/CREDITS`, {
        waitUntil: 'networkidle',
      });
      await sleep(700);
      await shot(page, `credits-top-${tag}`);
      await page.evaluate(() => window.scrollBy({ top: 900, behavior: 'instant' }));
      await sleep(400);
      await shot(page, `credits-table-${tag}`);
    }

    if (errors.length) console.log(`  !! console: ${errors.join(' | ')}`);
    else console.log('  console clean');
    await context.close();
  }
}

await browser.close();
console.log(`\n${count} shots in ${OUT}`);

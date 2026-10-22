/**
 * Screenshots for the four changes in this round, for looking at rather than
 * measuring:
 *
 *   1. the AWS tile carrying two destinations - the name to The work, and a
 *      smaller "3 certificates" to the badge that owns them;
 *   2. the plate's shared context line, holding the line of the tile under the
 *      pointer, with nothing reserved under any tile;
 *   3. the ledger after the duplicate was removed: badges above, and every
 *      other credential exactly once below;
 *   4. the same caption at 390px.
 *
 *   node tools/shot-round4.mjs
 *   node tools/shot-round4.mjs --only caption
 *   node tools/shot-round4.mjs --browser firefox
 *
 * Options: --browser chrome|firefox   --only caption,aws,proof,mobile
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
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
};
const BROWSER = opt('browser', 'chrome');
const ONLY = new Set(opt('only', 'caption,aws,proof,mobile').split(',').map((s) => s.trim()));

/* Tall enough that a whole plate fits and the reveal has settled - a short
   window photographs an animation in flight and calls it a design. */
const PLATE_VIEW = { width: 1280, height: 1500 };
const MOBILE_VIEW = { width: 390, height: 1100 };

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launcher = BROWSER === 'firefox' ? firefox : chromium;
const browser = await launcher.launch({ headless: false });
let count = 0;

async function open(theme, viewport = PLATE_VIEW) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch (e) {
      /* private mode - the media query still decides */
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

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  count++;
  console.log(`  ${name}.png`);
}

/** Bring a section or plate to the top of the window, clear of the header. */
async function scrollInto(page, selector, pad = 96) {
  await page.evaluate(
    ([sel, p]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      window.scrollTo({
        top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - p),
        behavior: 'instant',
      });
    },
    [selector, pad]
  );
}

/** Hover a tile by its exact name, then read the state back before the shutter. */
async function hoverTile(page, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page
    .locator('.tile')
    .filter({ has: page.locator('.tile__name', { hasText: new RegExp(`^\\s*${esc}\\s*$`) }) })
    .first()
    .hover();
  await sleep(450);
  return page.evaluate((want) => {
    const t = [...document.querySelectorAll('.tile')].find(
      (el) => el.querySelector('.tile__name').textContent.trim() === want
    );
    const plate = t.closest('.plate');
    const own = t.querySelector('.tile__context');
    const line = plate.querySelector('.plate__context');
    const extra = t.querySelector('.tile__extra a');
    return {
      plate: plate.id,
      caption: line ? line.textContent : '(absent)',
      captionH: line ? Math.round(line.getBoundingClientRect().height) : -1,
      ownVisible: own ? own.getBoundingClientRect().width > 2 : 'n/a',
      extra: extra ? extra.textContent.trim() : null,
      extraHref: extra ? extra.getAttribute('href') : null,
      height: Math.round(plate.getBoundingClientRect().height),
    };
  }, name);
}

for (const theme of ['light', 'dark']) {
  if (theme === 'dark' && !ONLY.has('aws')) continue;

  if (ONLY.has('caption') || ONLY.has('aws')) {
    console.log(`\n${BROWSER}-${theme}`);
    const which = theme === 'dark' ? 'aws' : 'caption';
    const tile = which === 'aws' ? 'Amazon Web Services (AWS)' : 'PyTorch';
    const plate = which === 'aws' ? '#plate-cloud-platform' : '#plate-machine-learning';
    const { context, page, errors } = await open(theme);

    await scrollInto(page, '.specimen', 40);
    await sleep(1000);
    const before = await page.evaluate((sel) => {
      const p = document.querySelector(sel);
      return { height: Math.round(p.getBoundingClientRect().height) };
    }, plate);

    await scrollInto(page, plate, 96);
    await sleep(700);
    const state = await hoverTile(page, tile);
    console.log(
      `  ${tile}: caption ${JSON.stringify(state.caption)} (${state.captionH}px)` +
        ` own=${state.ownVisible} extra=${state.extra} -> ${state.extraHref}` +
        ` plate ${before.height}px -> ${state.height}px`
    );
    await shot(page, `caption-${which}-${BROWSER}-${theme}`);
    await context.close();
  }

  if (ONLY.has('proof') && theme === 'light') {
    const { context, page, errors } = await open(theme);
    // The badges, and the first few rows under them, in one frame.
    await scrollInto(page, '.badges', 110);
    await sleep(1200);
    const ledger = await page.evaluate(() => ({
      badges: document.querySelectorAll('.badges .badge').length,
      rows: document.querySelectorAll('.ledger .ledger__row').length,
      openRows: document.querySelectorAll('.ledger__row[open]').length,
      awsInLedger: [...document.querySelectorAll('.ledger__row')].filter((r) =>
        r.id.includes('aws')
      ).length,
    }));
    console.log(
      `  proof: ${ledger.badges} badges, ${ledger.rows} rows (${ledger.openRows} open, ` +
        `${ledger.awsInLedger} aws rows)`
    );
    await shot(page, `proof-dedupe-${BROWSER}-${theme}`);
    console.log(`console: ${errors.length ? errors.join(' | ') : 'clean'}`);
    await context.close();
  }
}

if (ONLY.has('mobile')) {
  console.log(`\n${BROWSER}-mobile 390px`);
  const { context, page, errors } = await open('light', MOBILE_VIEW);
  await scrollInto(page, '.specimen', 40);
  await sleep(1000);
  await scrollInto(page, '#plate-machine-learning', 96);
  await sleep(600);
  const state = await hoverTile(page, 'PyTorch');
  console.log(`  caption ${JSON.stringify(state.caption)} at 390px`);
  await shot(page, `caption-mobile-${BROWSER}`);
  console.log(`console: ${errors.length ? errors.join(' | ') : 'clean'}`);
  await context.close();
}

await browser.close();
console.log(`\n${count} screenshot(s) in ${OUT}`);

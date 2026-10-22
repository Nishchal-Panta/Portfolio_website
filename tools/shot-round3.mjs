/**
 * Screenshots for the three changes in this round, for looking at rather than
 * measuring:
 *
 *   1. the events order, with the mentor session read before Relay Hack;
 *   2. the Laravel training photo that was replaced;
 *   3. a tile that has nowhere to go next to one that does - the hover wash,
 *      the lift and the brand colour must appear on the second and be absent
 *      from the first, in both themes.
 *
 *   node tools/shot-round3.mjs                 # everything, chrome
 *   node tools/shot-round3.mjs --browser firefox
 *   node tools/shot-round3.mjs --only events
 *
 * Options: --browser chrome|firefox   --only events,photo,hover
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
const ONLY = new Set(opt('only', 'events,photo,hover').split(',').map((s) => s.trim()));

const VIEWPORT = { width: 1280, height: 900 };
/* Tall enough that a whole plate fits and every tile has settled before the
   shutter - a short window photographs a reveal in flight. */
const PLATE_VIEW = { width: 1280, height: 1500 };

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launcher = BROWSER === 'firefox' ? firefox : chromium;
const browser = await launcher.launch({ headless: false });
let count = 0;

async function open(theme) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
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
  await page.waitForTimeout(450);
  return page.evaluate((want) => {
    const t = [...document.querySelectorAll('.tile')].find(
      (el) => el.querySelector('.tile__name').textContent.trim() === want
    );
    const plate = t.querySelector('.tile__plate');
    const path = t.querySelector('path');
    const ctx = t.querySelector('.tile__context');
    return {
      link: Boolean(t.querySelector('a')),
      lift: getComputedStyle(plate).translate || 'none',
      tint: getComputedStyle(plate).backgroundColor,
      glyph: path ? getComputedStyle(path).fill : '-',
      context: ctx ? getComputedStyle(ctx).opacity : '-',
    };
  }, name);
}

for (const theme of ['light', 'dark']) {
  console.log(`\n${BROWSER}-${theme}`);
  const { context, page, errors } = await open(theme);

  if (ONLY.has('events')) {
    // Both events in one frame: the mentor session has to be the one on top.
    await scrollInto(page, '#mentor-sprint-2025', 140);
    await sleep(1100);
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.event')]
        .map((e) => ({ id: e.id, top: Math.round(e.getBoundingClientRect().top) }))
        .filter((e) => e.top > -400 && e.top < 900)
        .sort((a, b) => a.top - b.top)
        .map((e) => e.id)
    );
    console.log(`  order on screen: ${order.join(' > ')}`);
    await shot(page, `events-order-${BROWSER}-${theme}`);
  }

  if (ONLY.has('photo') && theme === 'light') {
    await scrollInto(page, '#laravel-training-2026', 120);
    await sleep(1200);
    const alt = await page.evaluate(
      () => document.querySelector('#laravel-training-2026 img')?.alt
    );
    console.log(`  first image alt: ${JSON.stringify(alt)}`);
    await shot(page, `laravel-photo-${BROWSER}-${theme}`);
  }

  if (ONLY.has('hover')) {
    await page.setViewportSize(PLATE_VIEW);
    await sleep(250);
    await scrollInto(page, '#plate-cloud-platform', 96);
    await sleep(1200);

    console.log(`  hover Git      ${JSON.stringify(await hoverTile(page, 'Git'))}`);
    await shot(page, `hover-nolink-git-${BROWSER}-${theme}`);

    console.log(`  hover GitHub   ${JSON.stringify(await hoverTile(page, 'GitHub'))}`);
    await shot(page, `hover-link-github-${BROWSER}-${theme}`);
  }

  if (errors.length) console.log(`  !! console: ${errors.join(' | ')}`);
  else console.log('  console clean');
  await context.close();
}

await browser.close();
console.log(`\n${count} shots in ${OUT}`);

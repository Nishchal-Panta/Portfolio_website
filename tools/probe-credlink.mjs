/**
 * Follow every in-page link for real, and check what happens when it arrives.
 *
 * verify-anchors proves the target exists in the HTML. This proves what a
 * reader gets: the row opens, the reader lands below the sticky header with the
 * row's own summary at the top of the window, and focus follows so a keyboard
 * or screen-reader user is told where they are. Three ways in, all checked,
 * because they are three different code paths:
 *
 *   - clicking a name link in a skill tile
 *   - clicking a tile's second link (the AWS certificates)
 *   - loading the page with the hash already in the URL
 *
 *   node tools/probe-credlink.mjs
 *   node tools/probe-credlink.mjs --browser firefox
 */

import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : dflt;
};

const BASE = await baseUrl();
const engine = opt('browser', 'chrome');

/**
 * Landing, measured rather than asserted by eye. The header is sticky at the
 * top, so "in view" has to mean below it; scroll-padding-top on the document is
 * what puts the gap there, and this is where that claim is checked.
 */
const READ = (href) => {
  const el = document.getElementById(href.slice(1));
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const head = document.querySelector('.site-header');
  const headBottom = head ? Math.round(head.getBoundingClientRect().bottom) : 0;
  const summary = el.matches('details') ? el.querySelector('summary') : null;
  const active = document.activeElement;
  // Only rows, entries and badges are destinations: a chapter is a section and
  // is left exactly as it was, so it is not asked to take focus.
  const isDest = el.matches('details.ledger__row, li.badge, article.event');
  return {
    found: true,
    isDest,
    hash: location.hash,
    headBottom,
    top: Math.round(r.top),
    inView: r.bottom > 0 && r.top < innerHeight,
    clearsHeader: r.top >= headBottom - 1,
    open: el.matches('details') ? el.open : null,
    openCount: document.querySelectorAll('details.ledger__row[open]').length,
    focusOn: active === (summary ?? el),
    focusTag: active ? `${active.tagName.toLowerCase()}.${active.className || '-'}` : 'none',
  };
};

const check = (s, href) => {
  const isDetails = s.open !== null; // otherwise it is an entry or a badge
  const ok =
    s.found &&
    s.hash === href &&
    s.inView &&
    s.clearsHeader &&
    // A destination: opened, opened exactly once, and holding focus.
    (!s.isDest ||
      (!isDetails || s.open) &&
        (!isDetails || s.openCount === 1) &&
        s.focusOn);
  return { ok, href, s };
};

const run = async (browserType, name) => {
  const browser = await browserType.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: 'networkidle' });

  const links = await page.evaluate(() =>
    [...document.querySelectorAll('.tile__name a, .tile__extra a')].map((a) => ({
      name: (a.closest('.tile__extra') ? '[2nd] ' : '') + a.textContent.trim(),
      href: a.getAttribute('href'),
    }))
  );

  const results = [];

  for (const link of links) {
    // One page load per link: a hash change alone does not re-run a scroll that
    // is already at its destination, and reusing the page would make the second
    // link's result the first link's landing.
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const plain = link.name.replace(/^\[2nd\]\s*/, '');
    const esc = plain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await page
      .locator('.tile__name a, .tile__extra a', { hasText: new RegExp(`^\\s*${esc}\\s*$`) })
      .first()
      .click();
    await page.waitForTimeout(1400);
    results.push({
      ...check(await page.evaluate(READ, link.href), link.href),
      label: `click  ${link.name}`,
    });
  }

  // The other two ways in: the hash already being in the URL on a cold load,
  // and a row that only a badge owns. An event entry has no inbound link at
  // all, so it is reached the way a reader would paste it.
  //
  // A page of its own for each, deliberately. Reloading a page that arrived by
  // fragment makes Chrome restore the scroll it had before the fragment
  // rather than scrolling to it again, which is a browser behaviour and not
  // something a reader ever does: nobody reloads a link into the same session
  // and judges the landing by where the previous page was standing.
  for (const href of [
    '#cred-datacamp-pandas',
    '#cred-aws-cloud-practitioner',
    '#laravel-training-2026',
    '#cred-relay-hack',
  ]) {
    const fresh = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await fresh.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    await fresh.waitForTimeout(1200);
    results.push({
      ...check(await fresh.evaluate(READ, href), href),
      label: `load   ${href}`,
    });
    await fresh.close();
  }

  console.log(`\n${name}: ${results.length} arrivals\n`);
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    const s = r.s;
    console.log(
      `  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.label.padEnd(46)} top=${s.top}` +
        ` head=${s.headBottom} open=${s.open === null ? '-' : s.open}` +
        ` rows=${s.openCount} focus=${s.focusOn ? 'landed' : s.focusTag}`
    );
  }

  console.log(`console: ${errors.length ? errors.join(' | ') : 'clean'}`);
  await browser.close();
  return { failed, count: results.length, errors: errors.length };
};

const engineName = engine === 'firefox' ? 'firefox' : 'chrome';
const launcher = engine === 'firefox' ? firefox : chromium;
const out = await run(launcher, engineName);

if (out.failed || out.errors) {
  console.log(`\nFAIL: ${out.failed} arrival(s) wrong, ${out.errors} console error(s)`);
  process.exitCode = 1;
} else {
  console.log(
    `\nPASS: all ${out.count} arrivals open the target, clear the header and take focus`
  );
}

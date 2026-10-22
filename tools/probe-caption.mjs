/**
 * The plate's shared context line, measured.
 *
 * Three claims are being tested, and none of them can be taken from a
 * screenshot alone:
 *
 *   1. The line carries the text of whichever tile is hovered or focused.
 *   2. Showing it changes no height anywhere: the plate is the same size with
 *      and without it, so no tile under it moves by a pixel. This is the whole
 *      reason for having one line per plate instead of a hole per tile.
 *   3. Each tile's own sentence is out of the flow but still in the document,
 *      and a touch device - which has no hover to drive any of this - keeps
 *      every sentence exactly where the reader expects it.
 *
 * It also watches the reserved height against every sentence in the board, at
 * both widths, because a line that wraps to two is a line that shifts the
 * plate on the first hover.
 *
 *   node tools/probe-caption.mjs
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
let failures = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok    ' : 'FAIL  '}${label}${!cond && detail ? `  (${detail})` : ''}`);
  if (!cond) failures++;
};

const browser = await chromium.launch({ headless: false });

/* --- pointer device ------------------------------------------------------- */

console.log('\npointer device, 1280px');

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE, { waitUntil: 'networkidle' });
// The board wires itself when it comes within 600px of the window.
await page.evaluate(() =>
  document.querySelector('.specimen')?.scrollIntoView({ behavior: 'instant', block: 'center' })
);
await page.waitForTimeout(900);

const survey = await page.evaluate(() => {
  const board = document.querySelector('.specimen');
  const out = { js: board?.hasAttribute('data-js') ?? false, plates: [], sentences: [] };
  for (const plate of document.querySelectorAll('.plate')) {
    const ctx = plate.querySelector('.plate__context');
    const tiles = [...plate.querySelectorAll('.tile')];
    out.plates.push({
      id: plate.id,
      height: plate.getBoundingClientRect().height,
        nextDocTop: plate.nextElementSibling
          ? plate.nextElementSibling.getBoundingClientRect().top + scrollY
          : null,
      lineDisplay: ctx ? getComputedStyle(ctx).display : 'absent',
      lineHeight: ctx ? ctx.getBoundingClientRect().height : -1,
      tiles: tiles.length,
      linked: tiles.filter((t) => t.querySelector('a')).length,
    });
    for (const t of tiles) {
      const text = t.querySelector('.tile__context')?.textContent?.trim() ?? '';
      if (text) out.sentences.push({ plate: plate.id, name: t.querySelector('.tile__name')?.textContent?.trim(), text });
    }
  }
  return out;
});

ok(survey.js, 'the board marks itself as scripted');
const shared = survey.plates.filter((p) => p.lineDisplay === 'block').length;
ok(shared === survey.plates.length, `every plate has its shared line live (${shared}/${survey.plates.length})`);

// Every sentence, rendered into the reserved line, must fit the space it is
// given. A second line would be a second row of height, and the first hover
// would move every tile under it. Checked at every width the board is used at,
// because a sentence that fits at 1280 can still wrap in a narrow window.
const WIDTHS = [390, 700, 1024, 1280];
const fits = [];
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(150);
  fits.push(
    await page.evaluate(() => {
      const line = document.querySelector('.plate__context');
      if (!line) return { error: 'no line' };
      const sentences = [...document.querySelectorAll('.tile__context')]
        .map((c) => c.textContent.trim())
        .filter(Boolean);
      const reserved = line.getBoundingClientRect().height;
      const results = sentences.map((text) => {
        line.textContent = text;
        const used = line.getBoundingClientRect().height;
        return { text, used, lines: Math.round(used / reserved) };
      });
      line.textContent = '';
      return { width: innerWidth, reserved, results };
    })
  );
}
await page.setViewportSize({ width: 1280, height: 900 });

for (const fit of fits) {
  const worst = Math.max(...fit.results.map((r) => r.lines));
  const offenders = fit.results.filter((r) => r.lines > 1);
  ok(
    worst === 1,
    `${fit.width}px: all ${fit.results.length} sentences fit the reserved line (worst ${worst})`,
    offenders.map((o) => `${o.lines}x ${o.text.slice(0, 34)}`).join(' | ')
  );
}

// And the same no-movement promise in a narrow window, where a small laptop
// with a mouse is the reader rather than a phone.
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(200);
const narrow = await page.evaluate(async () => {
  const moved = [];
  for (const name of ['PyTorch', 'pandas', 'GitHub', 'Laravel']) {
    const tile = [...document.querySelectorAll('.tile')].find(
      (t) => t.querySelector('.tile__name')?.textContent.trim() === name
    );
    if (!tile) continue;
    const plate = tile.closest('.plate');
    const before = plate.getBoundingClientRect().height;
    tile.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    const after = plate.getBoundingClientRect().height;
    if (Math.abs(after - before) > 0.5) moved.push(`${name} ${before.toFixed(1)}->${after.toFixed(1)}`);
  }
  return moved;
});
ok(narrow.length === 0, '390px with a pointer: no plate moves on hover', narrow.join(' | '));
await page.setViewportSize({ width: 1280, height: 900 });

// Hover each linked tile in turn: the line follows, the plate does not move.
for (const plateId of ['plate-machine-learning', 'plate-cloud-platform', 'plate-practice']) {
  const tiles = page.locator(`#${plateId} .tile`);
  const count = await tiles.count();
  const deltas = [];
  let said = 0;
  let silent = 0;

  for (let i = 0; i < count; i++) {
    const tile = tiles.nth(i);
    const before = await page.evaluate((id) => {
      const plate = document.getElementById(id);
      return {
        height: plate.getBoundingClientRect().height,
        nextDocTop: plate.nextElementSibling
          ? plate.nextElementSibling.getBoundingClientRect().top + scrollY
          : null,
        line: plate.querySelector('.plate__context').textContent,
      };
    }, plateId);

    await tile.hover();
    await page.waitForTimeout(90);

    const after = await page.evaluate((id) => {
      const plate = document.getElementById(id);
      const tile = [...plate.querySelectorAll('.tile')].find(
        (t) => t.matches(':hover') || t.contains(document.activeElement)
      );
      const own = tile?.querySelector('.tile__context');
      return {
        height: plate.getBoundingClientRect().height,
        nextDocTop: plate.nextElementSibling
          ? plate.nextElementSibling.getBoundingClientRect().top + scrollY
          : null,
        line: plate.querySelector('.plate__context').textContent,
        ownVisible: own ? own.getBoundingClientRect().width > 2 : false,
        ownPosition: own ? getComputedStyle(own).position : 'none',
      };
    }, plateId);

    // Document coordinates, not viewport ones: hovering a tile near the bottom
    // makes the browser scroll to reach it, and a viewport-relative reading
    // would then report the whole page as having moved.
    const moved =
      Math.abs(after.height - before.height) > 0.5 ||
      (after.nextDocTop !== null &&
        before.nextDocTop !== null &&
        Math.abs(after.nextDocTop - before.nextDocTop) > 0.5);
    if (moved) {
      deltas.push(
        `#${i} h ${before.height.toFixed(1)}->${after.height.toFixed(1)} ` +
          `nextDocTop ${(before.nextDocTop ?? -1).toFixed(1)}->${(after.nextDocTop ?? -1).toFixed(1)}`
      );
    }
    if (after.line) {
      if (!after.ownVisible && after.ownPosition === 'absolute') said++;
    } else silent++;
  }

  ok(
    deltas.length === 0,
    `${plateId}: no plate or neighbour moves across ${count} hovers`,
    deltas.join(' | ')
  );
  ok(said + silent === count, `${plateId}: every tile accounted for (${said} said, ${silent} silent)`);
}

// What the line actually said for one known tile, checked by name.
const named = await page.evaluate(() => {
  const tile = [...document.querySelectorAll('.tile')].find(
    (t) => t.querySelector('.tile__name')?.textContent.trim() === 'pandas'
  );
  tile.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  const plate = tile.closest('.plate');
  return {
    line: plate.querySelector('.plate__context').textContent,
    expected: tile.querySelector('.tile__context').textContent.trim(),
  };
});
ok(named.line === named.expected && named.line.length > 0, 'hovering pandas puts its line in the plate caption', JSON.stringify(named));

// Keyboard: focusing a tile's link does the same thing.
const keyed = await page.evaluate(() => {
  const tile = [...document.querySelectorAll('.tile')].find(
    (t) => t.querySelector('.tile__name')?.textContent.trim() === 'pandas'
  );
  tile.querySelector('.tile__name a').focus();
  return tile.closest('.plate').querySelector('.plate__context').textContent;
});
ok(keyed.length > 0, 'keyboard focus sets the caption too', JSON.stringify(keyed));

// Leaving the plate clears it.
const cleared = await page.evaluate(() => {
  const plate = document.getElementById('plate-machine-learning');
  plate.dispatchEvent(new Event('pointerleave'));
  plate.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
  return plate.querySelector('.plate__context').textContent;
});
ok(cleared === '', 'leaving the plate empties its line', JSON.stringify(cleared));

console.log(`console: ${errors.length ? errors.join(' | ') : 'clean'}`);
await page.close();

/* --- touch --------------------------------------------------------------- */

console.log('\ntouch device, 390px');

const touch = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const tpage = await touch.newPage();
const terr = [];
tpage.on('pageerror', (e) => terr.push(String(e)));
await tpage.goto(BASE, { waitUntil: 'networkidle' });
await tpage.evaluate(() =>
  document.querySelector('.specimen')?.scrollIntoView({ behavior: 'instant', block: 'center' })
);
await tpage.waitForTimeout(900);

const touchState = await tpage.evaluate(() => {
  const line = document.querySelector('.plate__context');
  const ctxs = [...document.querySelectorAll('.tile__context')].filter((c) => c.textContent.trim());
  return {
    hoverNone: matchMedia('(hover: none)').matches,
    lineDisplay: line ? getComputedStyle(line).display : 'absent',
    visible: ctxs.filter((c) => getComputedStyle(c).opacity === '1' && c.getBoundingClientRect().width > 4).length,
    total: ctxs.length,
    inFlow: ctxs.filter((c) => getComputedStyle(c).position === 'static').length,
  };
});

ok(touchState.hoverNone, 'the context reports a touch device');
ok(touchState.lineDisplay === 'none', 'the shared line stays out of the way on touch');
ok(
  touchState.visible === touchState.total && touchState.inFlow === touchState.total,
  `every sentence stays visible and in the flow on touch (${touchState.visible}/${touchState.total})`
);
console.log(`console: ${terr.length ? terr.join(' | ') : 'clean'}`);
await touch.close();

await browser.close();

if (failures) {
  console.log(`\nFAIL: ${failures} caption check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nPASS: the shared caption carries the line, reserves one line, and moves nothing');
}


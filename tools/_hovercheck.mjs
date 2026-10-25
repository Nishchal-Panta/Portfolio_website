/**
 * Does hovering the album actually stop its timer, for a real pointer?
 *
 * WHY THIS EXISTS
 *
 * `probe-album.mjs` has one hover check that passes (hovering reveals the
 * arrows and sets `held` to "hover") and one that fails: "hovering the album
 * stops the timer", where `data-swaps` keeps advancing over a 6s window while
 * the pointer is over the stage. Those two disagree, so at least one of them is
 * describing something other than what happens.
 *
 * The difference is the input. The passing check and the failing check both use
 * `locator.hover()`, which warps the pointer to a coordinate in one jump. This
 * tool uses `page.mouse.move` with `steps`, the way a hand actually arrives -
 * crossing the stage's edge, its children and the arrows on the way - and then
 * asks three plain questions:
 *
 *   away  does the timer run while the pointer is elsewhere?
 *   held  does it stop once the pointer is really over the stage?
 *   back  does it run again when the pointer leaves?
 *
 * All three together matter. "Stops while hovered" on its own could be
 * satisfied by a timer that simply never started, and "runs while away" on its
 * own by one that never stops.
 *
 * `data-held` is reported alongside, because if it says "hover" while swaps
 * still advance then the hold is being set and not honoured, and if it never
 * says "hover" then the pointer never landed - two very different bugs.
 *
 * Run:  node tools/_hovercheck.mjs
 */
import { chromium, firefox } from 'playwright';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const VIEWPORT = { width: 1280, height: 860 };
const OBSERVE_MS = 6000;

const failures = [];
const check = (label, ok, detail) => {
  if (!ok) failures.push(label);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};

for (const [name, launcher] of [['chromium', chromium], ['firefox', firefox]]) {
  console.log(`\n${name} - headed, ${VIEWPORT.width}x${VIEWPORT.height}, ${OBSERVE_MS}ms observation windows\n`);

  const browser = await launcher.launch({ headless: false });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const stage = page.locator('[data-album-stage]');
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const box = await stage.boundingBox();
  if (!box) {
    console.log('  FAIL  album stage has no bounding box');
    failures.push(`${name}: stage not found`);
    await browser.close();
    continue;
  }
  /* Well inside the stage, away from the arrows that sit in the gutters. */
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);

  const swaps = () =>
    page.evaluate(() => Number(document.querySelector('[data-album]').dataset.swaps ?? 0));
  const held = () =>
    page.evaluate(() => document.querySelector('[data-album]').dataset.held);

  const observe = async () => {
    const before = await swaps();
    await page.waitForTimeout(OBSERVE_MS);
    return { before, after: await swaps(), delta: (await swaps()) - before };
  };

  // 1. pointer somewhere else entirely - the timer must be running, or "held"
  //    below could pass for the wrong reason.
  await page.mouse.move(4, 4, { steps: 10 });
  await page.waitForTimeout(600);
  const away = await observe();
  check(
    'timer RUNS while the pointer is away',
    away.delta > 0,
    `(${away.delta} swaps in ${OBSERVE_MS}ms, held "${await held()}")`
  );

  // 2. arrive on the stage the way a hand does: several steps, crossing the edge.
  await page.mouse.move(cx, cy, { steps: 12 });
  await page.waitForTimeout(900);
  const heldOn = await held();
  const on = await observe();
  check(
    'timer STOPS while the pointer is over the stage',
    on.delta === 0,
    `(${on.delta} swaps in ${OBSERVE_MS}ms, held "${heldOn}")`
  );
  check(
    'the hold is actually recorded as a hover',
    /hover/.test(heldOn),
    `(data-held "${heldOn}")`
  );

  // 3. leave again - a hold that never releases would look identical to (2).
  await page.mouse.move(4, 4, { steps: 10 });
  await page.waitForTimeout(600);
  const back = await observe();
  check(
    'timer RUNS again once the pointer leaves',
    back.delta > 0,
    `(${back.delta} swaps in ${OBSERVE_MS}ms, held "${await held()}")`
  );

  await browser.close();
}

console.log('\n' + '='.repeat(64));
if (failures.length) {
  console.log(`FAILED: ${failures.length}`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`all checks passed (${failures.length} failures)`);
console.log('='.repeat(64) + '\n');

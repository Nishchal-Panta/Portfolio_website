/**
 * Firefox at mobile width, without the viewport that made it hang.
 *
 * The earlier attempt set 390x2400 - a 2400px-tall viewport, which is not a
 * phone, it is a desktop window shaped like a column - and Firefox stalled on
 * it. A real phone is 390x844, and that is what is measured here. The board is
 * captured per plate rather than in one tall shot, because a tall shot is what
 * asked for the tall viewport in the first place.
 *
 * Reported as evidence, not as a pass/fail: the point is to know whether the
 * 390px claim has Firefox coverage, and to say plainly if it does not.
 *
 *   node tools/firefox-mobile.mjs
 */

import { firefox } from 'playwright';
import { mkdirSync } from 'node:fs';
import { baseUrl } from './base-url.mjs';

const OUT = `${process.env.LOCALAPPDATA}/Temp/opencode/shots`;
mkdirSync(OUT, { recursive: true });
const BASE = await baseUrl();

const browser = await firefox.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);

  const el = await page.$('#skills-movement');
  if (!el) {
    console.log(`  ${theme}: no #skills-movement on the page`);
    continue;
  }

  // Scroll in two steps with a pause, then wait for the page to be genuinely
  // still. A single instant jump leaves the browser mid-scroll when the
  // shutter opens: the sticky header overlaps the tiles it should sit above,
  // and the staggered tile reveal is caught part-way, so the shot shows grey
  // half-faded text and reads as a rendering bug that is not there.
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const s = document.querySelector('#skills-movement');
      window.scrollTo({
        top: s.getBoundingClientRect().top + window.scrollY - 70,
        behavior: 'instant',
      });
    });
    await page.waitForTimeout(500);
  }

  // Wait until the tiles that are actually on screen have landed. This is not
  // a fixed sleep, because the stagger duration is a guess and a slower
  // machine will under-run it, and it is not "every tile on the page", because
  // the reveal fires from an IntersectionObserver - tiles far below the fold
  // never fire, so that condition can never be satisfied and the wait always
  // times out with the on-screen tiles still mid-fade.
  //
  // Reported rather than silently tolerated: if a visible tile is still faded
  // when the wait gives up, the shot would show grey text and the number below
  // says so instead of letting the image be misread as a rendering fault.
  const settled = await page.evaluate(
    () =>
      new Promise((res) => {
        let stable = 0;
        let tries = 0;
        const tick = () => {
          const vh = window.innerHeight;
          let visible = 0;
          let faded = 0;
          document.querySelectorAll('.tile').forEach((t) => {
            const r = t.getBoundingClientRect();
            if (r.bottom < 0 || r.top > vh) return;
            visible++;
            const o = Number.parseFloat(getComputedStyle(t).opacity);
            if (o < 0.98) faded++;
          });
          stable = faded === 0 && visible > 0 ? stable + 1 : 0;
          if (stable >= 8 || ++tries > 100) res({ visible, faded, gaveUp: stable < 8 });
          else setTimeout(tick, 60);
        };
        tick();
      })
  );
  if (settled.gaveUp) {
    console.log(`    !! ${settled.faded} of ${settled.visible} on-screen tiles still faded`);
  }

  // Per plate, at the width a phone actually is. Captured by scrolling each
  // plate into view and shooting the viewport, not by element screenshot: an
  // element screenshot of a tall page scrolls and stitches, which bakes the
  // sticky header and the floating theme pill into the middle of the image at
  // every stitch boundary. That looks like content overlapping tiles, and it
  // is not - a reader scrolling normally never sees it. The viewport shot is
  // the honest one because it is exactly what is on screen.
  //
  // Names come from the plate's id, not from a data attribute, because there
  // is no data-group on the element - reading one that does not exist fell
  // back to plate-0..4 and threw away which plate was which.
  const plates = await page.$$('.plate');
  let shots = 0;
  for (const p of plates) {
    const id = (await p.getAttribute('id')) || `plate-${shots}`;
    await p.scrollIntoViewIfNeeded().catch(() => {});
    await page.evaluate(() => window.scrollBy({ top: -96, behavior: 'instant' }));
    await page.waitForTimeout(650);
    await page
      .screenshot({ path: `${OUT}/ffx-${id}-${theme}.png` })
      .catch(() => {});
    shots++;
  }
  // The whole section, captured after walking it. An element screenshot of a
  // 17000px section never triggers the IntersectionObserver for tiles below
  // the viewport, so they stay at opacity 0 and the image shows empty plates -
  // an artifact of the capture, not something a reader ever sees. Walking the
  // section first fires every observer, so the shot shows what the page does.
  const section = await page.$('#skills-movement');
  if (section) {
    const walked = await page.evaluate(async () => {
      const el = document.querySelector('#skills-movement');
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bottom = top + el.offsetHeight;
      for (let y = top; y < bottom; y += 400) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo({ top: bottom, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 400));
      // Report rather than assume: any tile that stayed hidden after the walk
      // is one the reader could reach and still see blank.
      let hidden = 0;
      document.querySelectorAll('.tile').forEach((t) => {
        if (Number.parseFloat(getComputedStyle(t).opacity) < 0.98) hidden++;
      });
      window.scrollTo({ top, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 500));
      return { hidden, tiles: document.querySelectorAll('.tile').length };
    });
    if (walked.hidden) {
      console.log(`    !! ${walked.hidden} of ${walked.tiles} tiles still hidden after the walk`);
    }
    await section.screenshot({ path: `${OUT}/ffx-board-${theme}.png` }).catch(() => {});
  }
  await page.screenshot({ path: `${OUT}/ffx-viewport-${theme}.png` });

  const info = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.tile')];
    const names = tiles.map((t) => t.querySelector('.tile__name'));
    // Tap target size: the whole plate is the target on touch.
    const targets = tiles.map((t) => t.getBoundingClientRect());
    const small = targets.filter((r) => r.height < 44 || r.width < 44);
    // Two columns at 390px, not one squashed one.
    const rows = {};
    targets.forEach((r) => {
      const k = Math.round(r.top / 8);
      rows[k] = (rows[k] || 0) + 1;
    });
    const cols = Math.max(...Object.values(rows));
    return {
      tiles: tiles.length,
      named: names.filter((n) => n && n.textContent.trim()).length,
      underTap: small.length,
      widestColumn: cols,
      viewport: window.innerWidth,
    };
  });

  console.log(`  ${theme}:`);
  console.log(`    ${info.tiles} tiles, ${info.named} with a visible name`);
  console.log(`    viewport ${info.viewport}px, widest row ${info.widestColumn} tile(s)`);
  console.log(`    ${info.underTap} tile(s) under the 44px tap minimum`);
  console.log(`    ${shots} plate shots, 1 board shot`);
  console.log(`    console: ${errors.length ? errors.join(' | ') : 'clean'}`);
}

await browser.close();
console.log(`\nshots in ${OUT}`);

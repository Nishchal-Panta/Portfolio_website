/**
 * The album, photographed.
 *
 * The probe measures the row; this looks at it. What is wanted this round:
 * the row at rest and with the pointer over it (where the arrows come up),
 * in both themes, at desktop and phone width - plus the lightbox, which is
 * unchanged but is part of the album a reader sees.
 *
 *   node tools/shot-album.mjs --base http://localhost:4322/
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { baseUrl } from './base-url.mjs';

const BASE = await baseUrl();
const OUT = `${process.env.LOCALAPPDATA}/Temp/opencode/shots`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false });

const shot = async (page, name) => {
  const el = page.locator('[data-album]');
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}.png`);
};

const open = async (viewport, theme) => {
  const page = await browser.newPage({ viewport });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() =>
    document.querySelector('#album')?.scrollIntoView({ behavior: 'instant', block: 'center' })
  );
  await page.mouse.move(4, 4);
  await page.waitForTimeout(1500);
  return page;
};

for (const theme of ['dark', 'light']) {
  for (const [tag, viewport] of [
    ['desktop', { width: 1280, height: 900 }],
    ['phone', { width: 390, height: 844 }],
  ]) {
    const page = await open(viewport, theme);

    // At rest: the pointer is off the album, so the arrows are not painted.
    await page.mouse.move(4, 4);
    await page.waitForTimeout(600);
    await shot(page, `album-${theme}-${tag}-rest`);

    // With the pointer over it - the gesture that reveals the arrows and
    // holds the row while the reader is looking at it.
    const stage = await page.locator('[data-album-stage]').boundingBox();
    if (stage) {
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
      await page.waitForTimeout(500);
      await shot(page, `album-${theme}-${tag}-hover`);
    }
    await page.close();
  }
}

// The lightbox, which is unchanged but is the other half of the album.
{
  const page = await open({ width: 1280, height: 900 }, 'dark');
  await page.locator('.album__figure:not([hidden]) [data-album-open]').first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/album-lightbox.png` });
  console.log('  album-lightbox.png');
  await page.close();
}

await browser.close();
console.log(`\nshots in ${OUT}`);

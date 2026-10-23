/* Scratch: does anything actually move when the page is still? */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:4323/';
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.mouse.move(4, 4);
await page.waitForTimeout(1500);

for (const theme of ['dark', 'light']) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(2500); // let the morph settle
  const a = await page.evaluate(() => JSON.stringify(window.__fieldStarPoints ?? null));
  const dispA = await page.evaluate(() => JSON.stringify(window.__fieldDisp ?? null));
  await page.waitForTimeout(2000);
  const b = await page.evaluate(() => JSON.stringify(window.__fieldStarPoints ?? null));
  const dispB = await page.evaluate(() => JSON.stringify(window.__fieldDisp ?? null));
  console.log(`${theme}: stars moved=${a !== b}  disp moved=${dispA !== dispB}`);
  // how many frames did it paint while still?
  const frames = await page.evaluate(
    () =>
      new Promise((r) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
          else r(n);
        };
        requestAnimationFrame(tick);
      })
  );
  console.log(`${theme}: ${frames} rAF callbacks in 2s at rest`);
}
await browser.close();

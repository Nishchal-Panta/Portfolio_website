/**
 * What the page actually publishes for the field: the debug object, the canvas,
 * and whether getImageData can see anything at all.
 *
 *   node tools/probe-field-global.mjs
 */
import { chromium } from 'playwright';
import { baseUrl } from './base-url.mjs';
const BASE = await baseUrl();


const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const out = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')].map((c) => ({
    w: c.width,
    h: c.height,
    cssW: getComputedStyle(c).width,
    position: getComputedStyle(c).position,
    cls: c.className,
    parent: c.parentElement?.tagName + '.' + (c.parentElement?.className || ''),
  }));
  const f = window.__field || {};
  const cv = document.querySelector('canvas');
  let ink = null;
  let sample = null;
  if (cv) {
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    try {
      const d = ctx.getImageData(0, 0, Math.min(64, cv.width), Math.min(64, cv.height)).data;
      let a = 0;
      for (let i = 3; i < d.length; i += 4) a += d[i];
      ink = a / (d.length / 4);
      sample = [d[0], d[1], d[2], d[3]];
    } catch (e) {
      ink = `threw: ${e}`;
    }
  }
  return {
    fieldKeys: Object.keys(f).sort(),
    backend: f.backend,
    starSpeed: f.starSpeed,
    shapeSpeed: f.shapeSpeed,
    maxSpeed: f.maxSpeed,
    onScreen: f.onScreen,
    figures: f.figures,
    starPointsType: Object.prototype.toString.call(window.__fieldStarPoints),
    starPointsLen: window.__fieldStarPoints ? window.__fieldStarPoints.length : null,
    starPointsHead: window.__fieldStarPoints
      ? Array.from(window.__fieldStarPoints).slice(0, 4).map((v) =>
          typeof v === 'object' ? JSON.stringify(v) : String(v)
        )
      : null,
    speedArrType: Object.prototype.toString.call(window.__fieldSpeeds),
    speedArrHead: window.__fieldSpeeds ? Array.from(window.__fieldSpeeds).slice(0, 4) : null,
    canvases,
    firstInk: ink,
    firstPixel: sample,
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();

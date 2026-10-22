/**
 * Does headed Firefox paint in this environment right now?
 *
 * This exists because two earlier results contradict each other. Firefox
 * desktop was verified with screenshots earlier in this session, but a later
 * diagnosis found the compositor frozen: currentTime pinned at 0 while the
 * document timeline advanced, and two screenshots a second apart byte
 * identical. Both cannot be true, so the question is which one describes the
 * browser as it is now rather than as it was then.
 *
 * The probe is deliberately minimal - a blank page, no site JavaScript - so
 * that whatever it reports cannot be the site's fault.
 *
 *   node tools/firefox-paint-check.mjs
 */

import { firefox } from 'playwright';

const browser = await firefox.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });

// An animation that must advance if anything is being painted. readBack reads
// the animation's own clock, which is independent of whether a pixel changes.
await page.evaluate(() => {
  const st = document.createElement('style');
  st.textContent =
    '@keyframes slide{from{transform:translateX(0)}to{transform:translateX(400px)}}' +
    '#p{position:fixed;top:0;left:0;width:40px;height:40px;background:red;' +
    'animation:slide 2s linear infinite}';
  document.head.append(st);
  const el = document.createElement('div');
  el.id = 'p';
  document.body.append(el);
});

const before = await page.evaluate(() => {
  const a = document.getElementById('p').getAnimations()[0];
  return { playState: a.playState, currentTime: Math.round(a.currentTime || 0) };
});
await page.waitForTimeout(1500);
const after = await page.evaluate(() => {
  const a = document.getElementById('p').getAnimations()[0];
  return {
    playState: a.playState,
    currentTime: Math.round(a.currentTime || 0),
    timeline: Math.round(document.timeline.currentTime || 0),
    computed: getComputedStyle(document.getElementById('p')).transform,
  };
});

// Two shots apart. If the compositor is painting, bytes differ.
const a = await page.screenshot();
await page.waitForTimeout(800);
const b = await page.screenshot();
let diff = 0;
const n = Math.min(a.length, b.length);
for (let i = 0; i < n; i++) if (a[i] !== b[i]) diff++;

const advanced = after.currentTime > before.currentTime;
console.log('animation clock  ', before.currentTime, '->', after.currentTime);
console.log('document timeline', after.timeline, 'ms');
console.log('computed transform', after.computed);
console.log(`screenshot bytes changed: ${diff} of ${n}`);
console.log('');
if (advanced && diff > 0) {
  console.log('Firefox is painting: the clock advanced and the pixels changed.');
} else if (!advanced && diff === 0) {
  console.log('Firefox is NOT painting: clock frozen, pixels identical.');
  console.log('Any Firefox screenshot taken here is therefore a still frame, not');
  console.log('evidence about the site. Firefox coverage stays static only.');
} else {
  console.log('Firefox is in a mixed state - clock and pixels disagree.');
}

await browser.close();

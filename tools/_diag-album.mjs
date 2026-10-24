/* TEMPORARY diagnostic - deleted after use.
   Replays probe-album's "start and stop" scroll steps and reports the geometry
   the probe never prints, so a missed IntersectionObserver can be explained
   rather than guessed at. */
import { engine, wide, sleep } from './shared.mjs';

const BASE = 'http://localhost:4323/';
const b = await engine();
const page = await b.newPage();
await page.setViewportSize(wide);
await page.goto(BASE, { waitUntil: 'networkidle' });

const geo = () =>
  page.evaluate(() => {
    const a = document.querySelector('[data-album]');
    const sec = document.querySelector('#album');
    const r = a.getBoundingClientRect();
    const s = sec.getBoundingClientRect();
    const vh = innerHeight;
    const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return {
      scrollY: Math.round(scrollY),
      docH: document.documentElement.scrollHeight,
      vh,
      secTop: Math.round(s.top),
      secH: Math.round(s.height),
      albTop: Math.round(r.top),
      albH: Math.round(r.height),
      ratio: +(vis / r.height).toFixed(3),
      onScreen: a.dataset.onScreen ?? '(unset)',
      enter: a.dataset.enter ?? '-',
      begin: a.dataset.begin ?? '-',
      decodes: a.dataset.decodes ?? '-',
      swaps: a.dataset.swaps ?? '-',
      timer: a.dataset.timer ?? '-',
      held: a.dataset.held ?? '-',
    };
  });

const show = (label, g) => {
  const { secTop, secH, albTop, albH, ...rest } = g;
  console.log(
    label.padEnd(12),
    JSON.stringify(rest),
    ` sec[top=${secTop} h=${secH}] album[top=${albTop} h=${albH}]`
  );
};

show('initial', await geo());

await page.evaluate(() => window.scrollTo(0, -100000));
await sleep(600);
show('far(-1e5)', await geo());

await page.evaluate(() => window.scrollTo(0, 400));
await sleep(1200);
show('at 400', await geo());

await page.evaluate(() =>
  document.querySelector('#album').scrollIntoView({ behavior: 'instant', block: 'center' })
);
await sleep(250);
show('centred', await geo());
await sleep(4000);
show('centred+4s', await geo());

await b.close();

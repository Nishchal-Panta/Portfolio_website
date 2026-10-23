/**
 * The album, as shipped.
 *
 * Everything here is read out of `dist/` with no browser at all, because
 * `npm run build` has to stay runnable on a CI runner that has never had
 * Playwright installed. Two kinds of check, and both of them fail the build:
 *
 *   1. Things that must be gone. The album used to carry a pause button, a
 *      shuffle button, a "Showing 3 of 13" counter and a whole `.carousel` /
 *      `.slide` stylesheet behind them. None of it is reachable now, and the
 *      only thing that stops it coming back is a check that cannot be argued
 *      with.
 *   2. Things that must be true of the markup, because they are invisible
 *      until something breaks: intrinsic dimensions on every photograph (no
 *      layout shift), a `sizes` promise that matches the layout, derivatives
 *      under budget, arrows that a screen reader can name, and a no-JS
 *      stylesheet that actually ships.
 *
 *   node tools/verify-album.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

let failures = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok    ' : 'FAIL  '}${label}${!cond && detail ? `\n        ${detail}` : ''}`);
  if (!cond) failures++;
};

if (!fs.existsSync(DIST)) {
  console.log('FAIL  dist/ is missing - run astro build first');
  process.exit(1);
}
const index = path.join(DIST, 'index.html');
if (!fs.existsSync(index)) {
  console.log('FAIL  dist/index.html is missing');
  process.exit(1);
}

const html = fs.readFileSync(index, 'utf8');

/* The album section, as a substring. Everything below reads inside it, so a
   word that happens to appear elsewhere on the page cannot fail this. */
const start = html.indexOf('<section class="movement" id="album"');
const end = html.indexOf('</section>', start);
if (start < 0 || end < 0) {
  console.log('FAIL  the album section is not on dist/index.html');
  process.exit(1);
}
const album = html.slice(start, end + '</section>'.length);

/* The number of photographs, counted out of the markup rather than assumed:
   everything below that is about the loop is against this. */
const ALBUM_SIZE_LIT = [...album.matchAll(/<figure class="album__figure"[^>]*>/g)].length;

console.log('album');

/* --- 1. what must be gone ------------------------------------------------ */

const forbidden = [
  [/\bdata-album-toggle\b/, 'a pause/play control'],
  [/\bdata-album-shuffle\b/, 'a shuffle control'],
  [/\bdata-album-count\b/, 'a photo counter'],
  [/\bdata-album-status\b/, 'a status line'],
  [/album__controls/, 'the controls row'],
  [/album__hint/, 'a hint under the row'],
  [/\bclass="album__btn--toggle"/, 'a toggle button'],
];
for (const [re, what] of forbidden) {
  ok(!re.test(album), `no ${what} in the album DOM`, (album.match(re) ?? []).join(' '));
}

/* The word itself, anywhere in the album. A live region announcing
   "Photograph 7 of 13" is a different thing from a counter printed on the
   page, but the word is what the old controls were called and it is easier to
   keep the whole album free of it than to police a substring. */
ok(!/showing\s+\d+\s+of\s+\d+/i.test(album), 'no "Showing N of M" text');
ok(!/\bpause\b|\bshuffle\b/i.test(album.replace(/aria-label="[^"]*"/g, '')), 'no pause or shuffle wording');

/* And in the stylesheets the old album lived in. */
const cssFiles = fs
  .readdirSync(path.join(DIST, '_astro'))
  .filter((f) => f.endsWith('.css'))
  .map((f) => path.join(DIST, '_astro', f));
const allCss = cssFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
ok(!/\.carousel[\w-]*\s*[,{]/.test(allCss), 'no .carousel rules in the built CSS');
ok(!/\.slide[\w-]*\s*[,{]/.test(allCss), 'no .slide rules in the built CSS');
ok(!/\.album__controls[\w-]*\s*[,{]/.test(allCss), 'no .album__controls rules in the built CSS');

/* The old album set `--ar` in the markup. The site's CSP is `style-src
   'self'`, which refuses inline style attributes, so that value never reached
   the page in production - the layout took its ratio from the photograph
   instead. Nothing may put it back. */
ok(!/style="--ar/.test(html), 'no style="--ar" attributes anywhere (style-src blocks them)');

/* --- 2. the conveyor, in the markup -------------------------------------- */

const figures = [...album.matchAll(/<figure class="album__figure"[^>]*>/g)].map((m) => m[0]);
ok(figures.length === 13, `thirteen photographs in the row (${figures.length})`);

/* The first three are shown in the markup and the rest are hidden, so the
   first paint is exactly the conveyor's geometry and taking script away
   cannot shift the page. */
const hidden = figures.filter((f) => /\shidden(?=[\s>])/.test(f));
ok(hidden.length === 10, `ten photographs ship hidden (${hidden.length})`);
ok(
  figures.slice(0, 3).every((f) => !/\shidden(?=[\s>])/.test(f)),
  'the opening three ship visible'
);

/* Intrinsic dimensions: the row's height is fixed but each photograph's width
   is its own, so without these the layout would be guessed twice - once before
   the bytes arrive and once after. */
const imgs = [...album.matchAll(/<img [^>]*\bclass="album__img"[^>]*>/g)].map((m) => m[0]);
ok(imgs.length === 13, `thirteen row images (${imgs.length})`, 'the class= position moved?');
ok(
  imgs.length === 13 &&
    imgs.every((i) => /width="\d+"/.test(i) && /height="\d+"/.test(i)),
  'every row image carries width and height',
  imgs.filter((i) => !/width="\d+"/.test(i) || !/height="\d+"/.test(i)).length + ' without'
);
ok(
  imgs.length === 13 && imgs.every((i) => /sizes="[^"]+"/.test(i)),
  'every row image carries a sizes promise'
);

/* The first three load eagerly and the rest are lazy; the module promotes the
   next three ahead of the row as it turns. */
ok(
  imgs.length === 13 &&
    imgs.slice(0, 3).every((i) => /loading="eager"/.test(i)) &&
    imgs.slice(3).every((i) => /loading="lazy"/.test(i)),
  'first three eager, the rest lazy'
);

/* --- 3. the arrows ------------------------------------------------------- */

const arrows = [...album.matchAll(/<button class="album__arrow[^>]*>/g)].map((m) => m[0]);
ok(arrows.length === 2, `two arrows (${arrows.length})`);
ok(
  arrows.every((a) => /aria-label="[^"]+"/.test(a)),
  'both arrows carry an accessible name',
  arrows.filter((a) => !/aria-label="[^"]+"/.test(a)).join(' ')
);
ok(
  arrows.some((a) => /album__arrow--prev/.test(a)) && arrows.some((a) => /album__arrow--next/.test(a)),
  'one previous and one next'
);

/* --- 4. the lightbox ----------------------------------------------------- */

ok(/data-album-lightbox\b/.test(album), 'the lightbox is present');
ok(/data-album-lightbox-counter/.test(album), 'the lightbox has its own counter');
ok(/role="dialog"/.test(album) && /aria-modal="true"/.test(album), 'the lightbox is a dialog');
ok(/data-album-live/.test(album), 'the album has a live region for reader-initiated steps');

/* --- 5. the no-JS path --------------------------------------------------- */

const noJs = path.join(DIST, 'no-js-album.css');
ok(fs.existsSync(noJs), 'public/no-js-album.css ships into dist/');
ok(
  /<noscript>[\s\S]*?<link rel="stylesheet" href="\/no-js-album\.css"[\s\S]*?<\/noscript>/.test(html),
  'the head loads it inside a <noscript>'
);
if (fs.existsSync(noJs)) {
  const noJsCss = fs.readFileSync(noJs, 'utf8');
  ok(/\.album__figure\[hidden\]/.test(noJsCss), 'the no-JS sheet unhides every photograph');
  ok(/\.album__arrow\s*\{[^}]*display:\s*none/.test(noJsCss), 'the no-JS sheet switches the arrows off');
}

/* --- 6. the timings the design asks for ----------------------------------- */

/* These are read out of the module that ships rather than measured, because
   measuring a 1.4s interval a dozen times belongs in the browser suite. What
   belongs here is the thing a browser suite cannot catch: the constants
   drifting back out of band while nobody is watching the probe. */
const albumTs = (() => {
  const p = path.join(ROOT, 'src', 'scripts', 'album.ts');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
})();
const constant = (name) => Number(albumTs.match(new RegExp(`const ${name} = ([\\d.]+)`))?.[1]);

const STEP = constant('STEP_MS');
const TICK_MIN = constant('TICK_MIN');
const TICK_JITTER = constant('TICK_JITTER');
const FIRST_TICK = constant('FIRST_TICK_MS');
const VISIBLE_RATIO = constant('VISIBLE_RATIO');
const WARM_MARGIN = constant('WARM_MARGIN_PX');
const WARM_AHEAD = constant('WARM_AHEAD');

ok(albumTs.length > 0, 'the conveyor module is readable');
ok(
  STEP >= 300 && STEP <= 400,
  `the slide is ${STEP}ms, inside 300-400ms`
);
ok(
  TICK_MIN >= 1300 && TICK_MIN <= 1600 && TICK_MIN + TICK_JITTER <= 1600,
  `the interval is ${TICK_MIN}-${TICK_MIN + TICK_JITTER}ms, inside 1300-1600ms`
);
ok(
  FIRST_TICK > 0 && FIRST_TICK <= 300,
  `the first step begins ${FIRST_TICK}ms after arriving, inside 300ms`
);
ok(VISIBLE_RATIO >= 0.2 && VISIBLE_RATIO <= 0.3, `a quarter of the section starts it (${VISIBLE_RATIO})`);
ok(WARM_MARGIN === 800 && WARM_AHEAD === 6, `warm-up is 6 photographs, 800px out (${WARM_AHEAD} at ${WARM_MARGIN}px)`);

/* The finished loop: thirteen photographs, one step each, at the interval the
   constants ask for - which is what puts every photograph on screen inside
   about twenty seconds. */
const LOOP_S = (ALBUM_SIZE_LIT * (TICK_MIN + TICK_JITTER / 2)) / 1000;
ok(
  LOOP_S >= 17 && LOOP_S <= 21,
  `one loop of 13 photographs takes ${LOOP_S.toFixed(1)}s (about 20s) - every photograph is on screen within it`
);
const ON_SCREEN_S = (3 * (TICK_MIN + TICK_JITTER / 2)) / 1000;
ok(
  ON_SCREEN_S >= 3,
  `each photograph is on screen about ${ON_SCREEN_S.toFixed(1)}s across its three steps (at least 3s)`
);

/* --- 7. what each photograph costs --------------------------------------- */

/* The `sizes` promise decides which derivative the browser fetches, so the
   budget is checked against the candidate it would actually pick: the smallest
   srcset width that is at least the promised size. */
const pickCandidate = (img) => {
  const sizes = img.match(/sizes="([^"]+)"/)?.[1];
  const srcset = img.match(/srcset="([^"]+)"/)?.[1];
  if (!sizes || !srcset) return null;
  const first = sizes.split(',')[0].trim();
  // Only the first media condition is used here: it is the desktop one, and
  // the desktop one-third-of-a-row is what the budget is about.
  const px = parseInt(first.match(/(\d+)px/)?.[1] ?? '0', 10);
  const candidates = srcset
    .split(',')
    .map((c) => c.trim().split(/\s+/))
    .map(([url, w]) => ({ url, w: parseInt(w, 10) }))
    .filter((c) => Number.isFinite(c.w))
    .sort((a, b) => a.w - b.w);
  return candidates.find((c) => c.w >= px) ?? candidates[candidates.length - 1];
};

const BUDGET = 300 * 1024;
let worst = { size: 0, url: '' };
let total = 0;
let checked = 0;
for (const img of imgs) {
  const c = pickCandidate(img);
  if (!c) continue;
  const file = path.join(DIST, decodeURIComponent(c.url.split('?')[0]).replace(/^\//, ''));
  if (!fs.existsSync(file)) continue;
  const size = fs.statSync(file).size;
  checked++;
  total += size;
  if (size > worst.size) worst = { size, url: c.url };
}
ok(checked > 0 && checked === imgs.length, `measured ${checked} of ${imgs.length} row derivatives against their srcset promise`, 'some srcset candidate was not on disk');
ok(
  checked > 0 && worst.size < BUDGET,
  `largest row derivative is ${(worst.size / 1024).toFixed(0)} KB, under 300 KB`,
  worst.url
);
console.log(
  `        ${checked} derivatives, ${(total / 1024).toFixed(0)} KB for every photograph on the row`
);

/* The lightbox uses one larger derivative each; those are not on the row and
   are fetched on demand, but the original must never be one of them. */
const big = [...album.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
ok(
  !big.some((u) => /\.jpe?g(\?|$)/.test(u) && /orig/i.test(u)),
  'no lightbox link points at an original'
);

if (failures) {
  console.log(`\nFAIL  ${failures} album check(s) failed`);
  process.exit(1);
}
console.log(`\nPASS  album: ${figures.length} photographs, ${arrows.length} arrows, ${checked} derivatives`);

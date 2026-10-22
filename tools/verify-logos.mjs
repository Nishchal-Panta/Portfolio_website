/**
 * Build-failing checks for the logo specimen board.
 *
 * Pure Node, no browser. That is deliberate: `npm run build` runs on a CI
 * runner that has never installed a Playwright browser, and a verification
 * step that cannot run there would either be skipped (and so mean nothing) or
 * take the deploy down. Everything the brief asks for can be decided from the
 * files themselves:
 *
 *   1  every logo file is a valid, local SVG
 *   2  no request goes to an external logo host at runtime
 *   3  every item shows its name as text
 *   4  every item exists in the skills source, and nothing was added
 *   5  logos/CREDITS has a row for every logo file
 *   6  names and marks clear WCAG AA in both themes, and a brand colour only
 *      appears where it is still a graphical object at 3:1
 *
 * "No request" means a resource the page fetches on load: src, srcset, poster,
 * data, script src, a stylesheet or preload link, or a CSS url()/@import. The
 * source URLs in the credits table are citations inside <a href>, which the
 * brief asks to be recorded and which nothing fetches; they are printed by the
 * check so the distinction is visible rather than assumed.
 *
 *   npm run verify:logos
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const LOGOS = join(ROOT, 'src', 'assets', 'logos');
const DIST = join(ROOT, 'dist');

const fails = [];
const notes = [];
const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg) => {
  fails.push(msg);
  console.log(`  FAIL  ${msg}`);
};
const note = (msg) => {
  notes.push(msg);
  console.log(`  note  ${msg}`);
};

/* ------------------------------------------------------------------ colour */

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const parseHex = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) throw new Error(`not a 6-digit hex: ${h}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** color-mix(in srgb, ACCENT 4%, transparent) composited over `base`. */
const hoverTint = (base, accent) =>
  base.map((c, i) => Math.round(c * 0.96 + accent[i] * 0.04));
const round2 = (n) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------- 1. the files */

console.log('\n1  logo files are valid, local SVGs');

const files = readdirSync(LOGOS)
  .filter((f) => f.endsWith('.svg'))
  .sort();

if (!files.length) bad(`no SVGs found in ${LOGOS}`);

for (const f of files) {
  const raw = readFileSync(join(LOGOS, f), 'utf8');
  const svg = raw.trim();

  if (!svg.startsWith('<svg')) bad(`${f}: does not start with <svg`);
  if (!svg.endsWith('</svg>')) bad(`${f}: does not end with </svg>`);
  if (!/viewBox="[-\d.]+ [-\d.]+ [\d.]+ [\d.]+"/.test(svg)) bad(`${f}: no usable viewBox`);
  if (/<script/i.test(svg)) bad(`${f}: contains a <script>`);
  if (/<(foreignObject|iframe|image|animate)/i.test(svg)) bad(`${f}: contains an active element`);
  if (/<!ENTITY/i.test(svg)) bad(`${f}: contains an ENTITY (XXE risk)`);
  if (/\bstyle=| class=| role=|<title/i.test(svg)) bad(`${f}: carries style/class/title that should have been cleaned`);

  // Not a real XML parser, but the failure mode we care about is an edit that
  // left the document unbalanced or appended after the root element.
  const opens = (svg.match(/<[a-zA-Z]/g) || []).length;
  const closes = (svg.match(/<\//g) || []).length + (svg.match(/\/>/g) || []).length;
  if (opens !== closes) bad(`${f}: tag balance ${opens} open vs ${closes} close`);

  const paths = svg.match(/<path\b/g) || [];
  if (!paths.length) bad(`${f}: has no <path>`);
  const uncoloured = (svg.match(/<path\b[^>]*>/g) || []).filter(
    (t) => !/fill="currentColor"/.test(t)
  );
  if (uncoloured.length) bad(`${f}: ${uncoloured.length} path(s) without fill="currentColor"`);

  // A namespace declaration is not a reference to anything the page fetches.
  const remote = (svg.match(/(href|xlink:href|src)="https?:\/\/[^"]+"/g) || []).filter(
    (t) => !t.includes('www.w3.org')
  );
  if (remote.length) bad(`${f}: points at ${remote.join(', ')}`);
}

ok(`${files.length} SVGs: well-formed, viewBox present, single-path fill, no scripts, no remote references`);

/* ------------------------------------------------- 2. nothing is hotlinked */

console.log('\n2  no network request to an external logo host');

const readPage = (p) => {
  const candidates = [join(p, 'index.html'), `${p}.html`];
  for (const c of candidates) if (existsSync(c)) return readFileSync(c, 'utf8');
  return null;
};

const index = readPage(DIST);
if (!index) bad(`dist/index.html is missing - run the build first`);

const creditsPath = join(DIST, 'logos', 'CREDITS');
const credits = readPage(creditsPath);
if (!credits) bad(`dist/logos/CREDITS is missing`);

const cssFiles = existsSync(join(DIST, '_astro'))
  ? readdirSync(join(DIST, '_astro'))
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(DIST, '_astro', f), 'utf8'))
  : [];
if (!cssFiles.length) note('no built CSS found under dist/_astro');

const allPages = [index, credits].filter(Boolean).join('\n');
const allCss = cssFiles.join('\n');

const resourceTag =
  /<(?:img|source|script|iframe|video|audio|embed|object|track)\b[^>]*?\b(?:src|srcset|poster|data)="(https?:\/\/[^"]+)"/gi;
const linkRel =
  /<link\b[^>]*?rel="(?:stylesheet|preload|prefetch|modulepreload|dns-prefetch|preconnect)"[^>]*?href="(https?:\/\/[^"]+)"/gi;
const cssUrl = /(?:url\(\s*['"]?|@import\s+['"])(https?:\/\/[^'")]+)/gi;

const offenders = [];
for (const [re, hay] of [
  [resourceTag, allPages],
  [linkRel, allPages],
  [cssUrl, allCss + allPages],
]) {
  for (const m of hay.matchAll(re)) offenders.push(m[1]);
}
if (offenders.length) bad(`remote resources: ${[...new Set(offenders)].join(', ')}`);
else ok('no src, srcset, script, stylesheet, preload or CSS url() points off-origin');

if (!/<img\b[^>]*logos\//i.test(allPages)) ok('the marks are inlined, not fetched as <img>');
else bad('a logo is referenced as <img src="logos/...">, which would be a second request');

const inlined = (allPages.match(/class="tile__glyph"/g) || []).length;
if (inlined === files.length) ok(`all ${inlined} marks are present as inline <svg>`);
else bad(`expected ${files.length} inline marks, found ${inlined}`);

const citations = [
  ...new Set([...allPages.matchAll(/<a\b[^>]*?href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1])),
];
note(
  `citation links (fetch nothing on load): ${citations.length} - ` +
    citations.slice(0, 6).join(' ').slice(0, 240)
);

/* ------------------------------------------------- 3 and 4. every item there */

console.log('\n3  every item shows its name, and exists in the skills source');

const skills = JSON.parse(readFileSync(join(ROOT, 'src', 'content', 'skills.json'), 'utf8'));
const source = new Set(skills.groups.flatMap((g) => g.items));

const tiles = [...(index || '').matchAll(/<li class="tile"([\s\S]*?)<\/li>/g)].map((m) => {
  const body = m[1];
  const nameM = /<p class="tile__name">([\s\S]*?)<\/p>/.exec(body);
  const name = (nameM ? nameM[1] : '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const markM = /data-mark="([^"]+)"/.exec(body);
  const brandM = /--brand:\s*(#[0-9a-f]{6})/i.exec(body);
  const onM = /data-brand-on="([^"]+)"/.exec(body);
  return {
    name,
    mark: markM ? markM[1] : null,
    brand: brandM ? brandM[1].toLowerCase() : null,
    brandOn: onM ? onM[1] : null,
    ariaHidden: /class="tile__glyph" aria-hidden="true"/.test(body),
    href: /<a href="([^"]+)"/.exec(body)?.[1] ?? null,
    context: (/<p class="tile__context">([\s\S]*?)<\/p>/.exec(body)?.[1] ?? '').trim(),
  };
});

if (tiles.length !== 32) bad(`expected 32 tiles in the built page, found ${tiles.length}`);
else ok('32 tiles rendered');

const blank = tiles.filter((t) => !t.name);
if (blank.length) bad(`${blank.length} tile(s) with no visible name`);
else ok('every item shows its name as text');

const marked = tiles.filter((t) => t.mark);
const unmarked = tiles.filter((t) => !t.mark);
for (const t of marked) if (!t.ariaHidden) bad(`${t.name}: mark is not aria-hidden`);
ok(`${marked.length} items carry a mark, ${unmarked.length} are text-only`);

const names = tiles.map((t) => t.name);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length) note(`duplicate labels kept from LinkedIn: ${[...new Set(dupes)].join(', ')}`);

const built = new Set(names);
const missing = [...source].filter((n) => !built.has(n));
const added = [...built].filter((n) => !source.has(n));
if (missing.length) bad(`in skills.json but not on the board: ${missing.join(', ')}`);
if (added.length) bad(`on the board but not in skills.json (invented): ${added.join(', ')}`);
if (!missing.length && !added.length)
  ok(`the board is exactly the ${source.size} items in skills.json - none added, none dropped`);

/* ---------------------------------------------- 5. the credits has every row */

console.log('\n5  logos/CREDITS has a row for every logo file');

const stems = files.map((f) => f.replace(/\.svg$/, ''));
const credited = stems.filter((s) => (credits || '').includes(`src/assets/logos/${s}.svg`));
const uncredited = stems.filter((s) => !credited.includes(s));
if (uncredited.length) bad(`no credits row for: ${uncredited.join(', ')}`);
else ok(`all ${stems.length} files appear in the credits table`);

const boardFiles = new Set(marked.map((t) => t.mark));
const orphan = stems.filter((s) => !boardFiles.has(s));
const ghost = [...boardFiles].filter((s) => !stems.includes(s));
if (orphan.length) bad(`logo file not used by any item: ${orphan.join(', ')}`);
if (ghost.length) bad(`item references a file that does not exist: ${ghost.join(', ')}`);
if (!orphan.length && !ghost.length) ok('every file is used and every used file exists');

for (const t of marked) {
  if (!credits.includes(`${t.name}</th>`)) bad(`credits table has no row for ${t.name}`);
}

const licenceHits = (credits || '').match(/CC0|MIT/g) || [];
if (licenceHits.length) ok(`credits table records licences (${licenceHits.length} mentions)`);
else bad('credits table records no licence');

/* ------------------------------------------------------- 6. contrast, AA */

console.log('\n6  contrast in both themes');

const tokens = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8');
const block = (selector) => {
  const i = tokens.indexOf(selector);
  if (i < 0) throw new Error(`tokens.css has no ${selector}`);
  const open = tokens.indexOf('{', i);
  let depth = 0;
  for (let k = open; k < tokens.length; k++) {
    if (tokens[k] === '{') depth++;
    else if (tokens[k] === '}') {
      depth--;
      if (!depth) return tokens.slice(open, k);
    }
  }
  throw new Error(`unterminated block for ${selector}`);
};
const tok = (text, name) => {
  const m = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(text);
  if (!m) throw new Error(`${name} not found`);
  return parseHex(m[1]);
};

const themes = {
  light: block(':root {'),
  dark: block("[data-theme='dark']"),
};

const backgrounds = {};
for (const [name, text] of Object.entries(themes)) {
  const surface = tok(text, '--surface');
  const bg = tok(text, '--bg');
  const accent = tok(text, '--accent');
  backgrounds[name] = {
    surface,
    bg,
    hovered: hoverTint(surface, accent),
    text: tok(text, '--text'),
    muted: tok(text, '--text-muted'),
    accent,
  };
}

for (const [name, t] of Object.entries(backgrounds)) {
  const pairs = [
    ['item name (--text on --surface)', t.text, t.surface, 4.5],
    ['context / caption (--text-muted on --surface)', t.muted, t.surface, 4.5],
    ['context when hovered (on the tinted tile)', t.muted, t.hovered, 4.5],
    ['group filter (--text-muted on --bg)', t.muted, t.bg, 4.5],
  ];
  for (const [what, fg, bgs, need] of pairs) {
    const r = contrast(fg, bgs);
    if (r < need) bad(`${name}: ${what} is ${round2(r)}:1, needs ${need}:1`);
    else ok(`${name}: ${what} = ${round2(r)}:1`);
  }
}

/* Brand colour: a mark is a graphical object and needs 3:1 (WCAG 1.4.11).
   On hover the tile takes a 4% accent wash, so the mark is measured against
   that too - it is the harder of the two and the one that is actually on
   screen when the colour appears. */
console.log('\n6b  brand colour only where it clears 3:1');

const seenBrands = new Map();
for (const t of marked) {
  if (!t.brand || !t.brandOn) continue;
  if (!['both', 'light', 'dark'].includes(t.brandOn)) {
    bad(`${t.name}: data-brand-on="${t.brandOn}" is not one of both|light|dark`);
    continue;
  }
  const rgb = parseHex(t.brand);
  const claimed = t.brandOn === 'both' ? ['light', 'dark'] : [t.brandOn];
  const dropped = t.brandOn === 'both' ? [] : ['light', 'dark'].filter((d) => d !== t.brandOn);

  for (const th of claimed) {
    const plain = contrast(rgb, backgrounds[th].surface);
    const tinted = contrast(rgb, backgrounds[th].hovered);
    const worst = Math.min(plain, tinted);
    if (worst < 3) {
      bad(
        `${t.name}: brand ${t.brand} claimed on ${th} but only ${round2(worst)}:1 ` +
          `on that theme (needs 3:1)`
      );
    } else {
      seenBrands.set(`${t.name}|${th}`, round2(worst));
    }
  }

  for (const th of dropped) {
    const r = Math.min(
      contrast(rgb, backgrounds[th].surface),
      contrast(rgb, backgrounds[th].hovered)
    );
    if (r >= 3) {
      note(
        `${t.name}: brand ${t.brand} would be ${round2(r)}:1 on ${th} too - ` +
          `restricting it to ${t.brandOn} is stricter than it needs to be`
      );
    }
  }
}

ok(
  `${seenBrands.size} brand/theme pairs checked, all >= 3:1 on the theme they appear on`
);

const brandCss = cssFiles.join('\n');
if (/tile__glyph[^}]*transition/.test(brandCss)) ok('the mark transitions colour only (no transform cost)');
if (!/\.tile__glyph\s*\{[^}]*background/.test(brandCss)) ok('marks are ink-coloured by token, not baked');

/* ------------------------------------------------------ 6c. the context lines */

/*
 * Every hover line has to be traceable to something the page already says, and
 * the ones that have nothing must stay empty rather than be filled in. Both
 * halves are listed every time the build runs, so an invented sentence would
 * have to be added to this list on purpose.
 */

console.log('\n6c  hover context, and what has none');

const withContext = tiles.filter((t) => t.context);
const without = tiles.filter((t) => !t.context);

console.log(`\n  ${withContext.length} with a verified line:`);
for (const t of withContext) {
  if (!t.href) bad(`${t.name}: has a context line but no link to check it against`);
  else console.log(`    ${t.name.padEnd(27)} -> ${t.href.padEnd(11)} ${t.context}`);
}

console.log(`\n  ${without.length} showing nothing:`);
console.log(`    ${without.map((t) => t.name).join(', ')}`);

// A context that duplicates the item's own name says nothing and should not
// have been written.
for (const t of withContext) {
  const plain = t.context.replace(/[.,]$/, '').toLowerCase();
  if (plain === t.name.toLowerCase()) bad(`${t.name}: its context line just repeats the name`);
}

/* ------------------------------------------- 6d. every link lands somewhere */

/*
 * A tile that links to a credential is only honest if the ledger actually has
 * that row, because the reader is promised a document. Anchors are written by
 * hand in logos.ts while ids are generated from the collection's file names,
 * so the two drift apart silently: this resolves each one against the built
 * page rather than trusting that they were typed the same way twice.
 *
 * The second half is the same idea applied to the styling. A hover wash and a
 * lift tell the pointer something is clickable, so they are gated on the tile
 * carrying an anchor at all. Without this check the gate could be dropped by a
 * later edit and the tiles that go nowhere would start promising a destination
 * again, with nothing in the build noticing.
 */

console.log('\n6d  every tile link lands on an id the page really has');

const pageIds = new Set([...(index || '').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const linkedTiles = tiles.filter((t) => t.href);
let landed = 0;
let credLinks = 0;

for (const t of linkedTiles) {
  if (!t.href.startsWith('#')) {
    bad(`${t.name}: links off-page to ${t.href} - tile links are in-page anchors`);
    continue;
  }
  const target = t.href.slice(1);
  if (!pageIds.has(target)) bad(`${t.name}: links to ${t.href}, which no element on the page has`);
  else {
    landed += 1;
    if (target.startsWith('cred-')) credLinks += 1;
  }
}

ok(
  `${landed} of ${linkedTiles.length} tile links resolve, ` +
    `${credLinks} of them to a certificate row in Proof`
);

// Every hover rule that touches the plate or the mark has to carry :has(a).
const tileSelectors = brandCss
  .split(/[{}]/)
  .map((s) => s.trim())
  .filter((s) => /\.tile/.test(s) && !s.startsWith('@'));

const affordance = tileSelectors.filter(
  (s) => /\.tile__(plate|glyph)/.test(s) && /:hover|:focus-within/.test(s)
);
const ungated = affordance.filter((s) => !s.includes(':has(a)'));
for (const s of ungated) bad(`hover affordance with no link gate: ${s.replace(/\s+/g, ' ')}`);

if (affordance.length && !ungated.length) {
  ok(`${affordance.length} hover affordance rule(s) all gated on the tile having a link`);
}

/* ------------------------------------------- 6e. a cited line is in the record */

/*
 * A context that names a credential is a claim about a document, and the only
 * reason it is on the page is that the document backs it. The date, the course
 * title and the issuer are all in the ledger's own JSON, so the line can be
 * checked rather than trusted: it has to contain one of them verbatim.
 *
 * This is what stops "DataCamp, completed 17 Jan 2026, 4 hours" from quietly
 * becoming a rounded or misremembered version of it - the row is the source,
 * and the tile is not allowed to say anything the row does not. The issuer is
 * taken out first, because a line that only repeats "DataCamp" would otherwise
 * satisfy the check while saying nothing about the certificate.
 */

console.log('\n6e  every cited credential line appears in that credential');

const decode = (s) =>
  s
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

let cited = 0;
for (const t of tiles) {
  if (!t.href || !t.href.startsWith('#cred-')) continue;
  const id = t.href.slice('#cred-'.length);
  let rec;
  try {
    rec = JSON.parse(
      readFileSync(join(ROOT, 'src', 'content', 'credentials', `${id}.json`), 'utf8')
    );
  } catch {
    bad(`${t.name}: cites ${t.href}, but src/content/credentials/${id}.json does not exist`);
    continue;
  }
  cited++;
  // The issuer alone would make the check vacuous - every DataCamp line says
  // "DataCamp" - so the issuer is stripped first and whatever is left has to
  // be a piece of the course title or the completion line.
  const line = decode(t.context).toLowerCase();
  const issuer = String(rec.issuer ?? '').toLowerCase();
  const rest = (issuer ? line.replace(issuer, ' ') : line)
    .replace(/^[,\s]+/, '')
    .replace(/[.,\s]+$/, '')
    .trim();
  const record = [rec.name, rec.dateLabel].filter(Boolean).map((s) => String(s).toLowerCase());

  if (!rest) bad(`${t.name}: "${decode(t.context)}" for ${id} says only who issued it`);
  else if (
    !record.some((frag) => rest.includes(frag) || (rest.length >= 6 && frag.includes(rest)))
  ) {
    bad(
      `${t.name}: "${decode(t.context)}" for ${id} - after the issuer nothing left ` +
        `matches the record (name "${rec.name}", "${rec.dateLabel}")`
    );
  }
}
ok(`${cited} credential context line(s) traceable to their own record`);

/* ------------------------------------------------------- 7. every mark is there */

/*
 * Section 7 used to gate on "optical balance", equalising the marks' ink area
 * across the board. That gate has been removed, and this replaces it with
 * something checkable, because the premise was wrong twice over.
 *
 * The first measurement said the marks varied 2.98x in visual weight. It was
 * measuring the inline SVG's own box in Chrome, which reports 24x24 for every
 * file regardless of what is drawn in it, so the "spread" was the CSS heights
 * being compared against each other. Rasterising the files and measuring
 * non-transparent pixels instead puts the real bounding-box spread at 1.70x.
 *
 * The second error was treating that 1.70x as a defect. It is the opposite: a
 * mark that fills its viewBox has to be the same box height as one that does
 * not, and the one that fills it will then carry more ink - because that is
 * what the logo looks like. The build went on to shrink mysql, aws and pandas
 * to compensate, which is both a distortion of the mark and the reason they
 * read as the weakest things on their own plates.
 *
 * So what is worth failing a build over is bounded, and there are three:
 *   the CSS must not assign a size to a mark that no longer exists,
 *   no mark may be scaled small enough to stop being legible as a mark,
 *   and nothing may be sized differently from the rest of its row.
 */

console.log('\n7  every mark is sized and present');

/* Ink bounds, kept as a record rather than as a live measurement. They were
   taken once in a browser - rasterise each file at 512px, take the bounding
   box of pixels with alpha > 8 - and the probe that did it has been retired,
   because the build must stay browser-free to run in CI. Nothing here derives
   a decision from these numbers except the legibility floor below; they exist
   so the next person to consider hand-tuning a mark's height can see what the
   artwork actually is before they start. */
const INK = {
  /* mark: [ink w, ink h, box area %, ink fill %] in viewBox units of 24 */
  aws: [23.81, 14.25, 58.9, 33],
  css3: [20.72, 23.53, 84.6, 65],
  git: [24.0, 24.0, 100.0, 46],
  github: [24.0, 23.44, 97.7, 44],
  html5: [21.0, 24.0, 87.5, 63],
  huggingface: [24.0, 21.75, 90.6, 65],
  java: [17.3, 23.44, 70.4, 17],
  laravel: [23.34, 24.0, 97.3, 22],
  mysql: [24.0, 16.31, 68.0, 17],
  pandas: [15.09, 24.0, 62.9, 46],
  python: [24.0, 24.0, 100.0, 64],
  pytorch: [19.97, 24.0, 83.2, 28],
};

const css = cssFiles.join('\n');

/* Every mark gets the same CSS height. A table of hand-tuned per-mark heights
   is exactly the thing that produced the problem, so its absence is asserted
   rather than assumed. */
const glyphRule = /[^{}]*\.tile__glyph\s*\{[^}]*\}/g;
const glyphBlock = (css.match(glyphRule) || []).join('\n');
const markHeights = [...glyphBlock.matchAll(/\[data-mark='([^']+)'\][^{]*\.tile__glyph[^{]*\{([^}]*)\}/g)]
  .filter((m) => /height/.test(m[2]))
  .map((m) => m[1]);

if (markHeights.length) {
  bad(
    `the stylesheet still sizes ${markHeights.length} mark(s) individually ` +
      `(${markHeights.join(', ')}), which is what made the row uneven`
  );
} else {
  ok('no mark is sized individually - one height for the whole board');
}

const baseH = parseFloat(/\.tile__glyph\s*\{[^}]*height:\s*([\d.]+)rem/.exec(glyphBlock)?.[1] ?? 'NaN');
if (Number.isNaN(baseH)) bad('no .tile__glyph height rule found in the built CSS');
else ok(`one glyph height across the board: ${baseH}rem`);

/* A mark must not be scaled down to the point that it stops reading. Measured
   as its drawn height against the slot it sits in. */
const slotRule = /\.tile__slot\s*\{[^}]*\}/.exec(css);
const slotH = slotRule ? parseFloat(/height:\s*([\d.]+)rem/.exec(slotRule[1])?.[1] ?? 'NaN') : NaN;

const small = [];
for (const t of marked) {
  if (!t.mark) continue;
  const ink = INK[t.mark];
  if (!ink) {
    bad(
      `${t.name}: ${t.mark} has no ink record. The table above was measured once in a ` +
        `browser by rasterising each file at 512px and taking the bounding box of pixels ` +
        `with alpha > 8, then retired - it is a record, not a step in the build.`
    );
    continue;
  }
  const drawn = (ink[1] / 24) * baseH;
  if (drawn < 0.9) {
    small.push(`${t.name} draws ${(drawn * 16).toFixed(1)}px tall`);
  }
}
if (small.length) bad(`marks too small to read: ${small.join('; ')}`);
else ok(`every mark draws at least ${(0.9 * baseH * 16).toFixed(0)}px tall, at its own measured ink height`);

/* The spread in drawn size across the board, reported rather than corrected. */
const drawnH = marked
  .filter((t) => t.mark && INK[t.mark])
  .map((t) => ({ mark: t.mark, h: (INK[t.mark][1] / 24) * baseH }));
const tallest = drawnH.reduce((a, b) => (b.h > a.h ? b : a));
const shortest = drawnH.reduce((a, b) => (b.h < a.h ? b : a));
ok(
  `drawn height spread ${(tallest.h / shortest.h).toFixed(2)}x ` +
    `(${tallest.mark} ${tallest.h.toFixed(2)}rem to ${shortest.mark} ${shortest.h.toFixed(2)}rem), ` +
    `from the artwork and left alone`
);

console.log(`\n${'='.repeat(66)}`);
if (fails.length) {
  console.log(`FAILED: ${fails.length} problem(s)`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('PASS: the logo board satisfies every check in the brief');
}
if (notes.length) {
  console.log(`\n${notes.length} note(s), not failures:`);
  for (const n of notes) console.log(`  - ${n}`);
}

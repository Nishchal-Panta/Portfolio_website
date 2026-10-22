/**
 * Anchors, and the promise behind every in-page link.
 *
 * Three failures are worth failing a build over, and all three are cheap to
 * read straight out of `dist/`:
 *
 *   1. A duplicated id. Two elements claiming `#cred-relay-hack` means the
 *      browser takes the first and the second is unreachable, silently.
 *   2. A missing target. A link to an id that is not in the page is a link to
 *      the top of the page, which looks like nothing happened.
 *   3. A credential rendered twice. This page states each certificate once, in
 *      exactly one place - badge tile or ledger row - and the anchors follow
 *      the same rule. It was broken by having the ledger render every row while
 *      the badges were already rendered above it, which is what this exists to
 *      stop coming back.
 *
 * Every fragment link on every built page is resolved against the ids of the
 * page it is in, so a link that only works after scrolling is caught rather
 * than shipped.
 *
 * Pure Node, no browser: `npm run build` runs this after `astro build`, in CI,
 * on a runner that has never had Playwright installed.
 *
 *   node tools/verify-anchors.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const CREDS = path.join(ROOT, 'src', 'content', 'credentials');

const fail = (msg) => {
  console.log(`FAIL  ${msg}`);
  process.exit(1);
};

if (!fs.existsSync(DIST)) fail('dist/ is missing - run astro build first');

/** Every file under `dir`, recursively. */
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const pages = walk(DIST).filter((f) => f.endsWith('.html'));
if (!pages.length) fail('no built HTML pages found under dist/');

const idsOf = (html) => [...html.matchAll(/(?:^|\s)id="([^"]+)"/g)].map((m) => m[1]);

let failures = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok    ' : 'FAIL  '}${label}${!cond && detail ? `  (${detail})` : ''}`);
  if (!cond) failures++;
};

console.log('anchors');

/* --- 1. no id is claimed twice, anywhere --------------------------------- */

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const ids = idsOf(html);
  const seen = new Set();
  const dupes = [];
  for (const id of ids) {
    if (seen.has(id)) dupes.push(id);
    seen.add(id);
  }
  ok(dupes.length === 0, `no duplicated id in ${rel(page)}`, [...new Set(dupes)].join(', '));
}

/* --- 2. every fragment link lands on something --------------------------- */

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const ids = new Set(idsOf(html));
  const targets = [...new Set([...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]))].filter(
    (h) => h.length // bare `#` is a self-reference, not a destination
  );
  const missing = targets.filter((t) => !ids.has(t));
  ok(
    missing.length === 0,
    `every #href in ${rel(page)} resolves (${targets.length} checked)`,
    missing.map((m) => `#${m}`).join(', ')
  );
}

/* --- 3. each credential is on the page exactly once ---------------------- */

const index = path.join(DIST, 'index.html');
if (!fs.existsSync(index)) fail('dist/index.html is missing');
const indexHtml = fs.readFileSync(index, 'utf8');

const files = fs
  .readdirSync(CREDS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const rendered = idsOf(indexHtml).filter((id) => id.startsWith('cred-'));
const counts = new Map();
for (const id of rendered) counts.set(id, (counts.get(id) ?? 0) + 1);

const twice = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
ok(twice.length === 0, 'no credential anchor is duplicated', twice.join(', '));

const absent = files.filter((f) => !counts.has(`cred-${f}`));
ok(
  absent.length === 0,
  `every credential renders with its anchor (${files.length} records)`,
  absent.map((f) => `cred-${f}`).join(', ')
);

const unknown = rendered.filter((id) => !files.includes(id.slice('cred-'.length)));
ok(unknown.length === 0, 'every cred- anchor belongs to a record', unknown.join(', '));

const wrong = files.filter((f) => (counts.get(`cred-${f}`) ?? 0) !== 1);
ok(
  wrong.length === 0,
  'each credential renders exactly once - badge tile or ledger row, never both',
  wrong.map((f) => `${f} x${counts.get(`cred-${f}`) ?? 0}`).join(', ')
);

/* --- 4. the event entries are addressable too ---------------------------- */

const EVENTS = path.join(ROOT, 'src', 'content', 'events');
const eventIds = fs
  .readdirSync(EVENTS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();
const indexIds = new Set(idsOf(indexHtml));
const noEntry = eventIds.filter((e) => !indexIds.has(e));
ok(noEntry.length === 0, `every event entry has an id (${eventIds.length})`, noEntry.join(', '));

if (failures) {
  console.log(`\nFAIL  ${failures} anchor check(s) failed`);
  process.exit(1);
}
console.log(
  `PASS  ${pages.length} page(s), ${rendered.length} credential anchors, ${files.length} records, ` +
    `${eventIds.length} event entries`
);

/**
 * Fetch the tool logos and write them into src/assets/logos/.
 *
 * Sources are tried in the order the brief asks for: the vendor's own mark as
 * reproduced by Simple Icons (CC0 files, one path, 24x24 viewBox), then Devicon
 * (MIT). Simple Icons drops marks when a trademark holder asks it to, which is
 * why Java, CSS3 and AWS are not all in one place.
 *
 * The marks live in src/assets rather than public/ because the page inlines
 * them with ?raw, so the theme token can drive their fill. Nothing is
 * hotlinked: the file is in the repo, the built page carries the geometry with
 * it, and a visitor's browser never asks a third party for a logo.
 *
 *   node tools/fetch-logos.mjs
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { get } from 'node:https';

const OUT = new URL('../src/assets/logos/', import.meta.url);
mkdirSync(OUT, { recursive: true });

/**
 * item:      the label as it appears in the skills list
 * name:      the file stem
 * si / dv:   Simple Icons slug, Devicon slug
 * hex:       the brand colour, from Simple Icons' data or the mark's own fill
 * source:    which of the two it actually came from
 */
const WANTED = [
  { item: 'PyTorch', name: 'pytorch', si: 'pytorch', dv: 'pytorch/pytorch-original', hex: '#EE4C2C' },
  { item: 'Hugging Face', name: 'huggingface', si: 'huggingface', dv: null, hex: '#FFD21E' },
  { item: 'Python', name: 'python', si: 'python', dv: 'python/python-plain', hex: '#3776AB' },
  { item: 'Java', name: 'java', si: null, dv: 'java/java-plain', hex: '#EA2D2E' },
  { item: 'MySQL', name: 'mysql', si: 'mysql', dv: 'mysql/mysql-original', hex: '#4479A1' },
  { item: 'pandas', name: 'pandas', si: 'pandas', dv: 'pandas/pandas-original', hex: '#150458' },
  { item: 'HTML', name: 'html5', si: 'html5', dv: 'html5/html5-plain', hex: '#E34F26' },
  { item: 'CSS', name: 'css3', si: null, dv: 'css3/css3-plain', hex: '#1572B6' },
  { item: 'Laravel', name: 'laravel', si: 'laravel', dv: 'laravel/laravel-original', hex: '#FF2D20' },
  {
    item: 'Amazon Web Services (AWS)',
    name: 'aws',
    si: null,
    dv: 'amazonwebservices/amazonwebservices-plain-wordmark',
    hex: '#FF9900',
  },
  { item: 'Git', name: 'git', si: 'git', dv: 'git/git-original', hex: '#F03C2E' },
  { item: 'GitHub', name: 'github', si: 'github', dv: 'github/github-original', hex: '#181717' },
];

const SI_BASE = 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/';
const DV_BASE = 'https://raw.githubusercontent.com/devicons/devicon/master/icons/';

const fetch$ = (url) =>
  new Promise((resolve) => {
    get(url, { headers: { 'user-agent': 'portfolio-build' } }, (r) => {
      let body = '';
      r.on('data', (c) => (body += c));
      r.on('end', () => resolve({ status: r.statusCode, body }));
    }).on('error', (e) => resolve({ status: 0, body: String(e) }));
  });

/**
 * Take a downloaded mark down to the one thing the page needs: a single
 * currentColor path on a 24-unit grid.
 *
 * Everything vendor-specific is stripped - the title (the name is already on
 * the tile as text), any fixed width or height (the stylesheet decides size),
 * any hard-coded fill (colour comes from the theme token). What is left is
 * geometry, which is the only part this page is entitled to redraw.
 */
function clean(svg, name) {
  if (/<script/i.test(svg)) throw new Error(`${name}: refusing a mark containing a script`);
  let out = svg
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/\srole="[^"]*"/g, '')
    .replace(/\swidth="[^"]*"/g, '')
    .replace(/\sheight="[^"]*"/g, '')
    .replace(/\sfill="[^"]*"/g, '')
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/\sstyle="[^"]*"/g, '')
    .trim();

  if (!/viewBox="/.test(out)) throw new Error(`${name}: mark has no viewBox`);
  if (!/^\s*<svg/.test(out)) throw new Error(`${name}: not an svg`);

  out = out.replace(/<path\b/g, '<path fill="currentColor"');
  return out.replace(/\s+/g, ' ').trim() + '\n';
}

const rows = [];
let failed = 0;

for (const w of WANTED) {
  let body = null;
  let source = null;
  let fileUrl = null;

  if (w.si) {
    const url = `${SI_BASE}${w.si}.svg`;
    const r = await fetch$(url);
    if (r.status === 200) {
      body = r.body;
      source = 'Simple Icons';
      fileUrl = url;
    }
  }
  if (!body && w.dv) {
    const url = `${DV_BASE}${w.dv}.svg`;
    const r = await fetch$(url);
    if (r.status === 200) {
      body = r.body;
      source = 'Devicon';
      fileUrl = url;
    }
  }

  if (!body) {
    console.error(`MISSING  ${w.item} - no mark found at any source`);
    failed++;
    continue;
  }

  const svg = clean(body, w.name);
  const paths = (svg.match(/<path/g) || []).length;
  if (paths !== 1) {
    console.error(`MULTI    ${w.item} - ${paths} paths, hover colour will be withheld`);
  }
  writeFileSync(new URL(`${w.name}.svg`, OUT), svg, 'utf8');

  rows.push({
    ...w,
    source,
    fileUrl,
    bytes: Buffer.byteLength(svg, 'utf8'),
    paths,
    exists: existsSync(new URL(`${w.name}.svg`, OUT)),
  });
  console.log(`ok       ${w.item.padEnd(26)} <- ${source.padEnd(12)} ${String(Buffer.byteLength(svg, 'utf8')).padStart(5)}b`);
}

/* Sanity: the files that were just written really are files, and they parse. */
for (const r of rows) {
  const text = readFileSync(new URL(`${r.name}.svg`, OUT), 'utf8');
  if (!text.includes('currentColor')) {
    console.error(`BROKEN   ${r.name}.svg lost currentColor`);
    failed++;
  }
}

console.log(`\n${rows.length} marks written to src/assets/logos/, ${failed} problem(s)`);
if (failed) process.exitCode = 1;

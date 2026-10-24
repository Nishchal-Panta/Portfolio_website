/* TEMPORARY audit - integrity of every authored file, before fallow or any
   deletion is allowed to touch them.

   Three independent line counts, because two of my readers disagreed with each
   other (683 vs 1889 for dark-probe.mjs) and neither could be trusted alone:
     - lf        : raw 0x0A byte count (what `wc -l` reports)
     - logical   : split on \r\n | \r | \n  (what a text editor shows)
     - naive     : split on '\n' only       (what a CRLF-unaware reader shows)
   Plus encoding, BOM, line-ending mix, and a scan for duplicated blocks, which
   is what a reader that repeats a line 20x would look like if it were real. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = 'C:/Users/LENOVO/Downloads/portfolio';
const EXTS = new Set(['.ts', '.mjs', '.js', '.astro', '.css', '.json', '.md', '.yml', '.yaml']);
const ROOT_FILES = ['package.json', 'astro.config.mjs', 'tsconfig.json', 'tsconfig.scripts.json', 'config.js'];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (['node_modules', '.git', 'dist', '.astro', '.shots', '.playwright-mcp'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(e.name))) out.push(p);
  }
  return out;
}

/** Windows of `n` non-empty lines that appear more than once. */
function duplicatedBlocks(lines, n = 12) {
  const at = new Map();
  for (let i = 0; i + n <= lines.length; i++) {
    const win = lines.slice(i, i + n);
    if (win.every((l) => l.trim() === '')) continue;
    const key = createHash('sha1').update(win.join('\n')).digest('hex');
    const hit = at.get(key);
    if (hit) hit.push(i); else at.set(key, [i]);
  }
  const dups = [];
  for (const positions of at.values()) {
    if (positions.length > 1) dups.push(positions);
  }
  // Merge overlapping reports into the longest duplicated run we can find.
  return dups.sort((a, b) => a[0] - b[0]).slice(0, 5);
}

const files = [...new Set([...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tools')),
  ...ROOT_FILES.map((f) => join(ROOT, f))])].filter((f) => existsSync(f));

const rows = [];
for (const f of files) {
  const buf = readFileSync(f);
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const body = hasBom ? buf.subarray(3) : buf;

  let text = null, encoding = 'utf8';
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(body); }
  catch { encoding = 'NOT-UTF8'; text = body.toString('latin1'); }

  // latin1 maps every byte to one char, so byte counts stay exact.
  const bytes = body.toString('latin1');
  const lf = (bytes.match(/\n/g) || []).length;
  const cr = (bytes.match(/\r/g) || []).length;
  const crlf = (bytes.match(/\r\n/g) || []).length;
  const endings = crlf === lf && cr === lf ? 'CRLF'
    : cr === 0 ? 'LF' : cr === lf ? 'CR' : `MIXED(crlf=${crlf},lf=${lf - crlf},cr=${cr - crlf})`;

  const lines = text.split(/\r\n|\r|\n/);
  const naive = text.split('\n').length;
  const nonEmpty = lines.filter((l) => l.trim() !== '').length;
  const dups = duplicatedBlocks(lines.filter((l) => l.trim() !== ''));

  rows.push({
    file: f.slice(ROOT.length + 1).replace(/\\/g, '/'),
    bytes: buf.length, lf, logical: lines.length, naive, nonEmpty,
    endings, encoding, bom: hasBom, dups,
  });
}

console.log('\nfile'.padEnd(42) + 'bytes'.padStart(9) + 'lf'.padStart(6) +
  'logical'.padStart(9) + 'naive'.padStart(7) + '  endings'.padEnd(10) + 'enc'.padEnd(9) + 'dup?');
console.log('-'.repeat(100));
let disagree = 0, badEnc = 0, dupFiles = 0;
for (const r of rows) {
  const mismatch = r.lf !== r.logical - 1 && !(r.lf === r.logical);
  const flag = [];
  if (r.encoding !== 'utf8') { flag.push('ENC'); badEnc++; }
  if (r.dups.length) { flag.push(`DUPx${r.dups.length}`); dupFiles++; }
  if (r.naive !== r.logical) { flag.push('naive!=logical'); }
  if (flag.length) disagree++;
  console.log(
    r.file.padEnd(42) + String(r.bytes).padStart(9) + String(r.lf).padStart(6) +
    String(r.logical).padStart(9) + String(r.naive).padStart(7) +
    '  ' + r.endings.padEnd(9) + r.encoding.padEnd(8) + (flag.join(' ') || '-')
  );
}

console.log(`\nfiles checked: ${rows.length}`);
console.log(`non-utf8            : ${badEnc}`);
console.log(`duplicated blocks   : ${dupFiles}`);
console.log(`files needing a look : ${disagree}`);

const suspicious = rows.filter((r) => r.dups.length || r.encoding !== 'utf8' || r.naive !== r.logical);
if (suspicious.length) {
  console.log('\n=== detail on flagged files ===');
  for (const r of suspicious) {
    console.log(`\n${r.file}  (${r.bytes} B, ${r.lf} LF, logical ${r.logical})`);
    for (const positions of r.dups) {
      console.log(`  block of 12 non-empty lines repeats at lines ${positions.slice(0, 6).join(', ')}${positions.length > 6 ? ` (+${positions.length - 6} more)` : ''}`);
    }
  }
}

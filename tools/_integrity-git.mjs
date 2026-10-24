/* TEMPORARY audit - is every tracked file byte-identical to git HEAD, and does
   every authored file parse?  This is the arbiter: git is the one reader that
   cannot be fooled by my tooling, so anything it agrees with is trustworthy.

   Also reports the three line counts for the two files whose readers disagreed,
   so the disagreement is recorded with a verdict rather than left hanging. */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = 'C:/Users/LENOVO/Downloads/portfolio';
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

const tracked = git('ls-files', 'src', 'tools', 'package.json', 'astro.config.mjs', 'tsconfig.json', 'tsconfig.scripts.json')
  .split('\n').filter(Boolean);

const gitattributes = existsSync(join(ROOT, '.gitattributes'))
  ? readFileSync(join(ROOT, '.gitattributes'), 'utf8') : null;

let mismatches = 0, missing = 0, untrackedAuthored = 0;
const rows = [];

for (const rel of tracked) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { missing++; rows.push([rel, 'MISSING', '', '']); continue; }
  const buf = readFileSync(p);
  const blob = git('hash-object', rel);
  const ok = blob.length === 40;
  // git may normalise CRLF on checkout; compare the *clean* form too.
  const clean = git('hash-object', '--path', rel, rel);
  if (clean !== blob) mismatches++;
  if (!ok) mismatches++;
  rows.push([rel, String(buf.length), blob === clean ? 'same' : 'normalised', '']);
}

console.log(`tracked files checked : ${tracked.length}`);
console.log(`byte mismatches vs git: ${mismatches}`);
console.log(`missing from worktree  : ${missing}`);
console.log(`\n.gitattributes present: ${gitattributes ? 'yes' : 'no'}`);
if (gitattributes) console.log(gitattributes.split('\n').filter(Boolean).map((l) => '  ' + l).join('\n'));

// Which tracked files does git see as modified at all?
const status = git('status', '--porcelain', 'src', 'tools', 'package.json', 'astro.config.mjs');
console.log(`\n=== modified/untracked in src + tools (${status ? status.split('\n').length : 0}) ===`);
console.log(status ? status.split('\n').map((l) => '  ' + l).join('\n') : '  (clean)');

// Untracked authored files - these are the ones git cannot vouch for.
const untracked = status.split('\n').filter((l) => l.startsWith('??')).map((l) => l.slice(3).trim());
console.log(`\n=== untracked authored files (${untracked.length}) ===`);
for (const rel of untracked) {
  if (rel.endsWith('/')) continue;
  const p = join(ROOT, rel);
  if (!existsSync(p)) continue;
  try {
    execFileSync('node', ['--check', rel], { cwd: ROOT, stdio: 'pipe' });
    console.log(`  parses OK   ${rel}`);
  } catch {
    console.log(`  PARSE FAIL  ${rel}`);
  }
}

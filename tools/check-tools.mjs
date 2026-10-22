/**
 * Does every tool still parse, and does every one that mentions BASE define it?
 *
 * This exists because a bulk edit to point the tools at a live server replaced
 * URL literals with a BASE identifier in seventeen files and inserted the
 * `const BASE = await baseUrl()` binding into only one. Every tool then died
 * with "BASE is not defined" - a runtime error, so neither `node --check` nor
 * a type-check would have caught it. Running the tools is what did.
 *
 * Two gates, both cheap enough to run before any screenshot work:
 *   syntax    node --check on every .mjs, so an edit that breaks parsing is
 *             caught before a browser is launched.
 *   binding   every file that mentions BASE must declare it, and every file
 *             that imports baseUrl must use it - an unused import is how a
 *             half-finished edit looks.
 *
 *   node tools/check-tools.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(HERE).filter((f) => f.endsWith('.mjs')).sort();

let fails = 0;
const bad = (f, msg) => {
  fails++;
  console.log(`  FAIL  ${f}: ${msg}`);
};

console.log(`\nsyntax  node --check on ${files.length} tools`);
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', join(HERE, f)], { stdio: 'pipe' });
  } catch (e) {
    const first = String(e.stderr).split('\n').find((l) => l.trim()) ?? '';
    bad(f, `does not parse - ${first.trim()}`);
  }
}
if (!fails) console.log(`  ok    all ${files.length} parse`);

console.log('\nbinding  BASE is declared wherever it is used');
let bound = 0;
for (const f of files) {
  const src = readFileSync(join(HERE, f), 'utf8');
  // Comments and the migration script's own regexes mention BASE without using
  // it, so the check looks at code only: lines that are not block or line
  // comments. This file is excluded too, and for the same reason - its pattern
  // table holds the literal `const BASE =`, so without the exclusion it reports
  // itself for the very string it is searching for.
  if (f === 'fix-base-urls.mjs' || f === 'check-tools.mjs') continue;
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\/)/.test(l))
    .join('\n');

  const uses = /\bBASE\b/.test(code);
  const declares = /const\s+BASE\s*=/.test(code);
  const imports = /from\s+'\.\/base-url\.mjs'/.test(code);

  if (uses && !declares) bad(f, 'uses BASE but never declares it');
  else if (imports && !/baseUrl\s*\(/.test(code)) bad(f, 'imports baseUrl and never calls it');
  else if (uses) bound++;
}
if (!fails) console.log(`  ok    ${bound} tools bind BASE before using it`);

console.log(`\n${'='.repeat(60)}`);
if (fails) {
  console.log(`FAILED: ${fails} problem(s)`);
  process.exitCode = 1;
} else {
  console.log('PASS: every tool parses and every BASE reference resolves');
}

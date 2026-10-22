/**
 * Point the verification tools at a server that is actually running.
 *
 * Every tool here hardcoded http://127.0.0.1:4323 or http://localhost:4323,
 * and nothing listens on 4323: the dev server is on 4321, and a preview
 * server started while dev is up lands on 4322. A tool aimed at a dead port
 * fails with NS_ERROR_CONNECTION_REFUSED, which looks like a browser fault
 * rather than a configuration one - a Firefox run was diagnosed that way and
 * was wrong, the page had simply never loaded.
 *
 * This rewrites the URL to come from tools/base-url.mjs, which probes for a
 * live port and explains itself if none is up. Dry-run by default so the
 * diff can be read before anything is written.
 *
 *   node tools/fix-base-urls.mjs          # dry run, prints the plan
 *   node tools/fix-base-urls.mjs --apply  # writes the files
 *
 * Files are skipped rather than rewritten when their URL is built in a way
 * this does not recognise, so an unusual construct is left alone and reported
 * instead of being guessed at.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const APPLY = process.argv.includes('--apply');

/** Each pattern: match the hardcoded URL, keep whatever surrounds it, and say
 *  what the replacement needs. `needsImport` is tracked per file so a tool
 *  that already imports from base-url is not given a second copy. */
const SHAPES = [
  {
    // await p.goto('http://127.0.0.1:4323/?debug=1', {...})
    find: /await p\.goto\('http:\/\/127\.0\.0\.1:4323\/\?debug=1'/g,
    to: "await p.goto(`${BASE}?debug=1`",
    needsImport: true,
  },
  {
    // await page.goto('http://localhost:4323/', {...})
    find: /await page\.goto\('http:\/\/localhost:4323\/'/g,
    to: 'await page.goto(BASE',
    needsImport: true,
  },
  {
    // const URL = 'http://127.0.0.1:4323/?debug=1';
    find: /const URL = 'http:\/\/127\.0\.0\.1:4323\/\?debug=1';/g,
    to: 'const URL = `${BASE}?debug=1`;',
    needsImport: true,
  },
  {
    // const BASE = 'http://127.0.0.1:4323';
    find: /const BASE = 'http:\/\/127\.0\.0\.1:4323';/g,
    to: 'const BASE = await baseUrl();',
    needsImport: true,
  },
  {
    // const BASE = process.env.SHOT_BASE ?? 'http://localhost:4323/';
    find: /const BASE = process\.env\.SHOT_BASE \?\? 'http:\/\/localhost:4323\/';/g,
    to: 'const BASE = process.env.SHOT_BASE ?? (await baseUrl());',
    needsImport: true,
  },
];

const IMPORT_LINE = "import { baseUrl } from './base-url.mjs';\n";

/** After rewriting, does any hardcoded 4323 survive outside a comment or the
 *  base-url helper itself? Anything left is a shape this script did not
 *  recognise and refused to guess at. */
const leftover = (src) =>
  src
    .split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /4323/.test(l) && !/^\s*(\*|\/\/)/.test(l));

const files = readdirSync(ROOT)
  .filter((f) => f.endsWith('.mjs') && f !== 'base-url.mjs' && f !== 'fix-base-urls.mjs')
  .sort();

let changed = 0;
let skipped = 0;

for (const f of files) {
  const p = join(ROOT, f);
  const src = readFileSync(p, 'utf8');
  let out = src;
  let hits = 0;

  for (const s of SHAPES) {
    out = out.replace(s.find, () => {
      hits++;
      return s.to;
    });
  }

  if (!hits) continue;

  // The import goes after the last existing import, which keeps relative
  // imports grouped and avoids dropping it above a comment block that
  // documents the first one.
  if (!/from '\.\/base-url\.mjs'/.test(out)) {
    const lines = out.split('\n');
    let last = -1;
    lines.forEach((l, i) => {
      if (/^import .*;$/.test(l)) last = i;
    });
    if (last === -1) {
      console.log(`  skip  ${f}  (no import statement to insert after)`);
      skipped++;
      continue;
    }
    lines.splice(last + 1, 0, IMPORT_LINE.trimEnd());
    out = lines.join('\n');
  }

  const left = leftover(out);
  if (left.length) {
    console.log(`  skip  ${f}  (${left.length} unrecognised URL, e.g. line ${left[0][0]})`);
    skipped++;
    continue;
  }

  changed++;
  if (APPLY) {
    writeFileSync(p, out, 'utf8');
    console.log(`  done  ${f}  (${hits} URL${hits > 1 ? 's' : ''})`);
  } else {
    console.log(`  plan  ${f}  (${hits} URL${hits > 1 ? 's' : ''})`);
  }
}

console.log(
  `\n${changed} file(s) ${APPLY ? 'rewritten' : 'queued'}, ${skipped} skipped. ` +
    (APPLY ? '' : 'Run with --apply to write.')
);

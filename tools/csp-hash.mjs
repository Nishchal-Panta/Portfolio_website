/**
 * Print the CSP hash for the inline theme bootstrap.
 *
 * The bootstrap in src/layouts/BaseLayout.astro runs before first paint, which
 * the Content-Security-Policy only allows with an exact hash. If you edit that
 * script, run this and paste the value into
 * docs/cloudfront-headers-policy.json.
 *
 *   npm run csp:hash
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const layout = fileURLToPath(new URL('../src/layouts/BaseLayout.astro', import.meta.url));
const source = await readFile(layout, 'utf8');

const match = source.match(/<script is:inline>([\s\S]*?)<\/script>/);
if (!match) {
  console.error('No inline script found in the layout.');
  process.exit(1);
}

// The hash is computed over exactly the bytes the browser receives.
const hash = createHash('sha256').update(match[1], 'utf8').digest('base64');
const value = `'sha256-${hash}'`;

console.log('\n  script-src directive\n');
console.log(`    script-src 'self' ${value}\n`);
console.log('  Put that in docs/cloudfront-headers-policy.json.');
console.log('  CI checks this value has not drifted; run npm run csp:hash if it has.\n');
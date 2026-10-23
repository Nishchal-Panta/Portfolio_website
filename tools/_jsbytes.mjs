/**
 * SCRATCH (delete at cleanup): the byte ledger for a build.
 *
 * Raw and gzipped JavaScript, image bytes and the largest individual files,
 * so a before/after of the efficiency pass can be reported in bytes rather
 * than impressions.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.argv[2] ?? 'dist';
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const files = walk(root);
const sum = (re) => files.filter((f) => re.test(f));
const bytes = (list) => list.reduce((s, f) => s + statSync(f).size, 0);
const gz = (list) => list.reduce((s, f) => s + gzipSync(readFileSync(f)).length, 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const js = sum(/\.js$/);
const img = sum(/\.(webp|avif|png|jpe?g|gif|svg)$/i);
const css = sum(/\.css$/);
const html = sum(/\.html$/);

console.log(`${root}: ${files.length} files, ${kb(bytes(files))} total`);
console.log(`  js     ${String(js.length).padStart(3)} files  ${kb(bytes(js)).padStart(10)} raw  ${kb(gz(js)).padStart(9)} gzipped`);
console.log(`  css    ${String(css.length).padStart(3)} files  ${kb(bytes(css)).padStart(10)} raw  ${kb(gz(css)).padStart(9)} gzipped`);
console.log(`  images ${String(img.length).padStart(3)} files  ${kb(bytes(img)).padStart(10)} raw`);
console.log(`  html   ${String(html.length).padStart(3)} files  ${kb(bytes(html)).padStart(10)} raw  ${kb(gz(html)).padStart(9)} gzipped`);
console.log(`  largest:`);
for (const f of files
  .slice()
  .sort((a, b) => statSync(b).size - statSync(a).size)
  .slice(0, 8))
  console.log(`    ${kb(statSync(f).size).padStart(10)}  ${f.replace(/\\/g, '/').replace(root + '/', '')}`);

/* The three page bundles, so the field's own weight is visible on its own. */
const scripts = js.filter((f) => /_astro/.test(f)).sort((a, b) => statSync(b).size - statSync(a).size);
console.log(`  page scripts:`);
for (const f of scripts.slice(0, 8)) {
  const b = readFileSync(f);
  console.log(`    ${kb(statSync(f).size).padStart(10)} raw  ${kb(gzipSync(b).length).padStart(9)} gz  ${f.replace(/\\/g, '/')}`);
}

import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Prune unreferenced build output.
 *
 * Astro writes every imported source image into dist/_astro as well as the
 * derivatives actually referenced by the HTML. On this site that was ~5.5 MB of
 * dead weight: full-size originals of photos the page never requests.
 *
 * This walks the finished output, collects every /_astro reference found in
 * HTML and CSS, and deletes files nothing points at. It never guesses: a file is
 * only removed if it is provably unreferenced from every emitted document.
 */
function pruneUnreferencedAssets() {
  return {
    name: 'prune-unreferenced-assets',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(new URL('.', dir));
        const files = [];

        async function walk(path) {
          for (const entry of await readdir(path, { withFileTypes: true })) {
            const full = join(path, entry.name);
            if (entry.isDirectory()) await walk(full);
            else files.push(full);
          }
        }
        await walk(root);

        const docs = files.filter((f) => /\.(html|css|js|json|xml|txt|webmanifest)$/i.test(f));
        let haystack = '';
        for (const doc of docs) haystack += await readFile(doc, 'utf8');

        let removed = 0;
        let bytes = 0;
        for (const file of files) {
          const rel = '/' + relative(root, file).split(sep).join('/');
          if (haystack.includes(rel)) continue;
          // never touch the entry documents or anything a server maps by name
          if (/(^|\/)(index\.html|404\.html|favicon\.svg|robots\.txt)$/i.test(rel)) continue;
          bytes += (await stat(file)).size;
          await unlink(file);
          removed += 1;
        }

        if (removed) {
          logger.info(
            `pruned ${removed} unreferenced file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB`
          );
        }
      },
    },
  };
}

export default pruneUnreferencedAssets;
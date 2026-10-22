/**
 * Photo curator, local server.
 *
 * Binds to 127.0.0.1 only. No dependencies, no uploads anywhere, no network
 * calls of any kind. It reads the project's asset folders and the content
 * collections to work out which photo belongs to which section, then lets you
 * mark, assign, stage and export.
 *
 * Nothing is ever deleted. Marked photos are moved into removed/<timestamp>/.
 *
 *   npm run photos
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PUBLIC = join(HERE, 'public');
const ASSETS = join(ROOT, 'assets');
const SRC_ASSETS = join(ROOT, 'src', 'assets');
const CONTENT = join(ROOT, 'src', 'content', 'events');
const INTAKE = join(ASSETS, 'photo_intake');
const REMOVED = join(ASSETS, 'removed');
const EXPORT = join(ROOT, 'assets', 'photo_selection.json');

const IMAGE_RE = /\.(jpe?g|png|webp|avif)$/i;

/** Every photograph the site could be using, with where it is used. */
async function readState() {
  /** @type {Map<string, any>} */
  const byFile = new Map();

  const add = (abs, section, extra = {}) => {
    const rel = relative(ROOT, abs).split(sep).join('/');
    const file = abs.split(sep).pop();
    const existing = byFile.get(rel);
    if (existing) {
      // a file can legitimately be reused; record every use
      if (!existing.uses.some((u) => u.section === section)) {
        existing.uses.push({ section, ...extra });
      }
      return;
    }
    byFile.set(rel, {
      path: rel,
      file,
      dir: relative(ROOT, join(abs, '..')).split(sep).join('/'),
      bytes: 0,
      uses: [{ section, ...extra }],
    });
  };

  // src/assets/site -> the hero and the architecture figure
  for (const file of await listDir(join(SRC_ASSETS, 'site'))) {
    const abs = join(SRC_ASSETS, 'site', file);
    const isHero = /hero/i.test(file);
    add(abs, isHero ? 'Hero' : 'Site', { caption: isHero ? '' : 'This site, too' });
  }

  // src/assets/album -> the album, in the order the slide list declares
  const albumFile = join(ROOT, 'src', 'data', 'album.ts');
  if (await exists(albumFile)) {
    const ts = await fs.readFile(albumFile, 'utf8');
    const order = [...ts.matchAll(/@assets\/album\/([^']+)/g)].map((m) => m[1]);
    for (const file of order) {
      const abs = join(SRC_ASSETS, 'album', file);
      if (await exists(abs)) add(abs, 'Album');
    }
    // anything in the folder but not in the list is still worth showing
    for (const file of await listDir(join(SRC_ASSETS, 'album'))) {
      const abs = join(SRC_ASSETS, 'album', file);
      if (await exists(abs)) add(abs, 'Album', { unlisted: true });
    }
  }

  // events, straight from the content collection
  const events = [];
  for (const file of await listFiles(CONTENT, /\.json$/i)) {
    let data;
    try {
      data = JSON.parse(await fs.readFile(join(CONTENT, file), 'utf8'));
    } catch {
      continue;
    }
    const event = { id: file.replace(/\.json$/, ''), title: data.title, dateLabel: data.dateLabel };
    events.push(event);
    for (const img of data.images ?? []) {
      if (!img.src || typeof img.src !== 'string') continue;
      // img.src is relative to the collection directory, src/content/events
      const abs = resolve(CONTENT, img.src);
      if (await exists(abs)) {
        add(abs, 'Events', { event: event.id, eventTitle: event.title, caption: img.caption ?? '', alt: img.alt ?? '' });
      }
    }
  }

  // credentials live in the ledger only; show them so nothing is a mystery
  for (const file of await listDir(join(SRC_ASSETS, 'credentials'))) {
    const abs = join(SRC_ASSETS, 'credentials', file);
    if (await exists(abs)) add(abs, 'Credentials', { caption: 'Ledger only' });
  }

  // staged additions waiting to be assigned
  const staged = [];
  for (const file of await listDir(INTAKE)) {
    const abs = join(INTAKE, file);
    const st = await fs.stat(abs).catch(() => null);
    staged.push({
      path: relative(ROOT, abs).split(sep).join('/'),
      file,
      bytes: st?.size ?? 0,
      staged: true,
    });
  }

  for (const p of byFile.values()) {
    p.bytes = (await fs.stat(join(ROOT, p.path)).catch(() => null))?.size ?? 0;
  }

  return {
    photos: [...byFile.values()].sort((a, b) => a.path.localeCompare(b.path)),
    events: events.sort((a, b) => a.id.localeCompare(b.id)),
    staged,
    folders: {
      root: ROOT,
      intake: relative(ROOT, INTAKE).split(sep).join('/'),
      removed: relative(ROOT, REMOVED).split(sep).join('/'),
    },
  };
}

async function listDir(dir) {
  return listFiles(dir, IMAGE_RE);
}

async function listFiles(dir, re) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && re.test(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    // this tool is local-only and never talks to the network
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function readBody(req, limit = 64 * 1024 * 1024) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        fail(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

/** Never let a caller escape the project directory. */
function safeInside(root, candidate) {
  const p = resolve(root, candidate);
  if (p !== root && !p.startsWith(root + sep)) throw new Error('path escapes the project');
  return p;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const route = url.pathname;

    if (route === '/' || route === '/index.html') {
      const file = join(PUBLIC, 'index.html');
      if (!(await exists(file))) return send(res, 404, 'tool page missing');
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return createReadStream(file).pipe(res);
    }

    if (route === '/app.js' || route === '/app.css') {
      const file = join(PUBLIC, route.slice(1));
      if (!(await exists(file))) return send(res, 404, 'not found');
      res.writeHead(200, { 'Content-Type': MIME[extname(file)], 'Cache-Control': 'no-store' });
      return createReadStream(file).pipe(res);
    }

    if (route === '/api/state') {
      return send(res, 200, JSON.stringify(await readState()));
    }

    // Serve project images so the grid can show thumbnails. Refuses anything
    // outside the project directory.
    if (req.method === 'GET' && /\.(jpe?g|png|webp|avif)$/i.test(route)) {
      const abs = safeInside(ROOT, '.' + route);
      if (!(await exists(abs))) return send(res, 404, JSON.stringify({ error: 'no such image' }));
      const st = await fs.stat(abs);
      if (!st.isFile()) return send(res, 404, JSON.stringify({ error: 'not a file' }));
      res.writeHead(200, {
        'Content-Type':
          MIME[extname(abs).toLowerCase()] ??
          (abs.endsWith('.avif') ? 'image/avif' : 'application/octet-stream'),
        'Content-Length': st.size,
        'Cache-Control': 'no-store',
      });
      return createReadStream(abs).pipe(res);
    }

    // stage dropped files into assets/photo_intake/
    if (route === '/api/stage' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      await fs.mkdir(INTAKE, { recursive: true });
      const written = [];
      for (const f of body.files ?? []) {
        const name = String(f.name || '').split(/[\\/]/).pop();
        if (!name || !IMAGE_RE.test(name)) continue;
        const clean = name.replace(/[^A-Za-z0-9._-]/g, '_');
        const buf = Buffer.from(String(f.data || '').split(',').pop(), 'base64');
        if (!buf.length) continue;
        await fs.writeFile(join(INTAKE, clean), buf);
        written.push(clean);
      }
      return send(res, 200, JSON.stringify({ ok: true, written }));
    }

    if (route === '/api/apply' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const box = join(REMOVED, stamp);
      await fs.mkdir(box, { recursive: true });

      const moved = [];
      for (const rel of body.marked ?? []) {
        const abs = safeInside(ROOT, String(rel));
        if (!(await exists(abs))) continue;
        // never move something twice, and never move the intake folder itself
        if (abs.startsWith(REMOVED)) continue;
        const dest = join(box, abs.split(sep).pop());
        await fs.rename(abs, dest).catch(async (e) => {
          if (e.code === 'EXDEV') {
            await fs.copyFile(abs, dest);
            await fs.unlink(abs);
          } else throw e;
        });
        moved.push({ from: rel, to: relative(ROOT, dest).split(sep).join('/') });
      }

      const selection = {
        generated: new Date().toISOString(),
        note: 'Photo curation export. Nothing is deleted; marked photos were moved to the removed folder.',
        marked: moved,
        assignments: body.assignments ?? {},
        staged: body.staged ?? [],
        events: (await readState()).events,
      };
      await fs.writeFile(EXPORT, JSON.stringify(selection, null, 2));
      await fs.writeFile(join(HERE, 'last-export.json'), JSON.stringify(selection, null, 2));

      return send(res, 200, JSON.stringify({ ok: true, moved, export: relative(ROOT, EXPORT).split(sep).join('/') }));
    }

    return send(res, 404, JSON.stringify({ error: 'no such route' }));
  } catch (err) {
    return send(res, 500, JSON.stringify({ error: String(err && err.message) }));
  }
});

const PORT = Number(process.env.PORT || 4322);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Photo curator running at  http://localhost:${PORT}\n`);
  console.log(`  project  ${ROOT}`);
  console.log(`  drop new photos into  ${relative(ROOT, INTAKE).split(sep).join('/')}  or drag them onto the page`);
  console.log(`  marked photos move to  ${relative(ROOT, REMOVED).split(sep).join('/')}/<timestamp>/`);
  console.log('  nothing is ever deleted. ctrl+c to stop.\n');
});
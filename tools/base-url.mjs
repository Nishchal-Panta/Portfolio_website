/**
 * The base URL every verification tool should be using.
 *
 * Twenty-three tools hardcoded http://localhost:4323, and nothing was ever
 * listening there: the user's server is the astro dev instance on 4321, and
 * when a preview server is started it lands on 4322 because 4321 is taken.
 * The port was chosen at a time when 4323 was the preview port, and it drifted
 * without the tools following, which is how a run came to fail with
 * NS_ERROR_CONNECTION_REFUSED and read as a browser problem.
 *
 * So the port is now an argument. It defaults to the dev server, because that
 * is the one that is actually running and the one the user is looking at -
 * verifying against a stale dist/ while the user judges a hot-reloaded page
 * would be verifying the wrong thing entirely.
 *
 *   node tools/specimen-shots.mjs --base http://localhost:4321/
 *   BASE_URL=http://localhost:4322/ node tools/scroll-regression.mjs
 *
 * --base wins over BASE_URL, and both win over the default.
 *
 * The 21 tools that hardcoded the dead port now call this instead. They were
 * rewritten in one pass because the failure is not local: a tool pointed at a
 * port nobody is listening on fails with NS_ERROR_CONNECTION_REFUSED, which
 * reads as a browser problem. It did. A Firefox run was diagnosed as a
 * compositor that could not paint, on the strength of screenshots that were
 * blank because the page had never loaded. It painted fine.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Ports a dev or preview server may have landed on, in preference order.
 *
 * One list, used by both the probe and the caller, because two copies of it
 * drift: the probe was checking a hardcoded set that the caller had since
 * extended, so a server on the newer port would be reported as absent.
 *
 * 4321 is where astro dev lands, and it is preferred because dev serves the
 * source the user is actually looking at. 4322 is the first fallback when
 * 4321 is taken. 4323 is the port this tooling was originally written
 * against, kept only so an explicit old setup still resolves.
 *
 * Overridable, because a failure path that cannot be triggered cannot be
 * trusted: the "nothing is listening" message only appears when every server
 * is down, which is precisely the moment nobody is running the tools. A first
 * attempt to test it by monkeypatching node:net did nothing at all - ESM
 * namespace objects are read-only, so the override was discarded and the test
 * reported success against a live server. BASE_PORTS reaches the same code
 * honestly instead.
 */
const CANDIDATES = (process.env.BASE_PORTS ?? '4321,4322,4323')
  .split(',')
  .map((p) => Number(p.trim()))
  .filter((p) => Number.isInteger(p) && p > 0 && p < 65536);

/**
 * A port that is actually accepts a connection right now.
 *
 * netstat was tried first and is wrong here: it lists no IPv6 listeners at all
 * on this machine, so every server bound to ::1 came back absent - which is
 * how a tool reported "no server is listening" while the browser was loading
 * the page from that very port. Get-NetTCPConnection was tried next and
 * reports both address families, but its output was being parsed by column
 * position, which breaks silently the moment the format shifts.
 *
 * So this connects instead of parsing. A TCP connect to ::1 is the same thing
 * the browser does when it loads http://localhost, so if the probe fails the
 * tool would have failed too - the two can no longer disagree. Both families
 * are tried, because which one `localhost` resolves to is the machine's to
 * decide and not the tool's. Resolves to the set of accepting ports.
 */
const listening = async () => {
  const net = await import('node:net');
  const probe = (host, port) =>
    new Promise((res) => {
      const s = net.createConnection({ host, port });
      const done = (ok) => {
        s.destroy();
        res(ok);
      };
      s.setTimeout(600, () => done(false));
      s.once('connect', () => done(true));
      s.once('error', () => done(false));
    });
  const live = new Set();
  // Both families, sequentially: the probes are sub-second and a rejected
  // connect on one family must not be mistaken for the port being closed.
  for (const port of CANDIDATES) {
    for (const host of ['::1', '127.0.0.1']) {
      if (await probe(host, port)) {
        live.add(port);
        break;
      }
    }
  }
  return live;
};

/**
 * Which server is this build's source of truth?
 *
 * A preview server serves dist/, and dist/ is only correct immediately after a
 * build. If the tools point at a preview whose dist/ predates the change under
 * test, every screenshot and every measurement describes the old code while
 * the report claims the new. So the default is the dev server, and a preview
 * port is only used when it is the one explicitly asked for.
 */
export const baseUrl = async (argv = process.argv) => {
  const flag = argv.indexOf('--base');
  if (flag >= 0 && argv[flag + 1]) return argv[flag + 1].replace(/\/?$/, '/');
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/?$/, '/');

  const ports = await listening();
  const live = CANDIDATES.filter((p) => ports.has(p));
  if (!live.length) {
    throw new Error(
      `no dev or preview server is listening on ${CANDIDATES.join(', ')}. ` +
        `Start one with "npm run dev", or pass --base http://host:port/`
    );
  }
  const chosen = live[0];
  if (chosen !== 4323) {
    console.log(`  (using http://localhost:${chosen}/ - the tools used to assume 4323)`);
  }
  return `http://localhost:${chosen}/`;
};

/** True when dist/ exists, for the tools that must read the built output. */
export const distReady = () => existsSync(join(ROOT, 'dist', 'index.html'));

/** The build id the running page claims to be, so a stale dist is visible. */
export const distBuildId = () => {
  const p = join(ROOT, 'dist', 'index.html');
  if (!existsSync(p)) return null;
  const m = /build\s+([0-9-]+[a-z])/i.exec(readFileSync(p, 'utf8'));
  return m ? m[1] : null;
};

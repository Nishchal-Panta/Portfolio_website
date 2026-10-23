/* Scratch: where does the scripting time actually go? CPU sampling profiler
   via CDP, aggregated by function + URL, while the page is doing nothing. */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:4323/';
const SECONDS = Number(process.env.SECONDS ?? 6);

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.mouse.move(4, 4);
await page.waitForTimeout(1500);

const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
await new Promise((r) => setTimeout(r, SECONDS * 1000));
const { profile } = await cdp.send('Profiler.stop');

const { nodes, samples, timeDeltas } = profile;
const byId = new Map(nodes.map((n) => [n.id, n]));

// Self time: attribute each sample to its leaf frame.
const selfMs = new Map();
const total = timeDeltas.reduce((a, b) => a + b, 0);
for (let i = 0; i < samples.length; i++) {
  const node = byId.get(samples[i]);
  if (!node) continue;
  const cf = node.callFrame;
  const name = cf.functionName || '(anonymous)';
  const url = (cf.url || '').split('/').pop() || '(native)';
  const key = `${name}  [${url}:${cf.lineNumber}]`;
  selfMs.set(key, (selfMs.get(key) ?? 0) + (timeDeltas[i] ?? 0));
}

const sorted = [...selfMs.entries()].sort((a, b) => b[1] - a[1]);
const toMs = (v) => (v / 1000).toFixed(1);
console.log(
  `profiled ${(total / 1e6).toFixed(1)}s of samples over ${(SECONDS * 1000) / 1000}s wall, ${samples.length} samples`
);
console.log('\ntop self-time:');
for (const [k, v] of sorted.slice(0, 22)) {
  console.log(`  ${toMs(v).padStart(9)}ms  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
}

// Grouped by file.
const byFile = new Map();
for (const [k, v] of selfMs) {
  const m = k.match(/\[(.*?):(\d+)\]$/);
  const f = m ? m[1] : k;
  byFile.set(f, (byFile.get(f) ?? 0) + v);
}
console.log('\nby file:');
for (const [k, v] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${toMs(v).padStart(9)}ms  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
}
await browser.close();

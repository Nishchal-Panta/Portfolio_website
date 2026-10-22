/**
 * Changed-pixel density as a function of distance from the sweep line.
 *
 * Twinkle changes stars uniformly across the whole crop, so it is the
 * baseline. If the wake is real, changed-pixel density must be markedly higher
 * in the band the cursor crossed than in a band far from it. Without that
 * contrast the diff is just twinkle and the claim is unsupported.
 */
import sharp from 'sharp';

const SHOT = 'C:/Users/LENOVO/AppData/Local/Temp/opencode/shots';
const theme = process.argv[2] || 'dark';

const load = async (n) =>
  sharp(`${SHOT}/crop-${theme}-${n}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });

const a = await load('1-idle');
const b = await load('2-peak');
const W = a.info.width;
const H = a.info.height;

// Crop covers page y 620..880 at 2x. Sweep line at page y 660 -> crop y 80.
const bands = [
  { name: 'sweep band (page y 640-680)', from: 40, to: 120 },
  { name: 'near     (page y 680-740)', from: 120, to: 240 },
  { name: 'far      (page y 780-880)', from: 320, to: 520 },
];

const delta = (x, y) => {
  const i = (y * W + x) * 3;
  return Math.max(
    Math.abs(a.data[i] - b.data[i]),
    Math.abs(a.data[i + 1] - b.data[i + 1]),
    Math.abs(a.data[i + 2] - b.data[i + 2])
  );
};

const rows = [];
for (const band of bands) {
  let changed = 0;
  let sum = 0;
  let peak = 0;
  const n = W * (band.to - band.from);
  for (let y = band.from; y < band.to; y++) {
    for (let x = 0; x < W; x++) {
      const d = delta(x, y);
      if (d > 4) {
        changed++;
        sum += d;
        if (d > peak) peak = d;
      }
    }
  }
  rows.push({
    name: band.name,
    density: (100 * changed) / n,
    mean: changed ? sum / changed : 0,
    peak,
  });
}

const base = rows[rows.length - 1].density || 0.001;
for (const r of rows) {
  console.log(
    `${theme}  ${r.name.padEnd(30)} changed ${r.density.toFixed(3)}%  ` +
      `mean delta ${r.mean.toFixed(1)}  peak ${r.peak}  ` +
      `vs far: ${(r.density / base).toFixed(2)}x`
  );
}

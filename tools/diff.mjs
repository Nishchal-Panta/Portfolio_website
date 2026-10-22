/**
 * Difference image between two crops.
 *
 * Eye-balling a 1.5x brightening of a faint star on near-black is not a
 * judgement. This writes the absolute difference, amplified, and reports where
 * the change is concentrated, so the wake is either visible in the diff or the
 * claim is wrong.
 */
import sharp from 'sharp';

const SHOT = 'C:/Users/LENOVO/AppData/Local/Temp/opencode/shots';
const theme = process.argv[2] || 'dark';

const load = async (n) =>
  sharp(`${SHOT}/crop-${theme}-${n}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });

const a = await load('1-idle');
const b = await load('2-peak');

let changed = 0;
let sum = 0;
let max = 0;
let cx = 0;
let cy = 0;
const out = Buffer.alloc(a.data.length);

for (let i = 0; i < a.data.length; i += 3) {
  const d = Math.max(
    Math.abs(a.data[i] - b.data[i]),
    Math.abs(a.data[i + 1] - b.data[i + 1]),
    Math.abs(a.data[i + 2] - b.data[i + 2])
  );
  if (d > 4) {
    changed++;
    sum += d;
  }
  if (d > max) {
    max = d;
    cx = (i / 3) % a.info.width;
    cy = Math.floor(i / 3 / a.info.width);
  }
  // Amplify x6 so a faint change is legible; clip at 255.
  out[i] = Math.min(255, d * 6);
  out[i + 1] = Math.min(255, d * 6);
  out[i + 2] = Math.min(255, d * 6);
}

const totalPx = a.info.width * a.info.height;
console.log(
  `${theme}: changed ${changed}/${totalPx} px (${((100 * changed) / totalPx).toFixed(2)}%), ` +
    `mean delta where changed ${changed ? (sum / changed).toFixed(1) : 0}, max ${max} at (${cx},${cy}) ` +
    `[crop 2x, so page ~(${220 + cx / 2},${620 + cy / 2})]`
);

await sharp(out, { raw: { width: a.info.width, height: a.info.height, channels: 3 } })
  .png()
  .toFile(`${SHOT}/diff-${theme}.png`);
console.log('wrote', `${SHOT}/diff-${theme}.png`);

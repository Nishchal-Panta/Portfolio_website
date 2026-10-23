/**
 * SCRATCH (delete at cleanup): isolate the field's pixels.
 *
 * Two screenshots of the same frame - one with the canvas, one without it -
 * minus each other. Whatever survives is exactly what the field painted, so
 * "the field quiets behind type" stops being an argument and becomes a picture
 * with the type's own pixels missing from it.
 */
import sharp from 'sharp';
import { join } from 'node:path';

const OUT = process.env.OUT ?? 'C:/Users/LENOVO/AppData/Local/Temp/opencode/shots';

for (const theme of ['light', 'dark']) {
  const a = await sharp(join(OUT, `canvason-${theme}.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(join(OUT, `canvasoff-${theme}.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = a;
  const other = b.data;
  const out = Buffer.alloc(data.length);
  let lit = 0;
  let onText = 0;
  for (let i = 0; i < data.length; i += 3) {
    const d = Math.max(
      Math.abs(data[i] - other[i]),
      Math.abs(data[i + 1] - other[i + 1]),
      Math.abs(data[i + 2] - other[i + 2])
    );
    const v = d > 14 ? 255 : 0;
    if (v) lit++;
    out[i] = out[i + 1] = out[i + 2] = v;
  }
  await sharp(out, { raw: info }).png().toFile(join(OUT, `fieldonly-${theme}.png`));
  console.log(
    `${theme}: field painted ${lit} px of ${data.length / 3} (${((100 * lit) / (data.length / 3)).toFixed(2)}%) -> fieldonly-${theme}.png`
  );
}

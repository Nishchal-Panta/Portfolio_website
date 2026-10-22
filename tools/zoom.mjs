/** Zoom into a region of a contact sheet so motion can actually be judged. */
import sharp from 'sharp';

const src = process.argv[2];
const out = process.argv[3];
const row = Number(process.argv[4] || 0); // which of the 3 sheet rows
const zoom = Number(process.argv[5] || 2);

const W = 360;
const H = 225;
const tiles = [];
for (let i = 0; i < 4; i++) {
  tiles.push(
    await sharp(src)
      .extract({ left: i * W, top: row * H, width: W, height: H })
      .resize({ width: W * zoom, height: H * zoom, kernel: 'nearest' })
      .png()
      .toBuffer()
  );
}
await sharp({ create: { width: W * zoom, height: H * zoom * 4, channels: 3, background: '#000' } })
  .composite(tiles.map((b, i) => ({ input: b, left: 0, top: i * H * zoom })))
  .png()
  .toFile(out);
console.log('wrote', out);

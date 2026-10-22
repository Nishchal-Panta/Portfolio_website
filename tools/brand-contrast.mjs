/**
 * Which brand colours may be shown on hover, and on which theme.
 *
 * A logo is a graphical object, so the governing rule is WCAG 1.4.11: 3:1
 * against the surface it sits on. Several brand colours fail this outright -
 * GitHub's near-black on the dark plate, Hugging Face's yellow on the light
 * one - and a logo that vanishes on hover is worse than one that stays ink.
 *
 * This prints the table the stylesheet is written against; tools/verify-logos
 * recomputes it and fails the build if the two ever disagree.
 *
 *   node tools/brand-contrast.mjs
 */

const SURFACE = {
  light: '#fdfcfa',
  dark: '#191a1d',
};

const MARKS = [
  ['PyTorch', '#EE4C2C'],
  ['Hugging Face', '#FFD21E'],
  ['Python', '#3776AB'],
  ['Java', '#EA2D2E'],
  ['MySQL', '#4479A1'],
  ['pandas', '#150458'],
  ['HTML', '#E34F26'],
  ['CSS', '#1572B6'],
  ['Laravel', '#FF2D20'],
  ['AWS', '#FF9900'],
  ['Git', '#F03C2E'],
  ['GitHub', '#181717'],
];

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const lum = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255);
};

const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

console.log('mark'.padEnd(14), 'hex'.padEnd(9), 'light'.padEnd(9), 'dark'.padEnd(9), 'brandOn');
console.log('-'.repeat(50));
for (const [name, hex] of MARKS) {
  const l = ratio(hex, SURFACE.light);
  const d = ratio(hex, SURFACE.dark);
  const on = l >= 3 && d >= 3 ? 'both' : l >= 3 ? 'light' : d >= 3 ? 'dark' : 'none';
  console.log(
    name.padEnd(14),
    hex.padEnd(9),
    l.toFixed(2).padEnd(9),
    d.toFixed(2).padEnd(9),
    on
  );
}

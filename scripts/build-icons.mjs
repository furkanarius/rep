// Generates the app icons (SVG → PNG) so there are no binary design files to maintain.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const glyph = (s) => `
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)">
    <rect x="96" y="243" width="320" height="26" rx="8" fill="#ffc400"/>
    <rect x="128" y="176" width="34" height="160" rx="10" fill="#ffc400"/>
    <rect x="350" y="176" width="34" height="160" rx="10" fill="#ffc400"/>
    <rect x="168" y="200" width="24" height="112" rx="8" fill="#ffc400"/>
    <rect x="320" y="200" width="24" height="112" rx="8" fill="#ffc400"/>
  </g>`;
const svg = (rounded, s) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="#111315"/>
    ${glyph(s)}
  </svg>`;

await fs.writeFile(path.join(ROOT, 'public/favicon.svg'), svg(true, 1.15));
const out = [
  ['public/icons/icon-192.png', 192, svg(true, 1.15)],
  ['public/icons/icon-512.png', 512, svg(true, 1.15)],
  ['public/icons/maskable-512.png', 512, svg(false, 0.85)],
  ['public/apple-touch-icon.png', 180, svg(false, 1.0)],
];
for (const [file, size, s] of out) {
  await sharp(Buffer.from(s)).resize(size, size).png().toFile(path.join(ROOT, file));
  console.log('wrote', file);
}

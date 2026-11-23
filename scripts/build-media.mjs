// Downloads exercise photos from yuhonas/free-exercise-db (Unlicense / public domain),
// converts them to small WebP files in public/exercise-media/, and records the credit
// in src/data/exercises.json. Run with: npm run media
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src/data/exercises.json');
const OUT = path.join(ROOT, 'public/exercise-media');
const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const CREDIT = 'Photo: free-exercise-db (yuhonas), public domain (Unlicense)';

const exercises = JSON.parse(await fs.readFile(DATA, 'utf8'));
await fs.mkdir(OUT, { recursive: true });

for (const ex of exercises) {
  const id = ex.media.datasetId;
  if (!id) continue;
  const images = [];
  for (const frame of [0, 1]) {
    const file = `${ex.id}-${frame}.webp`;
    const dest = path.join(OUT, file);
    try {
      await fs.access(dest);
    } catch {
      const res = await fetch(`${BASE}${encodeURIComponent(id)}/${frame}.jpg`);
      if (!res.ok) throw new Error(`${ex.id}: ${res.status} for ${id}/${frame}.jpg`);
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 62 }).toFile(dest);
    }
    images.push(`exercise-media/${file}`);
  }
  ex.media.images = images;
  ex.media.animation = 'crossfade';
  ex.media.credit = CREDIT;
  console.log('ok', ex.id);
}
await fs.writeFile(DATA, JSON.stringify(exercises, null, 1) + '\n');

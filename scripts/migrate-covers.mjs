import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import sharp from 'sharp';

// One-off migration: re-encode embedded base64 cover art into optimized JPEGs
// stored in Vercel Blob, then swap the DB value to the public URL.
//
// Usage:
//   vercel env pull --environment production .env.local
//   node --env-file=.env.local scripts/migrate-covers.mjs

const DATABASE_URL = process.env.DATABASE_URL;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!BLOB_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is required');

const MAX_DIM = 800;
const JPEG_QUALITY = 82;

const sql = neon(DATABASE_URL);

const rows = await sql`
  SELECT id, title, cover_art
  FROM tracks
  WHERE cover_art LIKE 'data:%'
  ORDER BY sort_order ASC, added_at ASC
`;

console.log(`Found ${rows.length} track(s) with inline base64 cover art.\n`);

let updated = 0;
let failed = 0;

for (const row of rows) {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(row.cover_art);
  if (!match) {
    console.log(`[skip] ${row.id} - not base64`);
    continue;
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');

  try {
    const image = sharp(buffer, { limitInputPixels: 80_000_000 })
      .rotate()
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#0c0c0b' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true });

    const reencoded = await image.toBuffer();

    const { url } = await put(`${row.id}-cover.jpg`, reencoded, {
      access: 'public',
      contentType: 'image/jpeg',
      token: BLOB_TOKEN,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });

    await sql`UPDATE tracks SET cover_art = ${url} WHERE id = ${row.id}`;

    const beforeKb = (buffer.length / 1024).toFixed(0);
    const afterKb = (reencoded.length / 1024).toFixed(0);
    console.log(
      `[ok] ${row.id} "${row.title}" ${mime} ${beforeKb}KB -> ${afterKb}KB -> ${url}`,
    );
    updated++;
  } catch (error) {
    console.error(`[fail] ${row.id} "${row.title}": ${error.message}`);
    failed++;
  }
}

console.log(`\nDone. updated=${updated} failed=${failed}`);

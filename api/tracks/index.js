import { createClient } from '@neondatabase/serverless';

function getClient() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  return createClient({ connectionString: process.env.DATABASE_URL });
}

export default async function (req, res) {
  try {
    const client = getClient();
    if (req.method === 'GET') {
      const result = await client.query(
        `SELECT t.*, COALESCE(m.play_count,0) AS play_count, COALESCE(m.vibe_total,0) AS vibe_total, COALESCE(m.vibe_count,0) AS vibe_count, m.last_played_at
         FROM tracks t
         LEFT JOIN track_metrics m ON m.track_id = t.id
         ORDER BY t.sort_order ASC, t.added_at ASC`);
      return res.status(200).json(result.rows || []);
    }

    if (req.method === 'POST') {
      // Expect JSON body with metadata and already uploaded file URL
      const payload = req.body;
      const { id, title, artist, src, storagePath, coverArt, duration, addedAt, sortOrder } = payload || {};
      if (!id || !title || !artist || !src) {
        return res.status(400).json({ message: 'Missing id,title,artist,src' });
      }

      await client.query(
        `INSERT INTO tracks (id,title,artist,audio_url,audio_path,cover_art,duration,added_at,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, title, artist, src, storagePath || null, coverArt || null, Number(duration) || 0, Number(addedAt) || Date.now(), Number(sortOrder) || 0]
      );

      return res.status(201).json({ id, title, artist, src, storagePath, coverArt, duration, addedAt });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (err) {
    console.error('/api/tracks error', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

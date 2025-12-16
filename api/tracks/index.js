import { neon } from '@neondatabase/serverless';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  return neon(process.env.DATABASE_URL);
}

export default async function handler(req, res) {
  try {
    const sql = getSql();
    
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT t.*, COALESCE(m.play_count,0) AS play_count, COALESCE(m.vibe_total,0) AS vibe_total, COALESCE(m.vibe_count,0) AS vibe_count, m.last_played_at
        FROM tracks t
        LEFT JOIN track_metrics m ON m.track_id = t.id
        ORDER BY t.sort_order ASC, t.added_at ASC`;
      return res.status(200).json(rows || []);
    }

    if (req.method === 'POST') {
      const payload = req.body;
      const { id, title, artist, src, storagePath, coverArt, duration, addedAt, sortOrder } = payload || {};
      if (!id || !title || !artist || !src) {
        return res.status(400).json({ message: 'Missing id,title,artist,src' });
      }

      await sql`
        INSERT INTO tracks (id,title,artist,audio_url,audio_path,cover_art,duration,added_at,sort_order)
        VALUES (${id}, ${title}, ${artist}, ${src}, ${storagePath || null}, ${coverArt || null}, ${Number(duration) || 0}, ${Number(addedAt) || Date.now()}, ${Number(sortOrder) || 0})`;

      return res.status(201).json({ id, title, artist, src, storagePath, coverArt, duration, addedAt });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ message: 'Missing track id' });
      }
      await sql`DELETE FROM tracks WHERE id = ${id}`;
      return res.status(200).json({ deleted: id });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).end();
  } catch (err) {
    console.error('/api/tracks error', err);
    return res.status(500).json({ message: err.message });
  }
}

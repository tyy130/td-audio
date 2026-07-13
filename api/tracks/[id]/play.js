import { ensureSchema, getSql } from '../../_lib/tracks.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end();
    }

    const sql = getSql();
    await ensureSchema(sql);
    const { id } = req.query;
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Missing track id' });
    }

    const now = Date.now();

    await sql`
      INSERT INTO track_metrics (track_id, play_count, vibe_total, vibe_count, last_played_at)
      VALUES (${id}, 1, 0, 0, ${now})
      ON CONFLICT (track_id)
      DO UPDATE SET
        play_count = track_metrics.play_count + 1,
        last_played_at = ${now}
    `;

    const rows = await sql`
      SELECT
        play_count,
        vibe_total,
        vibe_count,
        COALESCE(
          ROUND((vibe_total::numeric / NULLIF(vibe_count, 0)), 1),
          0
        ) AS vibe_average,
        last_played_at
      FROM track_metrics
      WHERE track_id = ${id}
      LIMIT 1
    `;

    const metrics = rows[0];
    return res.status(200).json({
      playCount: Number(metrics?.play_count ?? 0),
      vibeTotal: Number(metrics?.vibe_total ?? 0),
      vibeCount: Number(metrics?.vibe_count ?? 0),
      vibeAverage: Number(metrics?.vibe_average ?? 0),
      lastPlayedAt: metrics?.last_played_at == null ? undefined : Number(metrics.last_played_at),
    });
  } catch (err) {
    console.error('/api/tracks/[id]/play error', err);
    return res.status(500).json({ message: err.message });
  }
}

import { requireAdmin } from '../_lib/auth.js';
import { ensureSchema, getSql, mapTrackRow } from '../_lib/tracks.js';

export default async function handler(req, res) {
  try {
    const sql = getSql();
    await ensureSchema(sql);
    
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT
          t.*,
          COALESCE(m.play_count, 0) AS play_count,
          COALESCE(m.vibe_total, 0) AS vibe_total,
          COALESCE(m.vibe_count, 0) AS vibe_count,
          COALESCE(
            ROUND((m.vibe_total::numeric / NULLIF(m.vibe_count, 0)), 1),
            0
          ) AS vibe_average,
          m.last_played_at
        FROM tracks t
        LEFT JOIN track_metrics m ON m.track_id = t.id
        ORDER BY t.sort_order ASC, t.added_at ASC
      `;
      return res.status(200).json((rows || []).map(mapTrackRow));
    }

    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const payload = req.body;
      const { id, title, artist, src, storagePath, coverArt, waveformPeaks, duration, addedAt, sortOrder } = payload || {};
      if (!id || !title || !artist || !src) {
        return res.status(400).json({ message: 'Missing id,title,artist,src' });
      }

      const serializedWaveformPeaks =
        Array.isArray(waveformPeaks) && waveformPeaks.every((value) => Number.isFinite(Number(value)))
          ? JSON.stringify(waveformPeaks.map((value) => Number(value)))
          : null;

      await sql`
        INSERT INTO tracks (id,title,artist,audio_url,audio_path,cover_art,waveform_peaks,duration,added_at,sort_order)
        VALUES (${id}, ${title}, ${artist}, ${src}, ${storagePath || null}, ${coverArt || null}, ${serializedWaveformPeaks}, ${Number(duration) || 0}, ${Number(addedAt) || Date.now()}, ${Number(sortOrder) || 0})`;

      return res.status(201).json({
        id,
        title,
        artist,
        src,
        storagePath: storagePath || undefined,
        coverArt: coverArt || undefined,
        waveformPeaks: serializedWaveformPeaks ? JSON.parse(serializedWaveformPeaks) : undefined,
        duration: Number(duration) || 0,
        addedAt: Number(addedAt) || Date.now(),
        sortOrder: Number(sortOrder) || 0,
        playCount: 0,
        vibeTotal: 0,
        vibeCount: 0,
        vibeAverage: 0,
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (err) {
    console.error('/api/tracks error', err);
    return res.status(500).json({ message: err.message });
  }
}

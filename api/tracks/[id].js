import { requireAdmin } from '../_lib/auth.js';
import { ensureSchema, getSql, loadTrack, mapTrackRow } from '../_lib/tracks.js';

export default async function handler(req, res) {
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const { id } = req.query;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Missing track id' });
    }

    if (req.method === 'GET') {
      const row = await loadTrack(sql, id);
      if (!row) {
        return res.status(404).json({ message: 'Track not found' });
      }
      return res.status(200).json(mapTrackRow(row));
    }

    if (req.method === 'PATCH') {
      if (!requireAdmin(req, res)) return;

      const payload = req.body || {};
      const title = typeof payload.title === 'string' ? payload.title.trim() : null;
      const artist = typeof payload.artist === 'string' ? payload.artist.trim() : null;
      const coverArt = typeof payload.coverArt === 'string' ? payload.coverArt.trim() : null;
      const sortOrder = Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : null;

      await sql`
        UPDATE tracks
        SET
          title = COALESCE(${title || null}, title),
          artist = COALESCE(${artist || null}, artist),
          cover_art = COALESCE(${coverArt || null}, cover_art),
          sort_order = COALESCE(${sortOrder}, sort_order)
        WHERE id = ${id}
      `;

      const row = await loadTrack(sql, id);
      if (!row) {
        return res.status(404).json({ message: 'Track not found' });
      }
      return res.status(200).json(mapTrackRow(row));
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      await sql`DELETE FROM tracks WHERE id = ${id}`;
      return res.status(200).json({ deleted: id });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).end();
  } catch (err) {
    console.error('/api/tracks/[id] error', err);
    return res.status(500).json({ message: err.message });
  }
}

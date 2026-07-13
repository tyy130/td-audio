import { requireAdmin } from '../_lib/auth.js';
import { ensureSchema, getSql } from '../_lib/tracks.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  try {
    if (!requireAdmin(req, res)) return;

    const sql = getSql();
    await sql`DROP TABLE IF EXISTS track_metrics CASCADE`;
    await sql`DROP TABLE IF EXISTS tracks CASCADE`;
    await ensureSchema(sql, { force: true });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('/api/admin/rebuild-schema error', err);
    return res.status(500).json({ message: err.message });
  }
}

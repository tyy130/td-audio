import { requireAdmin } from '../_lib/auth.js';
import { ensureSchema, getSql } from '../_lib/tracks.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end();
    }

    if (!requireAdmin(req, res)) return;

    const sql = getSql();
    await ensureSchema(sql);
    const order = Array.isArray(req.body?.order) ? req.body.order : null;
    if (!order || order.length === 0) {
      return res.status(400).json({ message: 'Missing order array' });
    }

    await Promise.all(
      order.map((id, index) =>
        sql`UPDATE tracks SET sort_order = ${index} WHERE id = ${id}`
      )
    );

    return res.status(200).json({ ok: true, count: order.length });
  } catch (err) {
    console.error('/api/tracks/reorder error', err);
    return res.status(500).json({ message: err.message });
  }
}

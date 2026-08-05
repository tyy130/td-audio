import { ensureSchema, getSql } from '../../_lib/tracks.js';

const MAX_PEAKS = 1000;
const MAX_DURATION_SECONDS = 60 * 60 * 24;

function sanitizePeaks(value) {
  if (!Array.isArray(value)) return null;
  if (value.length < 20 || value.length > MAX_PEAKS) return null;
  const peaks = value.map((entry) => Number(entry));
  if (!peaks.every((entry) => Number.isFinite(entry))) return null;
  return peaks.map((entry) => Math.max(0, Math.min(1, entry)));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  try {
    const { id } = req.query;
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Missing track id' });
    }

    const payload = req.body || {};
    const peaks = sanitizePeaks(payload.peaks);
    if (!peaks) {
      return res.status(400).json({ message: 'peaks must be an array of 20-1000 finite values' });
    }

    const rawDuration = Number(payload.duration);
    const duration =
      Number.isFinite(rawDuration) && rawDuration > 0
        ? Math.min(Math.round(rawDuration), MAX_DURATION_SECONDS)
        : null;

    const sql = getSql();
    await ensureSchema(sql);

    const result = await sql`
      UPDATE tracks
      SET
        waveform_peaks = ${JSON.stringify(peaks)},
        duration = COALESCE(${duration}, duration)
      WHERE id = ${id}
      RETURNING id
    `;

    if (!result.length) {
      return res.status(404).json({ message: 'Track not found' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('/api/tracks/[id]/waveform error', err);
    return res.status(500).json({ message: err.message });
  }
}

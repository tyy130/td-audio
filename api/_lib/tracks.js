import { neon } from '@neondatabase/serverless';

let schemaReady = false;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }
  return neon(process.env.DATABASE_URL);
}

export async function ensureSchema(sql, options = {}) {
  if (schemaReady && !options.force) return;

  await sql`
    CREATE TABLE IF NOT EXISTS tracks (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      artist VARCHAR(255) NOT NULL,
      audio_url TEXT NOT NULL,
      audio_path TEXT DEFAULT NULL,
      cover_art TEXT DEFAULT NULL,
      waveform_peaks TEXT DEFAULT NULL,
      duration INT DEFAULT 0,
      added_at BIGINT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    )
  `;

  await sql`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS waveform_peaks TEXT DEFAULT NULL`;

  await sql`CREATE INDEX IF NOT EXISTS idx_tracks_added_at ON tracks(added_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS track_metrics (
      track_id VARCHAR(36) PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
      play_count INT NOT NULL DEFAULT 0,
      vibe_total INT NOT NULL DEFAULT 0,
      vibe_count INT NOT NULL DEFAULT 0,
      last_played_at BIGINT NULL
    )
  `;

  schemaReady = true;
}

export function mapTrackRow(row) {
  let waveformPeaks;
  if (typeof row.waveform_peaks === 'string' && row.waveform_peaks.length > 0) {
    try {
      const parsed = JSON.parse(row.waveform_peaks);
      if (Array.isArray(parsed)) {
        waveformPeaks = parsed;
      }
    } catch (error) {
      console.warn('Unable to parse waveform peaks', error);
    }
  }

  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    src: row.audio_url,
    storagePath: row.audio_path ?? undefined,
    coverArt: row.cover_art ?? undefined,
    waveformPeaks,
    duration: Number(row.duration ?? 0),
    addedAt: Number(row.added_at ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    playCount: Number(row.play_count ?? 0),
    vibeTotal: Number(row.vibe_total ?? 0),
    vibeCount: Number(row.vibe_count ?? 0),
    vibeAverage: Number(row.vibe_average ?? 0),
    lastPlayedAt: row.last_played_at == null ? undefined : Number(row.last_played_at),
  };
}

export async function loadTrack(sql, id) {
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
    WHERE t.id = ${id}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

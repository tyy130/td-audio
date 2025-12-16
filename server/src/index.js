import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@neondatabase/serverless';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

const mediaRoot = process.env.MEDIA_ROOT || path.resolve(__dirname, '../uploads');
const mediaBaseUrl = process.env.MEDIA_BASE_URL || '';
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024);

fs.mkdirSync(mediaRoot, { recursive: true });

const db = createClient({ connectionString: process.env.DATABASE_URL });

async function query(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows || [];
}

const app = express();

const ensureSchema = async () => {
  // Create tracks table if missing (Postgres syntax)
  await query(
    `CREATE TABLE IF NOT EXISTS tracks (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      artist VARCHAR(255) NOT NULL,
      audio_url TEXT NOT NULL,
      audio_path TEXT DEFAULT NULL,
      cover_art TEXT DEFAULT NULL,
      duration INT DEFAULT 0,
      added_at BIGINT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    );`
  );

  await query(`CREATE INDEX IF NOT EXISTS idx_tracks_added_at ON tracks(added_at);`);

  await query(
    `CREATE TABLE IF NOT EXISTS track_metrics (
      track_id VARCHAR(36) PRIMARY KEY,
      play_count INT NOT NULL DEFAULT 0,
      vibe_total INT NOT NULL DEFAULT 0,
      vibe_count INT NOT NULL DEFAULT 0,
      last_played_at BIGINT NULL,
      CONSTRAINT fk_track_metrics_track FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );`
  );
};

ensureSchema().catch((error) => {
  console.error('Failed to ensure schema is up to date', error);
});

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
}));
app.use(express.json());
app.use('/media', express.static(mediaRoot));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, mediaRoot),
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-');
    const baseId = req.body?.id || crypto.randomUUID();
    cb(null, `${baseId}-${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxUploadBytes },
});

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const requireAdmin = (req, res, next) => {
  if (!ADMIN_TOKEN) {
    return next();
  }

  const headerToken = req.header('x-admin-token');
  if (headerToken !== ADMIN_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

const mapRowToTrack = (row) => ({
  id: row.id,
  title: row.title,
  artist: row.artist,
  src: row.audio_url,
  storagePath: row.audio_path || undefined,
  coverArt: row.cover_art || undefined,
  duration: row.duration || 0,
  addedAt: Number(row.added_at) || Date.now(),
  sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
  playCount: Number(row.play_count) || 0,
  vibeTotal: Number(row.vibe_total) || 0,
  vibeCount: Number(row.vibe_count) || 0,
  vibeAverage:
    Number(row.vibe_count) > 0
      ? Math.round((Number(row.vibe_total) / Number(row.vibe_count)) * 10) / 10
      : 0,
  lastPlayedAt: row.last_played_at ? Number(row.last_played_at) : undefined,
});

const buildPublicUrl = (relativePath) => {
  if (!relativePath) return '';
  if (mediaBaseUrl) {
    const normalizedBase = mediaBaseUrl.endsWith('/') ? mediaBaseUrl : `${mediaBaseUrl}/`;
    return new URL(relativePath.replace(/^\/+/, ''), normalizedBase).toString();
  }
  return `/media/${relativePath}`;
};

const deleteIfExists = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('Failed to delete file', filePath, err.message);
    }
  }
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/tracks', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT t.*, m.play_count, m.vibe_total, m.vibe_count, m.last_played_at
       FROM tracks t
       LEFT JOIN track_metrics m ON m.track_id = t.id
       ORDER BY t.sort_order ASC, t.added_at ASC`
    );
    res.json(rows.map(mapRowToTrack));
  } catch (error) {
    console.error('Failed to fetch tracks', error);
    res.status(500).json({ message: 'Failed to fetch tracks' });
  }
});

app.post('/tracks', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { id, title, artist, coverArt, duration, addedAt, sortOrder } = req.body;
    if (!id || !title || !artist) {
      await deleteIfExists(req.file?.path);
      return res.status(400).json({ message: 'Missing id, title, or artist' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Missing audio file' });
    }

    const relativePath = path.relative(mediaRoot, req.file.path).replace(/\\/g, '/');
    const audioUrl = buildPublicUrl(relativePath);

    const orderRows = await query('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM tracks');
    const resolvedSort = Number(sortOrder) || Number(orderRows?.[0]?.max_order || 0) + 1;

    await query(
      `INSERT INTO tracks (id, title, artist, audio_url, audio_path, cover_art, duration, added_at, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        title,
        artist,
        audioUrl,
        relativePath,
        coverArt || null,
        Number(duration) || 0,
        Number(addedAt) || Date.now(),
        resolvedSort,
      ]
    );

    res.status(201).json({
      id,
      title,
      artist,
      src: audioUrl,
      storagePath: relativePath,
      coverArt: coverArt || undefined,
      duration: Number(duration) || 0,
      addedAt: Number(addedAt) || Date.now(),
      sortOrder: resolvedSort,
    });
  } catch (error) {
    console.error('Failed to save track', error);
    if (req.file?.path) {
      await deleteIfExists(req.file.path);
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Track with this ID already exists' });
    }
    res.status(500).json({ message: 'Failed to save track' });
  }
});

app.delete('/tracks/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Missing track id' });
  }

  try {
    const rows = await query('SELECT audio_path FROM tracks WHERE id = $1', [id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Track not found' });
    }

    await query('DELETE FROM tracks WHERE id = $1', [id]);

    const relativePath = rows[0].audio_path;
    if (relativePath) {
      const absolutePath = path.join(mediaRoot, relativePath);
      await deleteIfExists(absolutePath);
    }

    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete track', error);
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.warn('Rollback failed', rollbackError.message);
    }
    res.status(500).json({ message: 'Failed to delete track' });
  } finally {
    connection.release();
  }
});

app.patch('/tracks/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, artist, coverArt, sortOrder } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Missing track id' });
  }

  const updates = [];
  const values = [];

  if (typeof title === 'string') {
    updates.push('title = ?');
    values.push(title);
  }
  if (typeof artist === 'string') {
    updates.push('artist = ?');
    values.push(artist);
  }
  if (typeof coverArt === 'string') {
    updates.push('cover_art = ?');
    values.push(coverArt);
  }
  if (typeof sortOrder === 'number') {
    updates.push('sort_order = ?');
    values.push(sortOrder);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No updates provided' });
  }

  values.push(id);

  try {
    const setClause = updates.join(', ');
    const updated = await query(`UPDATE tracks SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (!updated.length) {
      return res.status(404).json({ message: 'Track not found' });
    }
    const [row] = await query(
      `SELECT t.*, m.play_count, m.vibe_total, m.vibe_count, m.last_played_at
       FROM tracks t
       LEFT JOIN track_metrics m ON m.track_id = t.id
       WHERE t.id = $1
       LIMIT 1`,
      [id]
    );

    if (!row) {
      return res.status(404).json({ message: 'Track not found' });
    }

    res.json(mapRowToTrack(row));
  } catch (error) {
    console.error('Failed to update track', error);
    res.status(500).json({ message: 'Failed to update track' });
  }
});

app.post('/tracks/reorder', requireAdmin, async (req, res) => {
  const { order } = req.body;

  if (!Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ message: 'Order must be a non-empty array of track ids' });
  }

  try {
    await query('BEGIN');
    for (let i = 0; i < order.length; i += 1) {
      await query('UPDATE tracks SET sort_order = $1 WHERE id = $2', [i, order[i]]);
    }
    await query('COMMIT');
    res.json({ message: 'Order updated' });
  } catch (error) {
    console.error('Failed to reorder tracks', error);
    try {
      await query('ROLLBACK');
    } catch (rollbackError) {
      console.warn('Rollback failed after reorder', rollbackError.message);
    }
    res.status(500).json({ message: 'Failed to reorder tracks' });
  }
});

const fetchMetrics = async (id) => {
  const rows = await query(
    `SELECT play_count, vibe_total, vibe_count, last_played_at FROM track_metrics WHERE track_id = $1 LIMIT 1`,
    [id]
  );
  const metrics = rows[0] || {};
  const vibeAverage = metrics.vibe_count
    ? Math.round((Number(metrics.vibe_total) / Number(metrics.vibe_count)) * 10) / 10
    : 0;
  return {
    playCount: Number(metrics.play_count) || 0,
    vibeTotal: Number(metrics.vibe_total) || 0,
    vibeCount: Number(metrics.vibe_count) || 0,
    vibeAverage,
    lastPlayedAt: metrics.last_played_at ? Number(metrics.last_played_at) : undefined,
  };
};

app.post('/tracks/:id/play', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Missing track id' });
  }

  const playedAt = Date.now();

  try {
    await query(
      `INSERT INTO track_metrics (track_id, play_count, last_played_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (track_id) DO UPDATE SET play_count = track_metrics.play_count + 1, last_played_at = EXCLUDED.last_played_at`,
      [id, playedAt]
    );

    const metrics = await fetchMetrics(id);
    res.json(metrics);
  } catch (error) {
    console.error('Failed to record play', error);
    res.status(500).json({ message: 'Failed to record play' });
  }
});

app.post('/tracks/:id/vibe', async (req, res) => {
  const { id } = req.params;
  const { score } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Missing track id' });
  }

  const normalized = Math.min(Math.max(Number(score) || 1, 1), 5);

  try {
    await query(
      `INSERT INTO track_metrics (track_id, vibe_total, vibe_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (track_id) DO UPDATE SET vibe_total = track_metrics.vibe_total + EXCLUDED.vibe_total, vibe_count = track_metrics.vibe_count + 1`,
      [id, normalized]
    );

    const metrics = await fetchMetrics(id);
    res.json(metrics);
  } catch (error) {
    console.error('Failed to record vibe', error);
    res.status(500).json({ message: 'Failed to record vibe' });
  }
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Slughouse backend listening on port ${port}`);
});

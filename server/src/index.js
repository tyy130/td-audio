import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createPool } from 'mysql2/promise';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requiredEnvVars = [
  'MYSQL_HOST',
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

const mediaRoot = process.env.MEDIA_ROOT || path.resolve(__dirname, '../uploads');
const mediaBaseUrl = process.env.MEDIA_BASE_URL || '';
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024);

fs.mkdirSync(mediaRoot, { recursive: true });

const pool = createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONN_LIMIT) || 10,
});

const app = express();

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
    const [rows] = await pool.query('SELECT * FROM tracks ORDER BY added_at ASC');
    res.json(rows.map(mapRowToTrack));
  } catch (error) {
    console.error('Failed to fetch tracks', error);
    res.status(500).json({ message: 'Failed to fetch tracks' });
  }
});

app.post('/tracks', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { id, title, artist, coverArt, duration, addedAt } = req.body;
    if (!id || !title || !artist) {
      await deleteIfExists(req.file?.path);
      return res.status(400).json({ message: 'Missing id, title, or artist' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Missing audio file' });
    }

    const relativePath = path.relative(mediaRoot, req.file.path).replace(/\\/g, '/');
    const audioUrl = buildPublicUrl(relativePath);

    await pool.execute(
      `INSERT INTO tracks (id, title, artist, audio_url, audio_path, cover_art, duration, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title,
        artist,
        audioUrl,
        relativePath,
        coverArt || null,
        Number(duration) || 0,
        Number(addedAt) || Date.now(),
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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT audio_path FROM tracks WHERE id = ?', [id]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Track not found' });
    }

    await connection.query('DELETE FROM tracks WHERE id = ?', [id]);
    await connection.commit();

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

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Slughouse backend listening on port ${port}`);
});

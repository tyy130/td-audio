import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(200).json({ status: 'ok', db: 'missing' });
    }
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1`;
    return res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('health check failed', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

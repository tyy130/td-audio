import { createClient } from '@neondatabase/serverless';

export default async function (req, res) {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(200).json({ status: 'ok', db: 'missing' });
    }
    const client = createClient({ connectionString: process.env.DATABASE_URL });
    // simple query
    await client.query('SELECT 1');
    return res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('health check failed', err);
    return res.status(500).json({ status: 'error', message: 'DB connection failed' });
  }
}

/**
 * Neon (serverless) DB helper for edge or serverless functions.
 * Uses @neondatabase/serverless which is compatible with serverless runtimes.
 */
import { createClient } from '@neondatabase/serverless';

const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!conn) {
  console.warn('DATABASE_URL not set; db-neon will fail until configured');
}

const client = createClient({ connectionString: conn });

export async function query(sql: string, params: any[] = []) {
  const res = await client.query(sql, params);
  return res.rows ?? res;
}

export async function getTracks() {
  return await query('SELECT id, title, artist, audio_url as src, audio_path as "storagePath", cover_art as "coverArt", duration, added_at as "addedAt" FROM tracks ORDER BY added_at ASC');
}

export default { query, getTracks };

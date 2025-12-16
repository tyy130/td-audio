import { NextRequest } from 'next/server';
import { getTracks } from '../services/db-neon';

export const runtime = 'edge';

export default async function handler(req: NextRequest) {
  try {
    const rows = await getTracks();
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('edge-tracks error', e);
    return new Response(JSON.stringify({ message: 'DB error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

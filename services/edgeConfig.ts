/**
 * Lightweight wrapper for Vercel Edge Config.
 * Use for non-secret, frequently-read config (feature flags, media base url).
 * Secrets must remain in environment variables / Vercel Secrets.
 */
import { get as edgeGet } from '@vercel/edge-config';

export async function getEdgeValue(key: string) {
  try {
    const v = await edgeGet(key);
    return v ?? null;
  } catch (e) {
    console.warn('edge-config get failed:', e);
    return null;
  }
}

export async function getMultiple(keys: string[]) {
  const out: Record<string, any> = {};
  for (const k of keys) out[k] = await getEdgeValue(k);
  return out;
}

export default { getEdgeValue, getMultiple };

import { Track } from '../types';

const resolveDefaultApi = () => {
  if (typeof window === 'undefined') return '';
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4000';
  }
  // Default for production when frontend is deployed under /playback - backend API lives at /playback/api
  return '/playback/api';
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || resolveDefaultApi()).replace(/\/$/, '');
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || '';

const withAdminHeaders = () => {
  if (!ADMIN_TOKEN) return undefined;
  return { 'x-admin-token': ADMIN_TOKEN };
};

const handleResponse = async (response: Response) => {
  if (response.ok) {
    return response;
  }

  let message = 'Request failed';
  try {
    const payload = await response.json();
    if (typeof payload?.message === 'string') {
      message = payload.message;
    }
  } catch {
    message = response.statusText || message;
  }

  throw new Error(message);
};

const buildUrl = (path: string) => {
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
};

interface TrackInsert {
  id: string;
  title: string;
  artist: string;
  coverArt?: string;
  duration?: number;
  addedAt: number;
}

export const saveTrack = async (metadata: TrackInsert, file: File): Promise<Track> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('id', metadata.id);
  formData.append('title', metadata.title);
  formData.append('artist', metadata.artist);
  formData.append('coverArt', metadata.coverArt ?? '');
  formData.append('duration', String(metadata.duration ?? 0));
  formData.append('addedAt', String(metadata.addedAt));

  const response = await fetch(buildUrl('/tracks'), {
    method: 'POST',
    body: formData,
    headers: withAdminHeaders(),
  });

  const handled = await handleResponse(response);
  return handled.json();
};

export const getAllTracks = async (): Promise<Track[]> => {
  const response = await fetch(buildUrl('/tracks'));
  const handled = await handleResponse(response);
  return handled.json();
};

export const deleteTrack = async (track: Track): Promise<void> => {
  const response = await fetch(buildUrl(`/tracks/${track.id}`), {
    method: 'DELETE',
    headers: withAdminHeaders(),
  });
  await handleResponse(response);
};
import { Track } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export const handleResponse = async (response: Response) => {
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

export const buildUrl = (path: string) => {
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
};

export interface TrackInsert {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  album?: string;
  coverArt?: string;
  waveformPeaks?: number[];
  duration?: number;
  addedAt: number;
  sortOrder?: number;
}

export interface TrackMetrics {
  playCount: number;
  vibeTotal: number;
  vibeCount: number;
  vibeAverage: number;
  lastPlayedAt?: number;
}

export const getAllTracks = async (): Promise<Track[]> => {
  const response = await fetch(buildUrl('/tracks'));
  const handled = await handleResponse(response);
  return handled.json();
};

export const deleteTrack = async (track: Track): Promise<void> => {
  const response = await fetch(buildUrl(`/tracks/${track.id}`), {
    method: 'DELETE',
  });
  await handleResponse(response);
};

export const updateTrack = async (
  id: string,
  payload: Partial<Pick<Track, 'title' | 'artist' | 'genre' | 'album' | 'coverArt' | 'sortOrder'>>
): Promise<Track> => {
  const response = await fetch(buildUrl(`/tracks/${id}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const handled = await handleResponse(response);
  return handled.json();
};

export const reorderTracks = async (order: string[]): Promise<void> => {
  const response = await fetch(buildUrl('/tracks/reorder'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order }),
  });
  await handleResponse(response);
};

export const recordPlayback = async (id: string): Promise<TrackMetrics> => {
  const response = await fetch(buildUrl(`/tracks/${id}/play`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const handled = await handleResponse(response);
  return handled.json();
};

export const sendVibe = async (id: string, score: number): Promise<TrackMetrics> => {
  const response = await fetch(buildUrl(`/tracks/${id}/vibe`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score }),
  });
  const handled = await handleResponse(response);
  return handled.json();
};

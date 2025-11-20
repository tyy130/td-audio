import { Track } from './types';

export const DB_NAME = 'sonic_stream_db';
export const DB_VERSION = 1;
export const STORE_NAME = 'tracks';

export const DEFAULT_COVER = 'https://picsum.photos/300/300';

export const MOCK_TRACK: Track = {
  id: 'demo-1',
  title: 'Welcome to TD Audio Player',
  artist: 'System',
  src: '', 
  duration: 0,
  addedAt: Date.now(),
  description: 'Add your own music in the Admin panel!',
  coverArt: 'https://picsum.photos/300/300?grayscale'
};
import { Track } from './types';

export const DEFAULT_COVER = 'https://picsum.photos/300/300';

export const MOCK_TRACK: Track = {
  id: 'demo-1',
  title: 'Welcome to Slughouse Records',
  artist: 'System',
  src: '', 
  duration: 0,
  addedAt: Date.now(),
  coverArt: 'https://picsum.photos/300/300?grayscale'
};
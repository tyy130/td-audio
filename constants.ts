import { Track } from './types';

// Consistent dark placeholder with music icon
export const DEFAULT_COVER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='100%25' height='100%25' fill='%23111'/%3E%3Cpath d='M9 18V5l12-2v13' stroke='%23444'/%3E%3Ccircle cx='6' cy='18' r='3' stroke='%23444'/%3E%3Ccircle cx='18' cy='16' r='3' stroke='%23444'/%3E%3C/svg%3E`;

export const MOCK_TRACK: Track = {
  id: 'demo-1',
  title: 'Welcome to Slughouse Records',
  artist: 'System',
  src: '', 
  duration: 0,
  addedAt: Date.now(),
  coverArt: DEFAULT_COVER
};
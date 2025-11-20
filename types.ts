export interface Track {
  id: string;
  title: string;
  artist: string;
  src: string; // Remote URL
  duration: number;
  coverArt?: string;
  addedAt: number;
  storagePath?: string;
}

export enum AppView {
  PLAYER = 'PLAYER',
  ADMIN = 'ADMIN',
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

export interface PersistentSettings {
  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
}
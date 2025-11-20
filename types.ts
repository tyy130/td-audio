export interface Track {
  id: string;
  title: string;
  artist: string;
  src: string; // Blob URL or Remote URL
  fileHandle?: File; // For internal IDB storage logic
  duration: number;
  coverArt?: string;
  description?: string;
  addedAt: number;
}

export enum AppView {
  PLAYER = 'PLAYER',
  ADMIN = 'ADMIN',
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}
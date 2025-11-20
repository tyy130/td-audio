import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Track, AppView, RepeatMode, PersistentSettings } from './types';
import { getAllTracks } from './services/storage';
import Player from './components/Player';

// Lazy load Admin component - only loads when user clicks settings
const Admin = lazy(() => import('./components/Admin'));

function App() {
  const [view, setView] = useState<AppView>(AppView.PLAYER);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [volume, setVolume] = useState(1);

  // Initial Load
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const loadedTracks = await getAllTracks();
        setTracks(loadedTracks);
        if (loadedTracks.length > 0) {
          setCurrentTrack(loadedTracks[0]);
        }
      } catch (e) {
        console.error("Failed to load library", e);
      }
    };
    loadLibrary();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('td-audio-settings');
      if (!raw) return;
      const stored: PersistentSettings = JSON.parse(raw);
      if (typeof stored.volume === 'number') setVolume(Math.min(Math.max(stored.volume, 0), 1));
      if (typeof stored.shuffle === 'boolean') setIsShuffle(stored.shuffle);
      if (stored.repeatMode === 'off' || stored.repeatMode === 'all' || stored.repeatMode === 'one') {
        setRepeatMode(stored.repeatMode);
      }
    } catch (err) {
      console.warn('Unable to load settings', err);
    }
  }, []);

  useEffect(() => {
    const payload: PersistentSettings = {
      volume,
      shuffle: isShuffle,
      repeatMode,
    };
    localStorage.setItem('td-audio-settings', JSON.stringify(payload));
  }, [volume, isShuffle, repeatMode]);

  // Playback logic wrappers
  const pickRandomTrack = () => {
    if (tracks.length === 0) return null;
    if (!currentTrack) return tracks[0];
    if (tracks.length === 1) return currentTrack;
    const pool = tracks.filter(t => t.id !== currentTrack.id);
    const randomIdx = Math.floor(Math.random() * pool.length);
    return pool[randomIdx] || null;
  };

  const handleNext = () => {
    if (!currentTrack || tracks.length === 0) return;
    if (isShuffle && tracks.length > 1) {
      const randomTrack = pickRandomTrack();
      if (randomTrack) setCurrentTrack(randomTrack);
      return;
    }
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    if (idx === -1) return;
    const nextIdx = (idx + 1) % tracks.length;
    setCurrentTrack(tracks[nextIdx]);
  };

  const handlePrev = () => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    const prevIdx = idx === 0 ? tracks.length - 1 : idx - 1;
    setCurrentTrack(tracks[prevIdx]);
  };

  const handleAutoAdvance = () => {
    if (!currentTrack || tracks.length === 0) return;
    if (repeatMode === 'one') {
      return;
    }
    if (isShuffle && tracks.length > 1) {
      const randomTrack = pickRandomTrack();
      if (randomTrack) setCurrentTrack(randomTrack);
      return;
    }
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    if (idx === -1) return;
    const isLastTrack = idx === tracks.length - 1;
    if (isLastTrack && repeatMode === 'off') {
      return;
    }
    const nextIdx = isLastTrack ? 0 : idx + 1;
    setCurrentTrack(tracks[nextIdx]);
  };

  const toggleShuffle = () => setIsShuffle(prev => !prev);

  const cycleRepeatMode = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#04010b] via-[#070112] to-black text-neutral-200 selection:bg-indigo-500 selection:text-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-[-10%] w-[28rem] h-[28rem] bg-indigo-600/20 blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-5%] w-[24rem] h-[24rem] bg-purple-500/20 blur-[140px]"></div>
      </div>
      <div className="relative z-10 antialiased">
        {view === AppView.PLAYER ? (
          <Player 
            currentTrack={currentTrack}
            tracks={tracks}
            onNext={handleNext}
            onPrev={handlePrev}
            onSelect={setCurrentTrack}
            onAdminOpen={() => setView(AppView.ADMIN)}
            onAutoAdvance={handleAutoAdvance}
            isShuffle={isShuffle}
            repeatMode={repeatMode}
            onShuffleToggle={toggleShuffle}
            onRepeatToggle={cycleRepeatMode}
            volume={volume}
            onVolumeChange={setVolume}
          />
        ) : (
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                <p className="text-neutral-400">Loading vault...</p>
              </div>
            </div>
          }>
            <Admin 
              tracks={tracks} 
              setTracks={setTracks} 
              onClose={() => setView(AppView.PLAYER)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default App;
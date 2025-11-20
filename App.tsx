import React, { useState, useEffect } from 'react';
import { Track, AppView } from './types';
import { getAllTracks } from './services/storage';
import Player from './components/Player';
import Admin from './components/Admin';

function App() {
  const [view, setView] = useState<AppView>(AppView.PLAYER);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

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

  // Playback logic wrappers
  const handleNext = () => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    const nextIdx = (idx + 1) % tracks.length;
    setCurrentTrack(tracks[nextIdx]);
  };

  const handlePrev = () => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    const prevIdx = idx === 0 ? tracks.length - 1 : idx - 1;
    setCurrentTrack(tracks[prevIdx]);
  };

  return (
    <div className="antialiased text-neutral-200 h-screen w-full bg-black selection:bg-indigo-500 selection:text-white">
      {view === AppView.PLAYER ? (
        <Player 
          currentTrack={currentTrack}
          tracks={tracks}
          onNext={handleNext}
          onPrev={handlePrev}
          onSelect={setCurrentTrack}
          onAdminOpen={() => setView(AppView.ADMIN)}
        />
      ) : (
        <Admin 
          tracks={tracks} 
          setTracks={setTracks} 
          onClose={() => setView(AppView.PLAYER)}
        />
      )}
    </div>
  );
}

export default App;
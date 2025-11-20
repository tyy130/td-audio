import React, { useEffect, useState } from 'react';
import { Track } from '../types';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic, Settings } from 'lucide-react';
import Visualizer from './Visualizer';
import { useAudio } from '../hooks/useAudio';
import { clsx } from 'clsx';
import { DEFAULT_COVER } from '../constants';

interface PlayerProps {
  currentTrack: Track | null;
  tracks: Track[];
  onNext: () => void;
  onPrev: () => void;
  onSelect: (track: Track) => void;
  onAdminOpen: () => void;
}

const Player: React.FC<PlayerProps> = ({ currentTrack, tracks, onNext, onPrev, onSelect, onAdminOpen }) => {
  const { isPlaying, togglePlay, duration, currentTime, seek, volume, changeVolume } = useAudio(
    currentTrack?.src || '',
    onNext
  );
  
  // Update duration display
  const formatTime = (time: number) => {
    if(isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-black text-neutral-200">
      
      {/* Header */}
      <header className="flex justify-between items-center p-6 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)]">
            <span className="font-bold text-white">T</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-white">TD Audio Player</span>
        </div>
        <button 
            onClick={onAdminOpen}
            className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all border border-neutral-800"
            title="Manage Library"
        >
            <Settings size={20} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row gap-6 p-6 pt-0 min-h-0">
        
        {/* Now Playing (Left/Top) */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {currentTrack ? (
            <div className="w-full max-w-md mx-auto space-y-8 text-center">
               <div className="relative group w-64 h-64 mx-auto">
                    <div className={clsx("absolute inset-0 bg-indigo-500 rounded-full blur-3xl opacity-10 transition-all duration-1000", isPlaying ? "scale-125 opacity-30" : "scale-100")}></div>
                    <img 
                        src={currentTrack.coverArt || DEFAULT_COVER} 
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null; // Prevent infinite loop
                          target.src = DEFAULT_COVER;
                        }}
                        alt="Cover" 
                        className={clsx("relative w-full h-full object-cover rounded-3xl shadow-2xl ring-1 ring-white/10 transition-transform duration-700 ease-in-out", isPlaying ? "scale-105" : "scale-100")}
                    />
               </div>
               
               <div className="space-y-2">
                   <h1 className="text-3xl font-bold text-white truncate px-4">{currentTrack.title}</h1>
                   <p className="text-neutral-400 font-medium text-lg truncate">{currentTrack.artist}</p>
                   {currentTrack.description && (
                       <p className="text-sm text-neutral-500 italic mt-2 max-w-xs mx-auto">"{currentTrack.description}"</p>
                   )}
               </div>

               <Visualizer isPlaying={isPlaying} />
            </div>
          ) : (
            <div className="text-neutral-600 text-center">
                <p className="text-xl mb-4">Library is empty or no track selected.</p>
                <button onClick={onAdminOpen} className="text-indigo-500 hover:text-indigo-400 underline">Add music now</button>
            </div>
          )}
        </div>

        {/* Playlist Sidebar (Right/Bottom) */}
        <div className="hidden md:flex w-80 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-800/50 flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-800/50 bg-black/20">
                <h3 className="font-semibold text-neutral-300 flex items-center gap-2">
                    <ListMusic size={18} /> Queue
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide space-y-1">
                {tracks.map((t, idx) => (
                    <div 
                        key={t.id}
                        onClick={() => onSelect(t)}
                        className={clsx(
                            "p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-all group",
                            currentTrack?.id === t.id 
                                ? "bg-white/5 border border-white/10" 
                                : "hover:bg-white/5 border border-transparent"
                        )}
                    >
                        <span className={clsx("text-xs font-mono w-5 text-center", currentTrack?.id === t.id ? "text-indigo-400" : "text-neutral-600")}>
                            {currentTrack?.id === t.id && isPlaying ? (
                                <span className="relative flex h-2 w-2 mx-auto">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                            ) : idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className={clsx("text-sm font-medium truncate", currentTrack?.id === t.id ? "text-white" : "text-neutral-400 group-hover:text-neutral-200")}>{t.title}</p>
                            <p className="text-xs text-neutral-600 truncate">{t.artist}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </main>

      {/* Controls Bar */}
      <div className="bg-black/90 backdrop-blur-xl border-t border-white/10 p-4 md:px-8 pb-8 md:pb-4 z-20 sticky bottom-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 md:items-center">
            
            {/* Progress Bar (Mobile Top / Desktop Middle) */}
            <div className="w-full md:hidden">
                <input 
                    type="range" 
                    min={0} 
                    max={duration || 100} 
                    value={currentTime} 
                    onChange={(e) => seek(Number(e.target.value))}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center justify-between md:justify-start md:w-1/3 gap-6">
                <button onClick={onPrev} className="text-neutral-500 hover:text-white transition-colors"><SkipBack size={24} /></button>
                <button 
                    onClick={togglePlay} 
                    className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={onNext} className="text-neutral-500 hover:text-white transition-colors"><SkipForward size={24} /></button>
            </div>

            {/* Desktop Progress */}
            <div className="hidden md:flex flex-1 flex-col justify-center px-4">
                 <input 
                    type="range" 
                    min={0} 
                    max={duration || 0.1} // Avoid /0
                    value={currentTime} 
                    onChange={(e) => seek(Number(e.target.value))}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all"
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Volume */}
            <div className="hidden md:flex items-center justify-end w-1/3 gap-3">
                <button onClick={() => changeVolume(volume === 0 ? 1 : 0)} className="text-neutral-500 hover:text-white">
                    {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input 
                    type="range" 
                    min={0} 
                    max={1} 
                    step={0.01} 
                    value={volume} 
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    className="w-24 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-400"
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
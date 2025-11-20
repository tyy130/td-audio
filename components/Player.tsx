import React, { useState, useEffect } from 'react';
import { Track, RepeatMode } from '../types';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic, Settings, Shuffle, Repeat, Repeat1, ExternalLink, Share2, Copy } from 'lucide-react';
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
  onAutoAdvance: () => void;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  onShuffleToggle: () => void;
  onRepeatToggle: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

const Player: React.FC<PlayerProps> = ({ 
  currentTrack, 
  tracks, 
  onNext, 
  onPrev, 
  onSelect, 
  onAdminOpen,
  onAutoAdvance,
  isShuffle,
  repeatMode,
  onShuffleToggle,
  onRepeatToggle,
  volume,
  onVolumeChange
}) => {
  const { isPlaying, togglePlay, duration, currentTime, seek, changeVolume } = useAudio(
    currentTrack?.src || '',
    onAutoAdvance,
    repeatMode === 'one',
    volume
  );
  const [toast, setToast] = useState<string | null>(null);

  const handleVolumeChange = (value: number) => {
    changeVolume(value);
    onVolumeChange(value);
  };

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const shareUrl = typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? window.location.origin
    : 'https://tdaudio-app.surge.sh';

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setToast('Invite link copied');
    } catch (err) {
      alert('Unable to copy link');
    }
  };

  const handleShare = async () => {
    const data = {
      title: currentTrack ? `${currentTrack.title} · ${currentTrack.artist}` : 'Slughouse Records',
      text: "You're on the list. This Slughouse drop is private.",
      url: shareUrl
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        setToast('Invite sent');
        return;
      } catch (err) {
        // fall through to clipboard copy
      }
    }
    await copyLink();
  };
  
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
        <div className="flex flex-col gap-1">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.6em] text-white/50">Private Listening Room</span>
          <span className="font-black text-2xl tracking-[0.25em] text-white uppercase">Slughouse Records</span>
          <span className="text-[0.6rem] uppercase tracking-[0.45em] text-white/60">Friends &amp; Family Proof</span>
        </div>
        <button
            onClick={onAdminOpen}
            className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all border border-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            title="Manage Library"
            aria-label="Open admin panel to manage library"
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
               </div>

               <Visualizer isPlaying={isPlaying} />
            </div>
          ) : (
            <div className="text-neutral-500 text-center">
                <p className="text-xl mb-4">The vault is silent. Load a private mix for the inner circle.</p>
                <button onClick={onAdminOpen} className="text-indigo-400 hover:text-indigo-300 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded">Open the vault</button>
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
      <div className="bg-black/90 backdrop-blur-xl border-t border-white/10 p-4 md:px-8 pb-6 md:pb-4 z-20 sticky bottom-0">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 md:items-center">
            
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
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-neutral-600 mt-3">
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-1 text-neutral-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded px-2 py-1"
                    aria-label="Share invite link"
                  >
                    <Share2 size={12} /> Share Invite
                  </button>
                  <button
                    onClick={copyLink}
                    className="inline-flex items-center gap-1 text-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded px-2 py-1"
                    aria-label="Copy invite link to clipboard"
                  >
                    <Copy size={11} /> Copy Invite
                  </button>
                </div>
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center justify-between md:justify-start md:w-1/3 gap-3">
              <button
                onClick={onShuffleToggle}
                className={clsx(
                  "p-2 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  isShuffle
                  ? "text-indigo-400 border-indigo-500 bg-indigo-500/10"
                  : "text-neutral-500 border-transparent hover:text-white hover:border-white/20"
                )}
                aria-pressed={isShuffle}
                aria-label={isShuffle ? 'Disable shuffle mode' : 'Enable shuffle mode'}
                title={isShuffle ? 'Shuffle enabled' : 'Enable shuffle'}
              >
                <Shuffle size={18} />
              </button>
              <div className="flex items-center gap-6">
                <button onClick={onPrev} className="text-neutral-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-full" aria-label="Previous track"><SkipBack size={24} /></button>
                <button
                  onClick={togglePlay}
                  className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={onNext} className="text-neutral-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-full" aria-label="Next track"><SkipForward size={24} /></button>
              </div>
              <button
                onClick={onRepeatToggle}
                className={clsx(
                  "p-2 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  repeatMode !== 'off'
                  ? "text-indigo-400 border-indigo-500 bg-indigo-500/10"
                  : "text-neutral-500 border-transparent hover:text-white hover:border-white/20"
                )}
                aria-pressed={repeatMode !== 'off'}
                aria-label={repeatMode === 'off' ? 'Enable repeat' : repeatMode === 'all' ? 'Repeat all tracks' : 'Repeat current track'}
                title={repeatMode === 'off' ? 'Enable repeat' : repeatMode === 'all' ? 'Repeat all' : 'Repeat current track'}
              >
                {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              </button>
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

            {/* Volume & Share */}
            <div className="hidden md:flex items-center justify-end w-1/3 gap-3">
                <button
                  onClick={handleShare}
                  className="text-neutral-400 hover:text-white hover:bg-white/5 transition-colors rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  title="Share invite link"
                  aria-label="Share invite link"
                >
                  <Share2 size={18} />
                </button>
                <button onClick={() => handleVolumeChange(volume === 0 ? 1 : 0)} className="text-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-full" aria-label={volume === 0 ? 'Unmute' : 'Mute'}>
                  {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input 
                    type="range" 
                    min={0} 
                    max={1} 
                    step={0.01} 
                    value={volume} 
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-24 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-400"
                />
            </div>
            </div>
        </div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-neutral-600">
            <span className="hidden md:inline">{isShuffle ? 'Shuffle on' : 'Shuffle off'} · Repeat {repeatMode}</span>
            <div className="ml-auto flex items-center gap-3">
              <a 
                href="https://playback.slughouse.com" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-neutral-300 hover:text-white text-xs font-semibold"
              >
                playback.slughouse.com <ExternalLink size={14} />
              </a>
              <span className="text-[0.6rem] tracking-[0.45em] text-white/40">keep it close</span>
            </div>
        </div>
        {toast && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/10 text-white text-xs px-4 py-2 rounded-full border border-white/20 backdrop-blur-md shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};

export default Player;
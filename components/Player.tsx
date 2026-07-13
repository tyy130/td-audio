import React, { useState, useEffect, useRef } from "react";
import { Track, RepeatMode } from "../types";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Settings,
  Shuffle,
  Repeat,
  Repeat1,
  Share2,
} from "lucide-react";
import Visualizer from "./Visualizer";
import { useAudio } from "../hooks/useAudio";
import { clsx } from "clsx";
import { DEFAULT_COVER } from "../constants";
import { recordPlayback, sendVibe, TrackMetrics } from "../services/storage";
import { extractWaveformPeaksFromUrl } from "../services/waveformPeaks";

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
  isLibraryLoading: boolean;
  onTrackMetrics: (id: string, metrics: TrackMetrics) => void;
}

const formatTime = (time: number) => {
  if (isNaN(time) || !isFinite(time)) return "0:00";
  const min = Math.floor(time / 60);
  const sec = Math.floor(time % 60);
  return `${min}:${sec < 10 ? "0" + sec : sec}`;
};

const pad = (n: number) => String(n).padStart(2, "0");

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0b]";

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
  onVolumeChange,
  isLibraryLoading,
  onTrackMetrics,
}) => {
  const {
    isPlaying,
    togglePlay,
    play,
    duration,
    currentTime,
    seek,
    changeVolume,
    waveformData,
  } = useAudio(
    currentTrack?.src || "",
    onAutoAdvance,
    repeatMode === "one",
    volume,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [resonance, setResonance] = useState(3);
  const [isSubmittingVibe, setIsSubmittingVibe] = useState(false);
  const [playRecordedFor, setPlayRecordedFor] = useState<string | null>(null);
  const [derivedWaveformPeaks, setDerivedWaveformPeaks] = useState<
    number[] | undefined
  >(undefined);
  const queuedTrackToPlayRef = useRef<string | null>(null);

  const currentIndex = currentTrack
    ? tracks.findIndex((t) => t.id === currentTrack.id)
    : -1;

  const handleVolumeChange = (value: number) => {
    changeVolume(value);
    onVolumeChange(value);
  };

  const handlePrevClick = () => {
    if (currentTime > 3) {
      seek(0);
    } else {
      onPrev();
    }
  };

  const handleSelectTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      play();
      return;
    }

    queuedTrackToPlayRef.current = track.id;
    onSelect(track);
  };

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    if (!currentTrack?.src) {
      setDerivedWaveformPeaks(undefined);
      return;
    }

    if (currentTrack.waveformPeaks?.length) {
      setDerivedWaveformPeaks(undefined);
      return;
    }

    extractWaveformPeaksFromUrl(currentTrack.src).then((analysis) => {
      if (cancelled) return;
      setDerivedWaveformPeaks(analysis.peaks);
    });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.src, currentTrack?.waveformPeaks]);

  useEffect(() => {
    if (!currentTrack || queuedTrackToPlayRef.current !== currentTrack.id) {
      return;
    }

    queuedTrackToPlayRef.current = null;
    play();
  }, [currentTrack?.id, play, currentTrack]);

  const shareUrl =
    typeof window !== "undefined" &&
    window.location.origin.includes("localhost")
      ? window.location.origin
      : "https://listen.slughouse.com";

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setToast("Invite link copied");
    } catch (err) {
      setToast("Unable to copy link");
    }
  };

  const handleShare = async () => {
    const data = {
      title: currentTrack
        ? `${currentTrack.title} · ${currentTrack.artist}`
        : "Slughouse Records",
      text: "You're on the list. This Slughouse drop is private.",
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        setToast("Invite sent");
        return;
      } catch (err) {
        // fall through to clipboard copy
      }
    }
    await copyLink();
  };

  useEffect(() => {
    if (!currentTrack) return;
    setResonance(
      Math.max(
        1,
        Math.min(
          currentTrack.vibeAverage ? Math.round(currentTrack.vibeAverage) : 3,
          5,
        ),
      ),
    );
    setPlayRecordedFor(null);
  }, [currentTrack?.id, currentTrack?.vibeAverage]);

  useEffect(() => {
    const capturePlay = async () => {
      if (!currentTrack || !isPlaying || playRecordedFor === currentTrack.id)
        return;
      try {
        const metrics = await recordPlayback(currentTrack.id);
        onTrackMetrics(currentTrack.id, metrics);
        setPlayRecordedFor(currentTrack.id);
      } catch (err) {
        console.error("Failed to record play", err);
      }
    };
    capturePlay();
  }, [currentTrack, isPlaying, onTrackMetrics, playRecordedFor]);

  const submitVibe = async (value: number) => {
    if (!currentTrack) return;
    setIsSubmittingVibe(true);
    try {
      const metrics = await sendVibe(currentTrack.id, value);
      onTrackMetrics(currentTrack.id, metrics);
      setResonance(value);
      setToast("Resonance saved");
    } catch (err) {
      console.error("Failed to submit resonance", err);
      setToast("Unable to send vibe right now");
    } finally {
      setIsSubmittingVibe(false);
    }
  };

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-[#0c0c0b] text-ink">
      {/* Header */}
      <header className="flex items-stretch justify-between border-b border-line">
        <div className="flex flex-col gap-0.5 px-4 py-3 md:px-6">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.4em] text-dim">
            Listening Room — Private
          </span>
          <span className="font-display text-lg uppercase leading-none tracking-tight md:text-xl">
            Slughouse Records
          </span>
        </div>
        <div className="flex items-stretch">
          <span className="hidden items-center border-l border-line px-5 font-mono text-[0.6rem] uppercase tracking-[0.3em] text-dim md:flex">
            <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-acid" />
            Friends &amp; Family Proof
          </span>
          <button
            onClick={onAdminOpen}
            className={clsx(
              "flex items-center gap-2 border-l border-line px-4 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-dim transition-colors hover:bg-panel hover:text-ink md:px-6",
              focusRing,
            )}
            title="Manage Library"
            aria-label="Open admin panel to manage library"
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Vault</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-y-auto lg:grid-rows-1 lg:overflow-hidden lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_460px]">
        {/* Now Playing */}
        <section className="relative flex flex-col justify-center px-4 py-10 md:px-10 lg:overflow-y-auto lg:py-6">
          {isLibraryLoading ? (
            <div
              className="mx-auto w-full max-w-md animate-pulse lg:max-w-lg"
              aria-busy="true"
              aria-label="Loading library"
            >
              <div className="mx-auto aspect-square w-56 border border-line bg-panel sm:w-64 lg:w-72" />
              <div className="mt-8 space-y-3">
                <div className="h-9 w-3/4 bg-panel" />
                <div className="h-4 w-1/3 bg-panel" />
              </div>
              <div className="mt-8 h-14 bg-panel" />
              <p className="mt-6 font-mono text-[0.65rem] uppercase tracking-[0.3em] text-dim">
                Loading vault…
              </p>
            </div>
          ) : currentTrack ? (
            <div
              key={currentTrack.id}
              className="mx-auto w-full max-w-md animate-fade-up lg:max-w-lg"
            >
              <div className="relative mx-auto aspect-square w-60 border border-line bg-panel p-4 sm:w-72 lg:w-80">
                {/* Vinyl record */}
                <div
                  className="relative h-full w-full animate-[spin_4s_linear_infinite] motion-reduce:animate-none"
                  style={{
                    animationPlayState: isPlaying ? "running" : "paused",
                  }}
                >
                  <div className="absolute inset-0 overflow-hidden rounded-full border border-line shadow-[0_0_40px_rgba(0,0,0,0.6)]">
                    <img
                      src={currentTrack.coverArt || DEFAULT_COVER}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = DEFAULT_COVER;
                      }}
                      alt={`Cover art for ${currentTrack.title}`}
                      className={clsx(
                        "h-full w-full object-cover transition-all duration-700",
                        isPlaying ? "grayscale-0" : "grayscale",
                      )}
                    />
                    {/* Grooves */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          "repeating-radial-gradient(circle at center, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.28) 4px, rgba(0,0,0,0.28) 5px)",
                      }}
                      aria-hidden="true"
                    />
                    {/* Light sheen */}
                    <div
                      className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/[0.07] to-transparent"
                      aria-hidden="true"
                    />
                  </div>
                  {/* Center label + spindle */}
                  <div className="absolute left-1/2 top-1/2 flex h-[27%] w-[27%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/40 bg-acid">
                    <span className="absolute top-[18%] font-mono text-[0.5rem] font-medium uppercase tracking-[0.1em] text-black/80">
                      SHR
                    </span>
                    <span
                      className="h-[14%] w-[14%] rounded-full bg-[#0c0c0b]"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <span className="absolute -top-px -right-px bg-acid px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-black">
                  SHR—{pad(currentIndex + 1)}
                </span>
              </div>

              <div className="mt-8">
                <h1 className="font-display text-[clamp(1.8rem,4.5vw,3rem)] uppercase leading-[0.95] tracking-tight">
                  {currentTrack.title}
                </h1>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-dim">
                  {currentTrack.artist}
                </p>
              </div>

              <div className="mt-8">
                <Visualizer
                  isPlaying={isPlaying}
                  waveformData={waveformData}
                  peaks={currentTrack.waveformPeaks ?? derivedWaveformPeaks}
                  duration={duration}
                  currentTime={currentTime}
                  progress={duration > 0 ? currentTime / duration : 0}
                  onSeek={seek}
                />
              </div>

              <div className="mt-8 grid grid-cols-2 gap-px border border-line bg-line">
                <div className="bg-[#0c0c0b] p-4">
                  <div className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-dim">
                    Plays
                  </div>
                  <div className="mt-1 font-display text-2xl">
                    {currentTrack.playCount ?? 0}
                  </div>
                </div>
                <div className="bg-[#0c0c0b] p-4">
                  <div className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-dim">
                    Resonance
                  </div>
                  <div className="mt-1 font-display text-2xl text-acid">
                    {(currentTrack.vibeAverage ?? 0).toFixed(1)}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div
                  className="flex gap-px border border-line bg-line"
                  role="group"
                  aria-label="Rate resonance"
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => submitVibe(level)}
                      disabled={isSubmittingVibe}
                      className={clsx(
                        "flex-1 py-3 font-mono text-xs transition-colors disabled:opacity-50",
                        focusRing,
                        resonance >= level
                          ? "bg-acid text-black"
                          : "bg-[#0c0c0b] text-dim hover:text-ink",
                      )}
                      aria-label={`Set resonance to ${level} out of 5`}
                      aria-pressed={resonance === level}
                    >
                      {pad(level)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-dim">
                  Tap to rate this track
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-sm text-center">
              <p className="font-display text-xl uppercase">
                The vault is silent.
              </p>
              <p className="mt-3 text-sm text-dim">
                Load a private mix for the inner circle.
              </p>
              <button
                onClick={onAdminOpen}
                className={clsx(
                  "mt-6 border border-ink px-6 py-3 font-mono text-xs uppercase tracking-[0.2em] transition-colors hover:bg-ink hover:text-black",
                  focusRing,
                )}
              >
                Open the vault
              </button>
            </div>
          )}
        </section>

        {/* Catalog */}
        <aside className="flex min-h-0 flex-col border-t border-line lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 md:px-5">
            <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-dim">
              Catalog
            </h3>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-dim">
              {isLibraryLoading
                ? "—"
                : `${tracks.length} ${tracks.length === 1 ? "Track" : "Tracks"}`}
            </span>
          </div>
          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
            {isLibraryLoading
              ? Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={`loading-${idx}`}
                    className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-5 animate-pulse"
                  >
                    <span className="w-6 font-mono text-[0.65rem] text-dim/50">
                      {pad(idx + 1)}
                    </span>
                    <div className="h-9 w-9 bg-panel" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-2/3 bg-panel" />
                      <div className="h-2.5 w-1/3 bg-panel" />
                    </div>
                  </div>
                ))
              : tracks.map((t, idx) => {
                  const isCurrent = currentTrack?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTrack(t)}
                      className={clsx(
                        "group flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors md:px-5",
                        focusRing,
                        isCurrent ? "bg-panel" : "hover:bg-panel/60",
                      )}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <span
                        className={clsx(
                          "w-6 shrink-0 font-mono text-[0.65rem]",
                          isCurrent ? "text-acid" : "text-dim",
                        )}
                      >
                        {isCurrent && isPlaying ? (
                          <span
                            className="flex h-3 items-end gap-[2px]"
                            aria-label="Now playing"
                          >
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="w-[3px] animate-music-bar bg-acid"
                                style={{ animationDelay: `-${i * 0.2}s` }}
                              />
                            ))}
                          </span>
                        ) : (
                          pad(idx + 1)
                        )}
                      </span>
                      <img
                        src={t.coverArt || DEFAULT_COVER}
                        alt=""
                        className="h-9 w-9 shrink-0 border border-line object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_COVER;
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={clsx(
                            "block truncate text-sm font-medium",
                            isCurrent
                              ? "text-ink"
                              : "text-dim group-hover:text-ink",
                          )}
                        >
                          {t.title}
                        </span>
                        <span className="block truncate font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim/70">
                          {t.artist}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-[0.65rem] text-dim/70">
                        {t.duration ? formatTime(t.duration) : "—"}
                        <span className="mt-0.5 block">
                          {t.playCount ?? 0} plays
                        </span>
                      </span>
                    </button>
                  );
                })}
            {!isLibraryLoading && tracks.length === 0 && (
              <p
                className="p-5 font-mono text-xs uppercase tracking-[0.2em] text-dim"
                role="status"
              >
                Nothing in the catalog yet
              </p>
            )}
          </div>
        </aside>
      </main>

      {/* Transport */}
      <footer className="z-20 border-t border-line bg-[#0c0c0b]">
        {/* Seek */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-6">
          <span className="w-10 font-mono text-[0.65rem] text-dim">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0.1}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="h-3 flex-1"
            style={{
              ["--range-bg" as string]: `linear-gradient(to right, #c3f53c ${
                (currentTime / (duration || 1)) * 100
              }%, #2a2a28 ${(currentTime / (duration || 1)) * 100}%)`,
            }}
            aria-label="Seek position"
          />
          <span className="w-10 text-right font-mono text-[0.65rem] text-dim">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={onShuffleToggle}
              className={clsx(
                "p-2.5 transition-colors",
                focusRing,
                isShuffle ? "text-acid" : "text-dim hover:text-ink",
              )}
              aria-pressed={isShuffle}
              aria-label={
                isShuffle ? "Disable shuffle mode" : "Enable shuffle mode"
              }
              title={isShuffle ? "Shuffle enabled" : "Enable shuffle"}
            >
              <Shuffle size={16} />
            </button>
            <button
              onClick={onRepeatToggle}
              className={clsx(
                "p-2.5 transition-colors",
                focusRing,
                repeatMode !== "off" ? "text-acid" : "text-dim hover:text-ink",
              )}
              aria-pressed={repeatMode !== "off"}
              aria-label={
                repeatMode === "off"
                  ? "Enable repeat"
                  : repeatMode === "all"
                    ? "Repeat all tracks"
                    : "Repeat current track"
              }
              title={
                repeatMode === "off"
                  ? "Enable repeat"
                  : repeatMode === "all"
                    ? "Repeat all"
                    : "Repeat current track"
              }
            >
              {repeatMode === "one" ? (
                <Repeat1 size={16} />
              ) : (
                <Repeat size={16} />
              )}
            </button>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <button
              onClick={handlePrevClick}
              className={clsx(
                "p-2 text-dim transition-colors hover:text-ink",
                focusRing,
              )}
              aria-label="Previous track"
            >
              <SkipBack size={20} />
            </button>
            <button
              onClick={togglePlay}
              className={clsx(
                "flex h-12 w-12 items-center justify-center bg-acid text-black transition-transform hover:scale-105 md:h-14 md:w-14",
                focusRing,
              )}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <Play size={22} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button
              onClick={onNext}
              className={clsx(
                "p-2 text-dim transition-colors hover:text-ink",
                focusRing,
              )}
              aria-label="Next track"
            >
              <SkipForward size={20} />
            </button>
          </div>

          <div className="flex items-center gap-1 md:gap-3">
            <button
              onClick={handleShare}
              className={clsx(
                "p-2.5 text-dim transition-colors hover:text-ink",
                focusRing,
              )}
              title="Share invite link"
              aria-label="Share invite link"
            >
              <Share2 size={16} />
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              <button
                onClick={() => handleVolumeChange(volume === 0 ? 1 : 0)}
                className={clsx("p-1 text-dim hover:text-ink", focusRing)}
                aria-label={volume === 0 ? "Unmute" : "Mute"}
              >
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="h-3 w-20"
                style={{
                  ["--range-bg" as string]: `linear-gradient(to right, #e8e6e1 ${volume * 100}%, #2a2a28 ${
                    volume * 100
                  }%)`,
                }}
                aria-label="Volume"
              />
            </div>
          </div>
        </div>

        {/* Status strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-line px-4 py-2">
          <span
            className={clsx(
              "font-mono text-[0.6rem] uppercase tracking-[0.25em]",
              isShuffle ? "text-acid" : "text-dim/70",
            )}
          >
            Shuffle {isShuffle ? "On" : "Off"}
          </span>
          <span
            className={clsx(
              "font-mono text-[0.6rem] uppercase tracking-[0.25em]",
              repeatMode !== "off" ? "text-acid" : "text-dim/70",
            )}
          >
            Repeat{" "}
            {repeatMode === "one" ? "1" : repeatMode === "off" ? "Off" : "All"}
          </span>
          <a
            href="https://merch.slughouse.com"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-dim/70 transition-colors hover:text-acid"
          >
            Merch ↗
          </a>
          <a
            href="https://slughouse.com"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-dim/70 transition-colors hover:text-acid"
          >
            slughouse.com ↗
          </a>
        </div>

        {toast && (
          <div
            role="status"
            className="absolute bottom-32 left-1/2 -translate-x-1/2 border border-acid bg-[#0c0c0b] px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-acid"
          >
            {toast}
          </div>
        )}
      </footer>
    </div>
  );
};

export default Player;

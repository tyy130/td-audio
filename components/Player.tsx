import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { clsx } from "clsx";
import Visualizer from "./Visualizer";
import Catalog from "./Catalog";
import { useAudio } from "../hooks/useAudio";
import { DEFAULT_COVER } from "../constants";
import { recordPlayback, sendVibe, TrackMetrics } from "../services/storage";
import { focusRing, formatTime, onCoverError, pad } from "./ui";

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

const SHARE_URL = "https://listen.slughouse.com";
const SEEK_STEP = 5;

const repeatLabel: Record<RepeatMode, string> = {
  off: "Repeat off",
  all: "Repeat all",
  one: "Repeat current track",
};

/** Elements that already use the key themselves. */
const ownsKey = (target: EventTarget | null, key: string) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    // Range sliders handle arrows natively; text fields handle everything.
    return (el as HTMLInputElement).type !== "range" || key.startsWith("arrow");
  }
  // Buttons and links activate on Space/Enter.
  if (tag === "BUTTON") return key === " " || key === "enter";
  if (tag === "A") return key === "enter";
  return false;
};

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
    pause,
    duration,
    currentTime,
    seek,
    changeVolume,
    readLevels,
  } = useAudio(
    currentTrack?.src || "",
    onAutoAdvance,
    repeatMode === "one",
    volume,
    currentTrack?.waveformPeaks,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [resonance, setResonance] = useState(3);
  const [isSubmittingVibe, setIsSubmittingVibe] = useState(false);
  // Which track's play has been counted. A ref, set before the request goes
  // out, so a re-render mid-request can't count the same play twice.
  const recordedForRef = useRef<string | null>(null);
  const [nowPlayingVisible, setNowPlayingVisible] = useState(true);
  const queuedTrackToPlayRef = useRef<string | null>(null);
  const lastVolumeRef = useRef(volume > 0 ? volume : 1);
  const mainRef = useRef<HTMLElement>(null);
  const nowPlayingRef = useRef<HTMLElement>(null);

  const currentIndex = currentTrack
    ? tracks.findIndex((t) => t.id === currentTrack.id)
    : -1;

  // Media Session: metadata + hardware/lock-screen controls, so mobile
  // systems treat this as a media player and keep playback alive when
  // the browser is backgrounded or the screen locks.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || "SlugHouse Records",
      artwork: currentTrack.coverArt
        ? [{ src: currentTrack.coverArt, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });
  }, [currentTrack]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => play());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => onPrev());
    navigator.mediaSession.setActionHandler("nexttrack", () => onNext());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
  }, [play, pause, onPrev, onNext, seek]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (Number.isFinite(duration) && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(currentTime, duration),
        });
      } catch {
        /* position state is best-effort */
      }
    }
  }, [duration, currentTime]);

  // On phones the now-playing block scrolls away; show a mini "now playing"
  // strip in the transport bar once it does.
  useEffect(() => {
    const target = nowPlayingRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setNowPlayingVisible(entry.isIntersecting),
      { root: mainRef.current, threshold: 0.15 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const handleVolumeChange = useCallback(
    (value: number) => {
      if (value > 0) lastVolumeRef.current = value;
      changeVolume(value);
      onVolumeChange(value);
    },
    [changeVolume, onVolumeChange],
  );

  const toggleMute = useCallback(() => {
    handleVolumeChange(volume === 0 ? lastVolumeRef.current : 0);
  }, [handleVolumeChange, volume]);

  const handlePrevClick = useCallback(() => {
    if (currentTime > 3) {
      seek(0);
    } else {
      onPrev();
    }
  }, [currentTime, seek, onPrev]);

  const handleSelectTrack = useCallback(
    (track: Track) => {
      if (currentTrack?.id === track.id) {
        togglePlay();
        return;
      }
      queuedTrackToPlayRef.current = track.id;
      onSelect(track);
    },
    [currentTrack?.id, togglePlay, onSelect],
  );

  // Keyboard: Space/K play-pause, ←/→ seek, Shift+←/→ prev/next, M mute.
  // Read live values through a ref so the listener is attached once.
  const keyStateRef = useRef({ togglePlay, onNext, onPrev, seek, duration, currentTime, toggleMute });
  keyStateRef.current = { togglePlay, onNext, onPrev, seek, duration, currentTime, toggleMute };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.metaKey || e.ctrlKey || e.altKey || ownsKey(e.target, key)) return;
      const k = keyStateRef.current;
      if (key === " " || key === "k") {
        e.preventDefault();
        k.togglePlay();
      } else if (key === "arrowright") {
        e.preventDefault();
        if (e.shiftKey) k.onNext();
        else k.seek(Math.min(k.duration || 0, k.currentTime + SEEK_STEP));
      } else if (key === "arrowleft") {
        e.preventDefault();
        if (e.shiftKey) k.onPrev();
        else k.seek(Math.max(0, k.currentTime - SEEK_STEP));
      } else if (key === "m") {
        k.toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!currentTrack || queuedTrackToPlayRef.current !== currentTrack.id) {
      return;
    }
    queuedTrackToPlayRef.current = null;
    play();
  }, [currentTrack, play]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setToast("Invite link copied");
    } catch {
      setToast("Unable to copy link");
    }
  };

  const handleShare = async () => {
    const data = {
      title: currentTrack
        ? `${currentTrack.title} · ${currentTrack.artist}`
        : "Slughouse Records",
      text: "You're on the list. This Slughouse drop is private.",
      url: SHARE_URL,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        // User closed the share sheet: nothing to do.
        if ((err as DOMException)?.name === "AbortError") return;
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
  }, [currentTrack?.id, currentTrack?.vibeAverage]);

  const currentTrackId = currentTrack?.id;
  // A new track (or coming back to an earlier one) is a new play to count.
  // Runs before the effect below in the same commit.
  useEffect(() => {
    recordedForRef.current = null;
  }, [currentTrackId]);

  useEffect(() => {
    if (!currentTrackId || !isPlaying) return;
    if (recordedForRef.current === currentTrackId) return;
    recordedForRef.current = currentTrackId;
    recordPlayback(currentTrackId)
      .then((metrics) => onTrackMetrics(currentTrackId, metrics))
      .catch((err) => {
        console.error("Failed to record play", err);
        // Let the next play attempt count it instead.
        if (recordedForRef.current === currentTrackId) {
          recordedForRef.current = null;
        }
      });
  }, [currentTrackId, isPlaying, onTrackMetrics]);

  const submitVibe = async (value: number) => {
    if (!currentTrack) return;
    setIsSubmittingVibe(true);
    try {
      const metrics = await sendVibe(currentTrack.id, value);
      onTrackMetrics(currentTrack.id, metrics);
      setResonance(value);
      setToast("Rating saved");
    } catch (err) {
      console.error("Failed to submit resonance", err);
      setToast("Couldn't save rating, try again");
    } finally {
      setIsSubmittingVibe(false);
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const progressPct = Math.min(100, progress * 100);
  const iconButton = clsx(
    "flex h-10 w-10 items-center justify-center transition-colors",
    focusRing,
  );

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-surface text-ink">
      {/* Header */}
      <header className="flex shrink-0 items-stretch justify-between border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5 md:px-6 md:py-3">
          <span className="truncate font-mono text-[0.65rem] uppercase tracking-[0.35em] text-dim">
            Listening Room — Private
          </span>
          <span className="truncate font-display text-base uppercase leading-none tracking-tight sm:text-lg md:text-xl">
            Slughouse Records
          </span>
        </div>
        <div className="flex items-stretch">
          <span className="hidden items-center border-l border-line px-5 font-mono text-[0.65rem] uppercase tracking-[0.3em] text-dim lg:flex">
            <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-acid motion-reduce:animate-none" />
            Friends &amp; Family Proof
          </span>
          <button
            type="button"
            onClick={onAdminOpen}
            className={clsx(
              "flex items-center gap-2 border-l border-line px-4 font-mono text-[0.7rem] uppercase tracking-[0.25em] text-dim transition-colors hover:bg-panel hover:text-ink md:px-6",
              focusRing,
            )}
            title="Manage library"
            aria-label="Open the vault to manage the library"
          >
            <Settings size={16} />
            <span className="hidden sm:inline">Vault</span>
          </button>
        </div>
      </header>

      {/* Main: one scrolling column on phones, two panes from tablet up */}
      <main
        ref={mainRef}
        className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_340px] md:grid-rows-1 md:overflow-hidden lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_460px]"
      >
        {/* Now Playing */}
        <section
          ref={nowPlayingRef}
          aria-label="Now playing"
          className="relative flex flex-col px-4 py-6 sm:py-10 md:overflow-y-auto md:px-8 md:py-6 lg:px-10 [@media(max-height:500px)]:py-4"
        >
          {isLibraryLoading ? (
            <div
              className="m-auto w-full max-w-md animate-pulse lg:max-w-lg"
              aria-busy="true"
              aria-label="Loading library"
            >
              <div className="mx-auto aspect-square w-44 border border-line bg-panel sm:w-60 md:w-[min(15rem,30vh)] lg:w-[min(18rem,28vh)]" />
              <div className="mt-6 space-y-3">
                <div className="h-8 w-3/4 bg-panel" />
                <div className="h-4 w-1/3 bg-panel" />
              </div>
              <div className="mt-6 h-10 bg-panel sm:h-14" />
            </div>
          ) : currentTrack ? (
            <div
              key={currentTrack.id}
              className="m-auto w-full max-w-md animate-fade-up motion-reduce:animate-none lg:max-w-lg"
            >
              <div className="relative mx-auto aspect-square w-44 border border-line bg-panel p-3 sm:w-60 sm:p-4 md:w-[min(15rem,30vh)] lg:w-[min(18rem,23vh)] xl:w-[min(20rem,26vh)] [@media(max-height:500px)]:w-32">
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
                      onError={onCoverError}
                      alt={`Cover art for ${currentTrack.title}`}
                      decoding="async"
                      className={clsx(
                        "h-full w-full object-cover transition-[filter] duration-700",
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
                      className="h-[14%] w-[14%] rounded-full bg-surface"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <span className="absolute -right-px -top-px bg-acid px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-black">
                  SHR—{pad(currentIndex + 1)}
                </span>
              </div>

              <div className="mt-6 text-center sm:mt-8 md:mt-5 lg:mt-6 [@media(max-height:800px)]:md:mt-4">
                <h1 className="break-words font-display text-[clamp(1.6rem,6vw,3rem)] uppercase leading-[0.95] tracking-tight md:text-[clamp(1.5rem,2.8vw,3rem)]">
                  {currentTrack.title}
                </h1>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-dim">
                  {currentTrack.artist}
                  {currentTrack.album ? (
                    <span className="text-dim/70"> · {currentTrack.album}</span>
                  ) : null}
                </p>
              </div>

              <div className="mt-6 sm:mt-8 md:mt-5 lg:mt-6 [@media(max-height:800px)]:md:mt-4">
                <Visualizer
                  isPlaying={isPlaying}
                  readLevels={readLevels}
                />
              </div>

              {/* Stats + rating */}
              <div className="mt-6 border border-line sm:mt-8 md:mt-5 lg:mt-6 [@media(max-height:800px)]:md:mt-4">
                <div className="grid grid-cols-2 gap-px bg-line">
                  <div className="bg-surface px-4 py-3 [@media(max-height:800px)]:py-2">
                    <div className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-dim">
                      Plays
                    </div>
                    <div className="mt-1 font-display text-xl sm:text-2xl">
                      {currentTrack.playCount ?? 0}
                    </div>
                  </div>
                  <div className="bg-surface px-4 py-3 [@media(max-height:800px)]:py-2">
                    <div className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-dim">
                      Resonance
                    </div>
                    <div className="mt-1 font-display text-xl text-acid sm:text-2xl">
                      {(currentTrack.vibeAverage ?? 0).toFixed(1)}
                      <span className="ml-1 font-mono text-xs text-dim">
                        / 5
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className="flex gap-px border-t border-line bg-line"
                  role="group"
                  aria-label="Rate this track from 1 to 5"
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={resonance === level}
                      onClick={() => submitVibe(level)}
                      disabled={isSubmittingVibe}
                      className={clsx(
                        "min-h-[44px] flex-1 font-mono text-xs transition-colors disabled:opacity-50",
                        focusRing,
                        resonance >= level
                          ? "bg-acid text-black"
                          : "bg-surface text-dim hover:text-ink",
                      )}
                      aria-label={`${level} out of 5`}
                    >
                      {pad(level)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-center font-mono text-[0.65rem] uppercase tracking-[0.25em] text-dim [@media(max-height:820px)]:hidden">
                Tap a number to rate this track
              </p>
            </div>
          ) : (
            <div className="m-auto max-w-sm text-center">
              <p className="font-display text-xl uppercase">
                The vault is silent.
              </p>
              <p className="mt-3 text-sm text-dim">
                Load a private mix for the inner circle.
              </p>
              <button
                type="button"
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

        <Catalog
          tracks={tracks}
          currentTrackId={currentTrack?.id ?? null}
          isPlaying={isPlaying}
          isLoading={isLibraryLoading}
          onSelect={handleSelectTrack}
        />

        {/* Site links live at the end of the scroll on phones */}
        <nav
          aria-label="Slughouse links"
          className="flex justify-center gap-6 border-t border-line px-4 py-4 md:hidden"
        >
          <a
            href="https://slughouse.com/merch"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-dim hover:text-acid"
          >
            Merch ↗
          </a>
          <a
            href="https://slughouse.com"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-dim hover:text-acid"
          >
            slughouse.com ↗
          </a>
        </nav>
      </main>

      {/* Transport */}
      <footer className="z-20 shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        {/* Mini now-playing, phones only, once the big one scrolls away */}
        {currentTrack && !nowPlayingVisible && (
          <button
            type="button"
            onClick={() =>
              mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })
            }
            className={clsx(
              "flex w-full items-center gap-3 border-b border-line px-4 py-2 text-left md:hidden",
              focusRing,
            )}
            aria-label={`Now playing: ${currentTrack.title} by ${currentTrack.artist}. Show player.`}
          >
            <img
              src={currentTrack.coverArt || DEFAULT_COVER}
              onError={onCoverError}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 border border-line object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {currentTrack.title}
              </span>
              <span className="block truncate font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim">
                {currentTrack.artist}
              </span>
            </span>
          </button>
        )}

        {/* Same columns as the panes above: playback controls sit under the
            track info, volume and links under the catalog. */}
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="mx-auto w-full max-w-2xl">
        {/* Seek */}
        <div className="flex w-full items-center gap-3 px-4 pt-3 md:px-6">
          <span className="w-10 font-mono text-[0.7rem] tabular-nums text-dim">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0.1}
            step="any"
            value={Math.min(currentTime, duration || 0.1)}
            onChange={(e) => seek(Number(e.target.value))}
            className="h-6 min-w-0 flex-1"
            style={{
              ["--range-bg" as string]: `linear-gradient(to right, #c3f53c ${progressPct}%, #2a2a28 ${progressPct}%)`,
            }}
            aria-label="Seek"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            disabled={!currentTrack}
          />
          <span className="w-10 text-right font-mono text-[0.7rem] tabular-nums text-dim">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls */}
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center px-2 pb-2 pt-1 sm:px-4 md:px-6">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onShuffleToggle}
              className={clsx(
                iconButton,
                isShuffle ? "text-acid" : "text-dim hover:text-ink",
              )}
              aria-pressed={isShuffle}
              aria-label="Shuffle"
              title={isShuffle ? "Shuffle on" : "Shuffle off"}
            >
              <Shuffle size={18} />
            </button>
            <button
              type="button"
              onClick={onRepeatToggle}
              className={clsx(
                iconButton,
                repeatMode !== "off" ? "text-acid" : "text-dim hover:text-ink",
              )}
              aria-label={`${repeatLabel[repeatMode]}. Change repeat mode`}
              title={repeatLabel[repeatMode]}
            >
              {repeatMode === "one" ? (
                <Repeat1 size={18} />
              ) : (
                <Repeat size={18} />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
            <button
              type="button"
              onClick={handlePrevClick}
              className={clsx(iconButton, "h-11 w-11 text-dim hover:text-ink")}
              aria-label="Previous track"
              title="Previous (Shift + ←)"
            >
              <SkipBack size={22} />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              disabled={!currentTrack}
              className={clsx(
                "flex h-14 w-14 items-center justify-center bg-acid text-black transition-transform hover:scale-105 active:scale-95 disabled:opacity-40",
                focusRing,
              )}
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onNext}
              className={clsx(iconButton, "h-11 w-11 text-dim hover:text-ink")}
              aria-label="Next track"
              title="Next (Shift + →)"
            >
              <SkipForward size={22} />
            </button>
          </div>

          <div className="flex items-center justify-end gap-1 md:gap-2">
            <button
              type="button"
              onClick={handleShare}
              className={clsx(iconButton, "text-dim hover:text-ink")}
              title="Share invite link"
              aria-label="Share invite link"
            >
              <Share2 size={18} />
            </button>
            {/* Phones use their hardware volume buttons */}
            <div className="hidden items-center gap-1 sm:flex md:hidden">
              <button
                type="button"
                onClick={toggleMute}
                className={clsx(iconButton, "text-dim hover:text-ink")}
                aria-label={volume === 0 ? "Unmute" : "Mute"}
                title={volume === 0 ? "Unmute (M)" : "Mute (M)"}
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="h-6 w-20 lg:w-24"
                style={{
                  ["--range-bg" as string]: `linear-gradient(to right, #e8e6e1 ${volume * 100}%, #2a2a28 ${volume * 100}%)`,
                }}
                aria-label="Volume"
              />
            </div>
          </div>
        </div>

          </div>
          <div className="hidden flex-col items-center justify-center gap-2 border-l border-line px-5 md:flex">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMute}
                className={clsx(iconButton, "text-dim hover:text-ink")}
                aria-label={volume === 0 ? "Unmute" : "Mute"}
                title={volume === 0 ? "Unmute (M)" : "Mute (M)"}
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="h-6 w-28 lg:w-36"
                style={{
                  ["--range-bg" as string]: `linear-gradient(to right, #e8e6e1 ${volume * 100}%, #2a2a28 ${volume * 100}%)`,
                }}
                aria-label="Volume"
              />
            </div>
            <div className="flex items-center gap-5 [@media(max-height:500px)]:hidden">
              <a
                href="https://slughouse.com/merch"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-dim transition-colors hover:text-acid"
              >
                Merch ↗
              </a>
              <a
                href="https://slughouse.com"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-dim transition-colors hover:text-acid"
              >
                slughouse.com ↗
              </a>
            </div>
          </div>
        </div>
      </footer>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-40 z-50 flex justify-center px-4"
      >
        {toast && (
          <div className="border border-acid bg-surface px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-acid">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};

export default Player;

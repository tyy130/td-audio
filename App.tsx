import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Track, AppView, RepeatMode, PersistentSettings } from "./types";
import { getAllTracks, TrackMetrics } from "./services/storage";
import { orderTracksForPlayback } from "./services/albums";
import Player from "./components/Player";

// Lazy load Admin component - only loads when user clicks settings
const Admin = lazy(() => import("./components/Admin"));
const TRACK_CACHE_KEY = "slughouse-listen-track-cache";

function App() {
  const [view, setView] = useState<AppView>(AppView.PLAYER);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [volume, setVolume] = useState(1);

  // Playback runs album-first: the featured album (most recently added)
  // leads the queue, so the newest release is what plays first.
  const playQueue = useMemo(() => orderTracksForPlayback(tracks), [tracks]);

  // Initial Load
  useEffect(() => {
    let hasCachedTracks = false;

    try {
      const cached = localStorage.getItem(TRACK_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const cachedTracks = parsed as Track[];
          hasCachedTracks = cachedTracks.length > 0;
          setTracks(cachedTracks);
          if (cachedTracks.length > 0) {
            setCurrentTrack(orderTracksForPlayback(cachedTracks)[0]);
          }
          setIsLibraryLoading(false);
        }
      }
    } catch (error) {
      console.warn("Unable to restore cached tracks", error);
    }

    const loadLibrary = async () => {
      try {
        const loadedTracks = await getAllTracks();
        setTracks(loadedTracks);
        if (loadedTracks.length > 0) {
          setCurrentTrack(orderTracksForPlayback(loadedTracks)[0]);
        }
        localStorage.setItem(TRACK_CACHE_KEY, JSON.stringify(loadedTracks));
      } catch (e) {
        console.error("Failed to load library", e);
      } finally {
        if (!hasCachedTracks) {
          setIsLibraryLoading(false);
        }
      }
    };
    loadLibrary();
  }, []);

  useEffect(() => {
    setCurrentTrack((prev) => {
      if (playQueue.length === 0) {
        return null;
      }

      if (!prev) {
        return playQueue[0];
      }

      const matchingTrack = playQueue.find((track) => track.id === prev.id);
      return matchingTrack || playQueue[0];
    });
  }, [playQueue]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") {
      setView(AppView.ADMIN);
      params.delete("admin");
      const next = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${next ? `?${next}` : ""}`,
      );
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("slughouse-listen-settings");
      if (!raw) return;
      const stored: PersistentSettings = JSON.parse(raw);
      if (typeof stored.volume === "number")
        setVolume(Math.min(Math.max(stored.volume, 0), 1));
      if (typeof stored.shuffle === "boolean") setIsShuffle(stored.shuffle);
      if (
        stored.repeatMode === "off" ||
        stored.repeatMode === "all" ||
        stored.repeatMode === "one"
      ) {
        setRepeatMode(stored.repeatMode);
      }
    } catch (err) {
      console.warn("Unable to load settings", err);
    }
  }, []);

  useEffect(() => {
    const payload: PersistentSettings = {
      volume,
      shuffle: isShuffle,
      repeatMode,
    };
    localStorage.setItem("slughouse-listen-settings", JSON.stringify(payload));
  }, [volume, isShuffle, repeatMode]);

  useEffect(() => {
    const preloadTargets = new Set<string>();

    if (currentTrack?.src) {
      preloadTargets.add(currentTrack.src);
    } else if (playQueue[0]?.src) {
      preloadTargets.add(playQueue[0].src);
    }

    if (currentTrack && playQueue.length > 1) {
      const currentIndex = playQueue.findIndex(
        (track) => track.id === currentTrack.id,
      );
      if (currentIndex !== -1) {
        const nextTrack = playQueue[(currentIndex + 1) % playQueue.length];
        if (nextTrack?.src && nextTrack.src !== currentTrack.src) {
          preloadTargets.add(nextTrack.src);
        }
      }
    }

    const preloaders = Array.from(preloadTargets).map((url) => {
      const audio = new Audio();
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audio.src = url;
      audio.load();
      return audio;
    });

    return () => {
      preloaders.forEach((audio) => {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      });
    };
  }, [currentTrack, playQueue]);

  // Playback logic wrappers
  const pickRandomTrack = () => {
    if (playQueue.length === 0) return null;
    if (!currentTrack) return playQueue[0];
    if (playQueue.length === 1) return currentTrack;
    const pool = playQueue.filter((t) => t.id !== currentTrack.id);
    const randomIdx = Math.floor(Math.random() * pool.length);
    return pool[randomIdx] || null;
  };

  const handleNext = () => {
    if (!currentTrack || playQueue.length === 0) return;
    if (isShuffle && playQueue.length > 1) {
      const randomTrack = pickRandomTrack();
      if (randomTrack) setCurrentTrack(randomTrack);
      return;
    }
    const idx = playQueue.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1) {
      setCurrentTrack(playQueue[0]);
      return;
    }
    const nextIdx = (idx + 1) % playQueue.length;
    setCurrentTrack(playQueue[nextIdx]);
  };

  const handlePrev = () => {
    if (!currentTrack || playQueue.length === 0) return;
    const idx = playQueue.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1) {
      setCurrentTrack(playQueue[0]);
      return;
    }
    const prevIdx = idx === 0 ? playQueue.length - 1 : idx - 1;
    setCurrentTrack(playQueue[prevIdx]);
  };

  const handleAutoAdvance = () => {
    if (!currentTrack || playQueue.length === 0) return;
    if (repeatMode === "one") {
      return;
    }
    if (isShuffle && playQueue.length > 1) {
      const randomTrack = pickRandomTrack();
      if (randomTrack) setCurrentTrack(randomTrack);
      return;
    }
    const idx = playQueue.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1) {
      setCurrentTrack(playQueue[0]);
      return;
    }
    const isLastTrack = idx === playQueue.length - 1;
    if (isLastTrack && repeatMode === "off") {
      return;
    }
    const nextIdx = isLastTrack ? 0 : idx + 1;
    setCurrentTrack(playQueue[nextIdx]);
  };

  const toggleShuffle = () => setIsShuffle((prev) => !prev);

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  };

  const handleTrackMetricsUpdate = (id: string, metrics: TrackMetrics) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === id
          ? {
              ...track,
              playCount: metrics.playCount,
              vibeTotal: metrics.vibeTotal,
              vibeCount: metrics.vibeCount,
              vibeAverage: metrics.vibeAverage,
              lastPlayedAt: metrics.lastPlayedAt,
            }
          : track,
      ),
    );

    setCurrentTrack((prev) =>
      prev && prev.id === id
        ? {
            ...prev,
            playCount: metrics.playCount,
            vibeTotal: metrics.vibeTotal,
            vibeCount: metrics.vibeCount,
            vibeAverage: metrics.vibeAverage,
            lastPlayedAt: metrics.lastPlayedAt,
          }
        : prev,
    );
  };

  const handleTrackReplace = (next: Track) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === next.id ? next : track)),
    );
    setCurrentTrack((prev) => (prev && prev.id === next.id ? next : prev));
  };

  return (
    <div className="relative min-h-screen bg-[#0c0c0b] text-ink overflow-hidden">
      <div className="relative z-10 antialiased">
        {view === AppView.PLAYER ? (
          <>
            <Player
              currentTrack={currentTrack}
              tracks={playQueue}
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
              isLibraryLoading={isLibraryLoading}
              onTrackMetrics={handleTrackMetricsUpdate}
            />
          </>
        ) : (
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-10 w-10 animate-spin border-2 border-line border-t-acid"></div>
                  <p className="font-mono text-xs uppercase tracking-[0.25em] text-dim">
                    Loading vault…
                  </p>
                </div>
              </div>
            }
          >
            <Admin
              tracks={tracks}
              setTracks={setTracks}
              onTrackUpdated={handleTrackReplace}
              onClose={() => setView(AppView.PLAYER)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default App;

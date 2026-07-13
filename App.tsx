import React, { useState, useEffect, lazy, Suspense } from "react";
import { Track, AppView, RepeatMode, PersistentSettings } from "./types";
import { getAllTracks, TrackMetrics } from "./services/storage";
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
            setCurrentTrack(cachedTracks[0]);
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
          setCurrentTrack(loadedTracks[0]);
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
      if (tracks.length === 0) {
        return null;
      }

      if (!prev) {
        return tracks[0];
      }

      const matchingTrack = tracks.find((track) => track.id === prev.id);
      return matchingTrack || tracks[0];
    });
  }, [tracks]);

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
    } else if (tracks[0]?.src) {
      preloadTargets.add(tracks[0].src);
    }

    if (currentTrack && tracks.length > 1) {
      const currentIndex = tracks.findIndex(
        (track) => track.id === currentTrack.id,
      );
      if (currentIndex !== -1) {
        const nextTrack = tracks[(currentIndex + 1) % tracks.length];
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
  }, [currentTrack, tracks]);

  // Playback logic wrappers
  const pickRandomTrack = () => {
    if (tracks.length === 0) return null;
    if (!currentTrack) return tracks[0];
    if (tracks.length === 1) return currentTrack;
    const pool = tracks.filter((t) => t.id !== currentTrack.id);
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
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1) {
      setCurrentTrack(tracks[0]);
      return;
    }
    const nextIdx = (idx + 1) % tracks.length;
    setCurrentTrack(tracks[nextIdx]);
  };

  const handlePrev = () => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1) {
      setCurrentTrack(tracks[0]);
      return;
    }
    const prevIdx = idx === 0 ? tracks.length - 1 : idx - 1;
    setCurrentTrack(tracks[prevIdx]);
  };

  const handleAutoAdvance = () => {
    if (!currentTrack || tracks.length === 0) return;
    if (repeatMode === "one") {
      return;
    }
    if (isShuffle && tracks.length > 1) {
      const randomTrack = pickRandomTrack();
      if (randomTrack) setCurrentTrack(randomTrack);
      return;
    }
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1) {
      setCurrentTrack(tracks[0]);
      return;
    }
    const isLastTrack = idx === tracks.length - 1;
    if (isLastTrack && repeatMode === "off") {
      return;
    }
    const nextIdx = isLastTrack ? 0 : idx + 1;
    setCurrentTrack(tracks[nextIdx]);
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

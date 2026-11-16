import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { Track, AppView, RepeatMode, PersistentSettings } from "./types";
import { getAllTracks, TrackMetrics } from "./services/storage";
import { orderTracksForPlayback } from "./services/albums";
import Player from "./components/Player";

// Lazy load Admin component - only loads when user clicks settings
const Admin = lazy(() => import("./components/Admin"));
const TRACK_CACHE_KEY = "slughouse-listen-track-cache";
const SETTINGS_KEY = "slughouse-listen-settings";

const loadSettings = (): Partial<PersistentSettings> => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const stored: PersistentSettings = JSON.parse(raw);
    return {
      volume:
        typeof stored.volume === "number"
          ? Math.min(Math.max(stored.volume, 0), 1)
          : undefined,
      shuffle: typeof stored.shuffle === "boolean" ? stored.shuffle : undefined,
      repeatMode: ["off", "all", "one"].includes(stored.repeatMode)
        ? stored.repeatMode
        : undefined,
    };
  } catch {
    return {};
  }
};

function App() {
  const [view, setView] = useState<AppView>(AppView.PLAYER);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  // Read saved settings once, before first render, so defaults never
  // overwrite them.
  const [initialSettings] = useState(loadSettings);
  const [isShuffle, setIsShuffle] = useState(initialSettings.shuffle ?? false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(
    initialSettings.repeatMode ?? "off",
  );
  const [volume, setVolume] = useState(initialSettings.volume ?? 1);

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
        try {
          localStorage.setItem(TRACK_CACHE_KEY, JSON.stringify(loadedTracks));
        } catch {
          /* cache is best-effort */
        }
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
    const payload: PersistentSettings = {
      volume,
      shuffle: isShuffle,
      repeatMode,
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    } catch {
      /* storage unavailable (private mode) — settings just won't persist */
    }
  }, [volume, isShuffle, repeatMode]);

  // Warm the next track so skipping or auto-advance starts fast. The current
  // track is already loading in the player's own audio element, so it is not
  // fetched twice. Keyed on the next track's URL, so play-count updates don't
  // tear the preloader down and start over.
  const nextSrc = useMemo(() => {
    if (!currentTrack || playQueue.length < 2) return "";
    const idx = playQueue.findIndex((track) => track.id === currentTrack.id);
    if (idx === -1) return "";
    const next = playQueue[(idx + 1) % playQueue.length];
    return next?.src && next.src !== currentTrack.src ? next.src : "";
  }, [currentTrack, playQueue]);

  useEffect(() => {
    if (!nextSrc) return;
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.src = nextSrc;
    audio.load();
    return () => {
      audio.removeAttribute("src");
      audio.load();
    };
  }, [nextSrc]);

  // Playback controls. Wrapped in useCallback so the player's memoized
  // pieces and Media Session handlers don't re-bind on every render.
  const step = useCallback(
    (direction: 1 | -1, isAuto = false) => {
      if (!currentTrack || playQueue.length === 0) return;
      if (isAuto && repeatMode === "one") return;
      if (direction === 1 && isShuffle && playQueue.length > 1) {
        const pool = playQueue.filter((t) => t.id !== currentTrack.id);
        setCurrentTrack(pool[Math.floor(Math.random() * pool.length)]);
        return;
      }
      const idx = playQueue.findIndex((t) => t.id === currentTrack.id);
      if (idx === -1) {
        setCurrentTrack(playQueue[0]);
        return;
      }
      const isLastTrack = idx === playQueue.length - 1;
      if (isAuto && isLastTrack && repeatMode === "off") return;
      const nextIdx = (idx + direction + playQueue.length) % playQueue.length;
      setCurrentTrack(playQueue[nextIdx]);
    },
    [currentTrack, playQueue, isShuffle, repeatMode],
  );

  const handleNext = useCallback(() => step(1), [step]);
  const handlePrev = useCallback(() => step(-1), [step]);
  const handleAutoAdvance = useCallback(() => step(1, true), [step]);

  const toggleShuffle = useCallback(() => setIsShuffle((prev) => !prev), []);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) =>
      prev === "off" ? "all" : prev === "all" ? "one" : "off",
    );
  }, []);

  const handleTrackMetricsUpdate = useCallback(
    (id: string, metrics: TrackMetrics) => {
      const apply = (track: Track): Track => ({
        ...track,
        playCount: metrics.playCount,
        vibeTotal: metrics.vibeTotal,
        vibeCount: metrics.vibeCount,
        vibeAverage: metrics.vibeAverage,
        lastPlayedAt: metrics.lastPlayedAt,
      });
      setTracks((prev) => prev.map((t) => (t.id === id ? apply(t) : t)));
      setCurrentTrack((prev) => (prev && prev.id === id ? apply(prev) : prev));
    },
    [],
  );

  const handleTrackReplace = useCallback((next: Track) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === next.id ? next : track)),
    );
    setCurrentTrack((prev) => (prev && prev.id === next.id ? next : prev));
  }, []);

  const openAdmin = useCallback(() => setView(AppView.ADMIN), []);

  return (
    <div className="relative min-h-screen bg-surface text-ink overflow-hidden">
      <div className="relative z-10 antialiased">
        {view === AppView.PLAYER ? (
          <>
            <Player
              currentTrack={currentTrack}
              tracks={playQueue}
              onNext={handleNext}
              onPrev={handlePrev}
              onSelect={setCurrentTrack}
              onAdminOpen={openAdmin}
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

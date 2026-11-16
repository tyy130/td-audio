import React, { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Track } from "../types";
import { DEFAULT_COVER } from "../constants";
import { groupByAlbum } from "../services/albums";
import { focusRing, formatTime, pad, onCoverError } from "./ui";

type GroupBy = "album" | "artist" | "genre";
const GROUP_MODES: GroupBy[] = ["album", "artist", "genre"];
const GROUP_KEY = "slughouse-listen-group-by";

interface TrackGroup {
  label: string;
  sublabel?: string;
  list: Track[];
}

const groupTracks = (tracks: Track[], groupBy: GroupBy): TrackGroup[] => {
  if (groupBy === "album") {
    // Album view is featured-first (newest album leads), not alphabetical.
    return groupByAlbum(tracks).map((group) => ({
      label: group.label,
      sublabel: group.album ? group.artist : undefined,
      list: group.tracks,
    }));
  }
  const groups = new Map<string, Track[]>();
  for (const track of tracks) {
    const label =
      (groupBy === "genre" ? track.genre?.trim() : track.artist?.trim()) ||
      "Uncategorized";
    const list = groups.get(label) ?? [];
    list.push(track);
    groups.set(label, list);
  }
  return [...groups.entries()]
    .map(([label, list]) => ({ label, list }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

const loadGroupBy = (): GroupBy => {
  try {
    const stored = localStorage.getItem(GROUP_KEY) as GroupBy | null;
    return stored && GROUP_MODES.includes(stored) ? stored : "album";
  } catch {
    return "album";
  }
};

interface CatalogProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  onSelect: (track: Track) => void;
}

const NowPlayingBars = () => (
  <span className="flex h-3 items-end gap-[2px]" aria-label="Now playing">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-[3px] animate-music-bar bg-acid motion-reduce:animate-none motion-reduce:h-2/3"
        style={{ animationDelay: `-${i * 0.2}s` }}
      />
    ))}
  </span>
);

/**
 * The track list. Memoized so playback-time updates in the player don't
 * re-render every row; it only changes when the catalog, the current track
 * or the play state change.
 */
const Catalog: React.FC<CatalogProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  isLoading,
  onSelect,
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>(loadGroupBy);
  const grouped = useMemo(
    () => groupTracks(tracks, groupBy),
    [tracks, groupBy],
  );
  const listRef = useRef<HTMLDivElement>(null);

  const changeGroupBy = (mode: GroupBy) => {
    setGroupBy(mode);
    try {
      localStorage.setItem(GROUP_KEY, mode);
    } catch {
      /* best-effort */
    }
  };

  // Keep the current track visible in the side list on wide layouts. On
  // phones the list is part of the page scroll, so leave scrolling alone.
  useEffect(() => {
    if (!currentTrackId || !listRef.current) return;
    if (!window.matchMedia?.("(min-width: 768px)").matches) return;
    const row = listRef.current.querySelector<HTMLElement>(
      `[data-track-id="${CSS.escape(currentTrackId)}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [currentTrackId, groupBy]);

  return (
    <aside
      className="flex min-h-0 flex-col border-t border-line md:border-l md:border-t-0"
      aria-label="Catalog"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 md:px-5">
        <h2 className="mr-auto font-mono text-[0.7rem] uppercase tracking-[0.3em] text-dim">
          Catalog
          <span className="ml-2 text-dim/60">
            {isLoading ? "—" : tracks.length}
          </span>
        </h2>
        <div
          className="flex border border-line"
          role="group"
          aria-label="Group catalog by"
        >
          {GROUP_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => changeGroupBy(mode)}
              aria-pressed={groupBy === mode}
              className={clsx(
                "min-h-[32px] px-3 font-mono text-[0.68rem] uppercase tracking-[0.2em] transition-colors",
                focusRing,
                groupBy === mode
                  ? "bg-acid text-black"
                  : "text-dim hover:text-ink",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={listRef}
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto"
      >
        {isLoading
          ? Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={`loading-${idx}`}
                className="flex animate-pulse items-center gap-3 border-b border-line px-4 py-3 md:px-5"
              >
                <span className="w-6 font-mono text-[0.7rem] text-dim/50">
                  {pad(idx + 1)}
                </span>
                <div className="h-10 w-10 bg-panel" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 bg-panel" />
                  <div className="h-2.5 w-1/3 bg-panel" />
                </div>
              </div>
            ))
          : grouped.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <div className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-b border-line bg-surface px-4 py-2 md:px-5">
                  <span className="truncate font-mono text-[0.7rem] uppercase tracking-[0.25em] text-acid/90">
                    {group.label}
                    {group.sublabel ? (
                      <span className="text-dim/70"> · {group.sublabel}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-[0.68rem] text-dim/60">
                    {group.list.length}
                  </span>
                </div>
                {group.list.map((t, idx) => {
                  const isCurrent = currentTrackId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-track-id={t.id}
                      onClick={() => onSelect(t)}
                      className={clsx(
                        "group flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left transition-colors md:px-5",
                        focusRing,
                        isCurrent ? "bg-panel" : "hover:bg-panel/60",
                      )}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <span
                        className={clsx(
                          "w-6 shrink-0 font-mono text-[0.7rem]",
                          isCurrent ? "text-acid" : "text-dim",
                        )}
                      >
                        {isCurrent && isPlaying ? (
                          <NowPlayingBars />
                        ) : (
                          pad(idx + 1)
                        )}
                      </span>
                      <img
                        src={t.coverArt || DEFAULT_COVER}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 border border-line object-cover"
                        onError={onCoverError}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={clsx(
                            "block truncate text-sm font-medium",
                            isCurrent
                              ? "text-ink"
                              : "text-ink/80 group-hover:text-ink",
                          )}
                        >
                          {t.title}
                        </span>
                        <span className="block truncate font-mono text-[0.68rem] uppercase tracking-[0.15em] text-dim">
                          {t.artist}
                          {t.genre ? ` · ${t.genre}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-[0.68rem] text-dim">
                        {t.duration ? formatTime(t.duration) : "—"}
                        <span className="mt-0.5 hidden text-dim/70 sm:block">
                          {t.playCount ?? 0} plays
                        </span>
                      </span>
                    </button>
                  );
                })}
              </section>
            ))}
        {!isLoading && tracks.length === 0 && (
          <p
            className="p-5 font-mono text-xs uppercase tracking-[0.2em] text-dim"
            role="status"
          >
            Nothing in the catalog yet
          </p>
        )}
      </div>
    </aside>
  );
};

export default React.memo(Catalog);

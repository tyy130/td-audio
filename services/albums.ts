import { Track } from "../types";

export interface AlbumGroup {
  key: string;
  /** Album title when the group's tracks carry one, otherwise the artist name. */
  label: string;
  artist: string;
  album?: string;
  tracks: Track[];
  latestAddedAt: number;
}

/**
 * Group the catalog into albums. A track belongs to the album named by its
 * `album` field; tracks without one form a single group per artist, so
 * untagged catalog entries still present as one collection.
 *
 * Groups are ordered featured-first: the group containing the most
 * recently added track leads, and the rest follow newest to oldest.
 * Track order inside a group is the incoming (catalog) order.
 */
export const groupByAlbum = (tracks: Track[]): AlbumGroup[] => {
  const groups = new Map<string, AlbumGroup>();

  for (const track of tracks) {
    const artist = track.artist?.trim() || "Unknown Artist";
    const album = track.album?.trim() || undefined;
    const key = album
      ? `album:${artist.toLowerCase()}::${album.toLowerCase()}`
      : `artist:${artist.toLowerCase()}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: album || artist,
        artist,
        album,
        tracks: [],
        latestAddedAt: 0,
      };
      groups.set(key, group);
    }
    group.tracks.push(track);
    group.latestAddedAt = Math.max(group.latestAddedAt, track.addedAt || 0);
  }

  return [...groups.values()].sort(
    (a, b) => b.latestAddedAt - a.latestAddedAt,
  );
};

/** Flatten the catalog into playback order: featured album first. */
export const orderTracksForPlayback = (tracks: Track[]): Track[] =>
  groupByAlbum(tracks).flatMap((group) => group.tracks);

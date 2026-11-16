import React, { useEffect, useRef, useState } from "react";
import { Track } from "../types";
import { Reorder, useDragControls } from "framer-motion";
import {
  Trash2,
  GripVertical,
  Music,
  Upload,
  Lock,
  ArrowRight,
  LogOut,
  Pencil,
  ImageIcon,
  Check,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { deleteTrack, reorderTracks, updateTrack } from "../services/storage";
import { saveTrack, uploadTrackCover } from "../services/uploads";
import { extractEmbeddedCoverArt } from "../services/embeddedArt";
import { reencodeCoverArt } from "../services/coverArt";
import { extractWaveformPeaks } from "../services/waveformPeaks";
import { DEFAULT_COVER } from "../constants";
import { focusRing, onCoverError } from "./ui";

const inputStyles =
  "w-full bg-surface border border-line px-4 py-2.5 text-base sm:text-sm text-ink placeholder-dim/50 transition-colors focus:outline-none focus:border-acid";

const labelStyles =
  "block font-mono text-[0.68rem] uppercase tracking-[0.3em] text-dim mb-2";

const primaryButton = clsx(
  "flex w-full items-center justify-center gap-2 bg-acid px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] text-black transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 md:w-auto",
  focusRing,
);

const dropZone = clsx(
  "flex flex-1 cursor-pointer flex-col items-center border border-dashed border-line px-4 py-6 text-center transition-colors hover:border-acid hover:bg-panel focus-within:border-acid",
);

type Toast = { message: string; tone: "ok" | "error" };

const Spinner = () => (
  <span className="h-4 w-4 animate-spin border-2 border-black/30 border-t-black" />
);

const SectionHeader: React.FC<{
  index: string;
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ index, title, icon, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3 sm:px-5">
    <div className="flex items-center gap-3">
      <span className="font-mono text-[0.7rem] text-acid">{index}</span>
      <h2 className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.3em] text-ink">
        {icon}
        {title}
      </h2>
    </div>
    {children}
  </div>
);

/** File picker styled as a drop zone that shows what was picked. */
const FilePicker: React.FC<{
  id: string;
  label: string;
  hint?: string;
  accept: string;
  icon: React.ReactNode;
  inputRef: React.RefObject<HTMLInputElement | null>;
  fileName: string;
  onPick: (file: File | undefined) => void;
}> = ({ id, label, hint, accept, icon, inputRef, fileName, onPick }) => (
  <label htmlFor={id} className={dropZone}>
    {icon}
    <span className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.25em] text-dim">
      {fileName ? "Change file" : label}
    </span>
    {fileName ? (
      <span className="mt-1 max-w-full truncate text-sm text-ink">
        {fileName}
      </span>
    ) : hint ? (
      <span className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim/70">
        {hint}
      </span>
    ) : null}
    <input
      id={id}
      type="file"
      className="sr-only"
      accept={accept}
      ref={inputRef}
      onChange={(e) => onPick(e.target.files?.[0])}
    />
  </label>
);

interface TrackItemProps {
  track: Track;
  onDelete: () => Promise<void>;
  onEdit: () => void;
}

const TrackItem: React.FC<TrackItemProps> = ({ track, onDelete, onEdit }) => {
  const controls = useDragControls();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Drop back out of the confirm state if they don't follow through.
  useEffect(() => {
    if (!confirming || deleting) return;
    const id = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirming, deleting]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 border-b border-line bg-surface py-2 pl-1 pr-2 transition-colors hover:bg-panel/60 sm:gap-3 sm:px-3"
    >
      <div
        className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-dim hover:text-ink active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
        aria-hidden="true"
        title="Drag to reorder"
      >
        <GripVertical size={18} />
      </div>
      <img
        src={track.coverArt || DEFAULT_COVER}
        alt=""
        loading="lazy"
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 border border-line object-cover"
        onError={onCoverError}
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-ink">{track.title}</h3>
        <p className="truncate font-mono text-[0.68rem] uppercase tracking-[0.15em] text-dim">
          {track.artist}
          {track.album ? ` · ${track.album}` : ""}
        </p>
        <p className="mt-0.5 flex items-center gap-4 font-mono text-[0.65rem] text-dim/80">
          <span>{track.playCount ?? 0} plays</span>
          <span className="text-acid/80">
            {(track.vibeAverage ?? 0).toFixed(1)} res
          </span>
        </p>
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className={clsx(
              "flex h-10 items-center gap-1 border border-red-500/60 px-3 font-mono text-[0.68rem] uppercase tracking-[0.15em] text-red-300 hover:bg-red-500/15 disabled:opacity-50",
              focusRing,
            )}
          >
            <Check size={14} /> {deleting ? "…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={clsx(
              "flex h-10 w-10 items-center justify-center text-dim hover:text-ink",
              focusRing,
            )}
            aria-label="Cancel delete"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onEdit}
            className={clsx(
              "flex h-10 w-10 items-center justify-center text-dim hover:text-acid",
              focusRing,
            )}
            aria-label={`Edit ${track.title}`}
            title="Edit details"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={clsx(
              "flex h-10 w-10 items-center justify-center text-dim hover:bg-red-500/10 hover:text-red-400",
              focusRing,
            )}
            aria-label={`Delete ${track.title}`}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </Reorder.Item>
  );
};

interface AdminProps {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  onTrackUpdated: (track: Track) => void;
  onClose: () => void;
}

interface AdminUser {
  email: string;
  name?: string | null;
  picture?: string | null;
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const Admin: React.FC<AdminProps> = ({
  tracks,
  setTracks,
  onTrackUpdated,
  onClose,
}) => {
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authenticated" | "unauthenticated"
  >("checking");
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Add
  const [isUploading, setIsUploading] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackArtist, setNewTrackArtist] = useState("");
  const [newTrackGenre, setNewTrackGenre] = useState("");
  const [newTrackAlbum, setNewTrackAlbum] = useState("");
  const [audioName, setAudioName] = useState("");
  const [coverName, setCoverName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Edit
  const [isUpdating, setIsUpdating] = useState(false);
  const [editTrackId, setEditTrackId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const editSectionRef = useRef<HTMLElement>(null);

  // Album cover
  const [coverTarget, setCoverTarget] = useState("");
  const [albumCoverName, setAlbumCoverName] = useState("");
  const [isApplyingCover, setIsApplyingCover] = useState(false);
  const albumCoverInputRef = useRef<HTMLInputElement>(null);

  // Order
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);

  const notify = (message: string, tone: Toast["tone"] = "ok") =>
    setToast({ message, tone });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextError = params.get("auth_error");
    if (nextError) {
      setAuthError(nextError);
      params.delete("auth_error");
      const next = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${next ? `?${next}` : ""}`,
      );
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          setAuthStatus("unauthenticated");
          setAdminUser(null);
          return;
        }
        const payload = await response.json();
        setAdminUser(payload.user || null);
        setAuthStatus("authenticated");
      } catch (err) {
        console.error(err);
        setAuthStatus("unauthenticated");
        setAdminUser(null);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(
      () => setToast(null),
      toast.tone === "error" ? 5000 : 2400,
    );
    return () => window.clearTimeout(id);
  }, [toast]);

  // Warn before leaving with an unsaved queue order or an upload running.
  useEffect(() => {
    if (!orderDirty && !isUploading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [orderDirty, isUploading]);

  const handleLogin = () => {
    window.location.href = "/api/auth/authorize";
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      setAdminUser(null);
      setAuthStatus("unauthenticated");
    }
  };

  const handleAudioPicked = (file: File | undefined) => {
    setAudioName(file?.name ?? "");
    if (!file) return;
    // Pre-fill the title from the filename when it's empty.
    if (!newTrackTitle) setNewTrackTitle(file.name.replace(/\.[^/.]+$/, ""));
  };

  const handleAddTrack = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      notify("Pick an audio file first", "error");
      return;
    }

    setIsUploading(true);
    try {
      const [embeddedCover, waveform] = await Promise.all([
        extractEmbeddedCoverArt(file),
        extractWaveformPeaks(file),
      ]);

      let coverFile: File | undefined;
      const manualCover = coverInputRef.current?.files?.[0];
      if (manualCover) {
        coverFile = (await reencodeCoverArt(manualCover)) ?? undefined;
      } else if (embeddedCover) {
        try {
          const embeddedBlob = await (await fetch(embeddedCover)).blob();
          coverFile = (await reencodeCoverArt(embeddedBlob)) ?? undefined;
        } catch (err) {
          console.warn("Unable to process embedded cover art", err);
        }
      }

      const savedTrack = await saveTrack(
        {
          id: crypto.randomUUID(),
          title: newTrackTitle.trim() || "Untitled",
          artist: newTrackArtist.trim() || "Unknown Artist",
          genre: newTrackGenre.trim() || undefined,
          album: newTrackAlbum.trim() || undefined,
          duration: waveform.duration || 0,
          addedAt: Date.now(),
          coverArt: undefined,
          waveformPeaks: waveform.peaks,
        },
        file,
        coverFile,
      );
      setTracks((prev) => [...prev, savedTrack]);
      notify(`Added "${savedTrack.title}"`);

      // Keep artist/album/genre for the next track from the same release;
      // clear only what's specific to this file.
      setNewTrackTitle("");
      setAudioName("");
      setCoverName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (coverInputRef.current) coverInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      notify(`Upload failed: ${errorMessage(err, "unknown error")}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const track = tracks.find((t) => t.id === id);
    if (!track) return;
    try {
      await deleteTrack(track);
      setTracks((prev) => prev.filter((t) => t.id !== id));
      if (editTrackId === id) handleSelectEdit("");
      notify(`Deleted "${track.title}"`);
    } catch (err) {
      console.error(err);
      notify(`Couldn't delete: ${errorMessage(err, "server error")}`, "error");
    }
  };

  const handleSelectEdit = (id: string) => {
    setEditTrackId(id);
    const target = tracks.find((t) => t.id === id);
    setEditTitle(target?.title || "");
    setEditArtist(target?.artist || "");
    setEditGenre(target?.genre || "");
    setEditAlbum(target?.album || "");
  };

  const startEdit = (id: string) => {
    handleSelectEdit(id);
    editSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleUpdateTrack = async () => {
    if (!editTrackId) {
      notify("Pick a track to edit", "error");
      return;
    }
    if (!editTitle.trim() || !editArtist.trim()) {
      notify("Title and artist can't be empty", "error");
      return;
    }

    setIsUpdating(true);
    try {
      const updated = await updateTrack(editTrackId, {
        title: editTitle,
        artist: editArtist,
        genre: editGenre,
        album: editAlbum,
      });
      setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      onTrackUpdated(updated);
      notify("Track updated");
    } catch (err) {
      console.error(err);
      notify(`Couldn't update: ${errorMessage(err, "server error")}`, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Album/artist names already in the catalog, for the cover-target picker.
  const coverTargets = Array.from(
    new Set(
      tracks
        .flatMap((t) => [t.album?.trim(), t.artist?.trim()])
        .filter(Boolean),
    ),
  ) as string[];

  const handleApplyAlbumCover = async () => {
    const file = albumCoverInputRef.current?.files?.[0];
    const query = coverTarget.trim().toLowerCase();
    if (!query) {
      notify("Enter an album or artist name", "error");
      return;
    }
    if (!file) {
      notify("Pick a cover image first", "error");
      return;
    }

    const matched = tracks.filter(
      (t) =>
        t.album?.trim().toLowerCase() === query ||
        t.artist.trim().toLowerCase() === query,
    );
    if (matched.length === 0) {
      notify(`No tracks match "${coverTarget}"`, "error");
      return;
    }

    setIsApplyingCover(true);
    let applied = 0;
    try {
      const processed = (await reencodeCoverArt(file)) ?? file;
      for (const track of matched) {
        const coverUrl = await uploadTrackCover(track.id, processed);
        const updated = await updateTrack(track.id, { coverArt: coverUrl });
        setTracks((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        );
        onTrackUpdated(updated);
        applied += 1;
      }
      notify(
        `Cover applied to ${applied} ${applied === 1 ? "track" : "tracks"}`,
      );
      if (albumCoverInputRef.current) albumCoverInputRef.current.value = "";
      setAlbumCoverName("");
    } catch (err) {
      console.error(err);
      notify(
        `Cover stopped after ${applied} of ${matched.length}: ${errorMessage(err, "server error")}`,
        "error",
      );
    } finally {
      setIsApplyingCover(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!orderDirty) return;
    setIsSavingOrder(true);
    try {
      await reorderTracks(tracks.map((t) => t.id));
      setOrderDirty(false);
      notify("Queue order saved");
    } catch (err) {
      console.error(err);
      notify(
        `Couldn't save order: ${errorMessage(err, "server error")}`,
        "error",
      );
    } finally {
      setIsSavingOrder(false);
    }
  };

  const toastView = (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
    >
      {toast && (
        <div
          className={clsx(
            "max-w-md border bg-surface px-4 py-2 font-mono text-xs uppercase tracking-[0.15em]",
            toast.tone === "error"
              ? "border-red-500/60 text-red-300"
              : "border-acid text-acid",
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );

  if (authStatus !== "authenticated") {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-surface px-4 py-16">
        <div className="w-full max-w-sm border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-6 py-3">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.4em] text-dim">
              Slughouse Records
            </span>
            <Lock size={14} className="text-acid" aria-hidden="true" />
          </div>
          <div className="px-6 py-8">
            <h1 className="font-display text-2xl uppercase leading-none tracking-tight text-ink">
              Vault
              <span className="block text-acid">Access</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-dim">
              Sign in with your Vercel account to manage the catalog. Staff
              only.
            </p>
            {authError ? (
              <div
                role="alert"
                className="mt-4 border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300"
              >
                {authError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleLogin}
              disabled={authStatus === "checking"}
              className={clsx(primaryButton, "mt-6 md:w-full")}
            >
              {authStatus === "checking"
                ? "Checking session…"
                : "Sign in with Vercel"}
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                "mt-4 w-full py-2 font-mono text-[0.7rem] uppercase tracking-[0.25em] text-dim transition-colors hover:text-ink",
                focusRing,
              )}
            >
              ← Back to the listening room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface text-ink">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-stretch justify-between border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5 md:px-6 md:py-3">
          <span className="truncate font-mono text-[0.65rem] uppercase tracking-[0.35em] text-dim">
            The Vault — Library Manager
          </span>
          <span className="truncate font-display text-base uppercase leading-none tracking-tight sm:text-lg md:text-xl">
            Slughouse Records
          </span>
        </div>
        <div className="flex items-stretch">
          <span className="hidden items-center border-l border-line px-5 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-dim lg:flex">
            {adminUser?.email}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className={clsx(
              "flex items-center gap-2 border-l border-line px-4 font-mono text-[0.7rem] uppercase tracking-[0.25em] text-dim transition-colors hover:bg-panel hover:text-ink",
              focusRing,
            )}
            aria-label="Sign out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className={clsx(
              "flex items-center border-l border-line px-4 font-mono text-[0.7rem] uppercase tracking-[0.25em] text-dim transition-colors hover:bg-panel hover:text-acid md:px-6",
              focusRing,
            )}
          >
            ← Player
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-3 pb-24 pt-6 sm:px-4 md:px-6 md:pt-8">
        {/* Upload */}
        <section className="border border-line" aria-labelledby="add-track">
          <SectionHeader
            index="01"
            title="Add new track"
            icon={<Upload size={13} />}
          />
          <div className="p-4 sm:p-5">
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label htmlFor="new-title" className={labelStyles}>
                  Title
                </label>
                <input
                  id="new-title"
                  type="text"
                  value={newTrackTitle}
                  onChange={(e) => setNewTrackTitle(e.target.value)}
                  className={inputStyles}
                  placeholder="From filename if blank"
                />
              </div>
              <div>
                <label htmlFor="new-artist" className={labelStyles}>
                  Artist
                </label>
                <input
                  id="new-artist"
                  type="text"
                  value={newTrackArtist}
                  onChange={(e) => setNewTrackArtist(e.target.value)}
                  className={inputStyles}
                  placeholder="Artist name"
                  list="artist-options"
                />
              </div>
              <div>
                <label htmlFor="new-album" className={labelStyles}>
                  Album
                </label>
                <input
                  id="new-album"
                  type="text"
                  value={newTrackAlbum}
                  onChange={(e) => setNewTrackAlbum(e.target.value)}
                  className={inputStyles}
                  placeholder="Album title"
                  list="album-options"
                />
              </div>
              <div>
                <label htmlFor="new-genre" className={labelStyles}>
                  Genre
                </label>
                <input
                  id="new-genre"
                  type="text"
                  value={newTrackGenre}
                  onChange={(e) => setNewTrackGenre(e.target.value)}
                  className={inputStyles}
                  placeholder="e.g. House, Hip-Hop"
                  list="genre-options"
                />
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 md:flex-row md:gap-4">
              <FilePicker
                id="new-audio"
                label="Select audio file"
                accept="audio/*"
                icon={
                  <Music className="h-7 w-7 text-acid" aria-hidden="true" />
                }
                inputRef={fileInputRef}
                fileName={audioName}
                onPick={handleAudioPicked}
              />
              <FilePicker
                id="new-cover"
                label="Cover art (optional)"
                hint="Overrides embedded art"
                accept="image/*"
                icon={
                  <ImageIcon className="h-7 w-7 text-acid" aria-hidden="true" />
                }
                inputRef={coverInputRef}
                fileName={coverName}
                onPick={(f) => setCoverName(f?.name ?? "")}
              />
              <button
                type="button"
                onClick={handleAddTrack}
                disabled={isUploading || !audioName}
                className={primaryButton}
              >
                {isUploading ? <Spinner /> : null}
                {isUploading ? "Uploading…" : "Add to vault"}
              </button>
            </div>
            <p className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim">
              Embedded album art is picked up automatically. Artist, album and
              genre stay filled in for the next upload.
            </p>
          </div>
        </section>

        {/* Edit */}
        <section
          ref={editSectionRef}
          className="mt-6 scroll-mt-20 border border-line"
          aria-label="Edit details"
        >
          <SectionHeader
            index="02"
            title="Edit details"
            icon={<Pencil size={13} />}
          />
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="edit-track" className={labelStyles}>
                  Track
                </label>
                <select
                  id="edit-track"
                  value={editTrackId}
                  onChange={(e) => handleSelectEdit(e.target.value)}
                  className={inputStyles}
                >
                  <option value="">Select a track…</option>
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title} · {track.artist}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-title" className={labelStyles}>
                  Title
                </label>
                <input
                  id="edit-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={inputStyles}
                  disabled={!editTrackId}
                />
              </div>
              <div>
                <label htmlFor="edit-artist" className={labelStyles}>
                  Artist
                </label>
                <input
                  id="edit-artist"
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className={inputStyles}
                  disabled={!editTrackId}
                  list="artist-options"
                />
              </div>
              <div>
                <label htmlFor="edit-album" className={labelStyles}>
                  Album
                </label>
                <input
                  id="edit-album"
                  type="text"
                  value={editAlbum}
                  onChange={(e) => setEditAlbum(e.target.value)}
                  className={inputStyles}
                  disabled={!editTrackId}
                  list="album-options"
                  placeholder="Leave blank for none"
                />
              </div>
              <div>
                <label htmlFor="edit-genre" className={labelStyles}>
                  Genre
                </label>
                <input
                  id="edit-genre"
                  type="text"
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  className={inputStyles}
                  disabled={!editTrackId}
                  list="genre-options"
                  placeholder="Leave blank for none"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleUpdateTrack}
                  disabled={isUpdating || !editTrackId}
                  className={clsx(
                    "w-full border border-ink px-6 py-3 font-mono text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-ink hover:text-black disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink",
                    focusRing,
                  )}
                >
                  {isUpdating ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
            <p className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim">
              Tip: tap the pencil on any track in the catalog below.
            </p>
          </div>
        </section>

        {/* Album cover */}
        <section className="mt-6 border border-line" aria-label="Album cover">
          <SectionHeader
            index="03"
            title="Album cover"
            icon={<ImageIcon size={13} />}
          />
          <div className="p-4 sm:p-5">
            <div className="mb-4 md:max-w-sm">
              <label htmlFor="cover-target" className={labelStyles}>
                Album or artist
              </label>
              <input
                id="cover-target"
                type="text"
                value={coverTarget}
                onChange={(e) => setCoverTarget(e.target.value)}
                className={inputStyles}
                placeholder="e.g. Gravel in My Boots"
                list="cover-target-options"
              />
            </div>
            <div className="flex flex-col items-stretch gap-3 md:flex-row md:gap-4">
              <FilePicker
                id="album-cover"
                label="Select cover image"
                accept="image/*"
                icon={
                  <ImageIcon className="h-7 w-7 text-acid" aria-hidden="true" />
                }
                inputRef={albumCoverInputRef}
                fileName={albumCoverName}
                onPick={(f) => setAlbumCoverName(f?.name ?? "")}
              />
              <button
                type="button"
                onClick={handleApplyAlbumCover}
                disabled={isApplyingCover}
                className={primaryButton}
              >
                {isApplyingCover ? <Spinner /> : null}
                {isApplyingCover ? "Applying…" : "Apply cover"}
              </button>
            </div>
            <p className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim">
              Sets the same cover on every track in that album, or every track
              by that artist.
            </p>
          </div>
        </section>

        {/* Catalog */}
        <section className="mt-6 border border-line" aria-label="Catalog">
          <SectionHeader index="04" title={`Catalog · ${tracks.length}`}>
            <button
              type="button"
              onClick={handleSaveOrder}
              disabled={!orderDirty || isSavingOrder}
              className={clsx(
                "min-h-[36px] border px-4 font-mono text-[0.68rem] uppercase tracking-[0.2em] transition-colors disabled:cursor-not-allowed",
                orderDirty
                  ? "border-acid text-acid hover:bg-acid hover:text-black"
                  : "border-line text-dim opacity-60",
                focusRing,
              )}
            >
              {isSavingOrder
                ? "Saving…"
                : orderDirty
                  ? "Save new order"
                  : "Order saved"}
            </button>
          </SectionHeader>
          <p className="border-b border-line px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim sm:px-5">
            Drag the grip to reorder, then save.
          </p>
          <Reorder.Group
            axis="y"
            values={tracks}
            onReorder={(next) => {
              setTracks(next);
              setOrderDirty(true);
            }}
          >
            {tracks.map((track) => (
              <TrackItem
                key={track.id}
                track={track}
                onDelete={() => handleDelete(track.id)}
                onEdit={() => startEdit(track.id)}
              />
            ))}
          </Reorder.Group>
          {tracks.length === 0 && (
            <div className="px-5 py-12 text-center font-mono text-xs uppercase tracking-[0.2em] text-dim">
              No tracks yet. Upload some music.
            </div>
          )}
        </section>
      </div>

      {/* Suggestions for the free-text fields */}
      <datalist id="artist-options">
        {Array.from(new Set(tracks.map((t) => t.artist).filter(Boolean))).map(
          (v) => (
            <option key={v} value={v} />
          ),
        )}
      </datalist>
      <datalist id="album-options">
        {Array.from(
          new Set(tracks.map((t) => t.album).filter(Boolean) as string[]),
        ).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="genre-options">
        {Array.from(
          new Set(tracks.map((t) => t.genre).filter(Boolean) as string[]),
        ).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="cover-target-options">
        {coverTargets.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      {toastView}
    </div>
  );
};

export default Admin;

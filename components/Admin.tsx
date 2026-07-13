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
} from "lucide-react";
import {
  deleteTrack,
  reorderTracks,
  saveTrack,
  updateTrack,
} from "../services/storage";
import { extractEmbeddedCoverArt } from "../services/embeddedArt";
import { extractWaveformPeaks } from "../services/waveformPeaks";
import { DEFAULT_COVER } from "../constants";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0b]";

const inputStyles =
  "w-full bg-[#0c0c0b] border border-line px-4 py-2.5 text-sm text-ink placeholder-dim/50 transition-colors focus:outline-none focus:border-acid";

const labelStyles =
  "block font-mono text-[0.6rem] uppercase tracking-[0.3em] text-dim mb-2";

interface TrackItemProps {
  track: Track;
  onDelete: () => void;
}

const TrackItem: React.FC<TrackItemProps> = ({ track, onDelete }) => {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={controls}
      className="group flex items-center justify-between border-b border-line bg-[#0c0c0b] px-3 py-3 transition-colors hover:bg-panel/60"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div
          className="cursor-grab touch-none p-2 text-dim/50 hover:text-ink active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical size={16} />
        </div>
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden border border-line bg-panel">
          <img
            src={track.coverArt || DEFAULT_COVER}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_COVER;
            }}
          />
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-sm font-medium text-ink">
            {track.title}
          </h4>
          <p className="truncate font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim">
            {track.artist}
          </p>
          <p className="mt-1 flex items-center gap-4 font-mono text-[0.6rem] text-dim/70">
            <span>{track.playCount ?? 0} plays</span>
            <span className="text-acid/80">
              {(track.vibeAverage ?? 0).toFixed(1)} res
            </span>
          </p>
        </div>
      </div>

      <button
        onClick={onDelete}
        className={`p-2 text-dim/50 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 ${focusRing}`}
        aria-label={`Delete ${track.title}`}
      >
        <Trash2 size={16} />
      </button>
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
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackArtist, setNewTrackArtist] = useState("");
  const [editTrackId, setEditTrackId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    // Auto-fill metadata from filename if empty
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    if (!newTrackTitle) setNewTrackTitle(fileName);
    if (!newTrackArtist) setNewTrackArtist("Unknown Artist");

    setIsUploading(false);
  };

  const handleAddTrack = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert("Please select an audio file.");
      return;
    }

    setIsUploading(true);

    const id = crypto.randomUUID();
    const [coverArt, waveform] = await Promise.all([
      extractEmbeddedCoverArt(file),
      extractWaveformPeaks(file),
    ]);
    const metadata = {
      id,
      title: newTrackTitle || "Untitled",
      artist: newTrackArtist || "Unknown",
      duration: waveform.duration || 0,
      addedAt: Date.now(),
      coverArt,
      waveformPeaks: waveform.peaks,
    };

    try {
      const savedTrack = await saveTrack(metadata, file);
      setTracks((prev) => [...prev, savedTrack]);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Upload failed";
      alert(`Failed to upload track: ${message}`);
    }

    // Reset form
    setNewTrackTitle("");
    setNewTrackArtist("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsUploading(false);
  };

  const handleDelete = async (id: string) => {
    const track = tracks.find((t) => t.id === id);
    if (!track) return;
    try {
      await deleteTrack(track);
      setTracks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
      alert("Unable to delete track from the server.");
    }
  };

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  const handleSelectEdit = (id: string) => {
    setEditTrackId(id);
    const target = tracks.find((t) => t.id === id);
    setEditTitle(target?.title || "");
    setEditArtist(target?.artist || "");
  };

  const handleUpdateTrack = async () => {
    if (!editTrackId) {
      alert("Select a track to edit.");
      return;
    }

    setIsUpdating(true);
    try {
      const updated = await updateTrack(editTrackId, {
        title: editTitle,
        artist: editArtist,
      });

      setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      onTrackUpdated(updated);
      setToastMessage("Track updated");
    } catch (err) {
      console.error(err);
      alert("Unable to update track.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!orderDirty) return;
    setIsSavingOrder(true);
    try {
      await reorderTracks(tracks.map((t) => t.id));
      setOrderDirty(false);
      setToastMessage("Queue order saved");
    } catch (err) {
      console.error(err);
      alert("Unable to save order.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  if (authStatus !== "authenticated") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0c0c0b] px-4 py-16">
        <div className="w-full max-w-sm border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-6 py-3">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.4em] text-dim">
              Slughouse Records
            </span>
            <Lock size={14} className="text-acid" aria-hidden="true" />
          </div>
          <div className="px-6 py-8">
            <h2 className="font-display text-2xl uppercase leading-none tracking-tight text-ink">
              Vault
              <span className="block text-acid">Access</span>
            </h2>
            <p className="mt-4 font-mono text-[0.6rem] uppercase tracking-[0.3em] text-dim">
              Vercel protected — staff only
            </p>
            <p className="mt-4 text-sm leading-relaxed text-dim">
              Sign in with a verified Vercel account to manage the catalog.
            </p>
            {authError ? (
              <div className="mt-4 border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
                {authError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleLogin}
              disabled={authStatus === "checking"}
              className={`mt-6 flex w-full items-center justify-center gap-2 bg-acid py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-black transition-transform hover:scale-[1.02] disabled:opacity-60 ${focusRing}`}
            >
              {authStatus === "checking"
                ? "Checking session…"
                : "Sign in with Vercel"}
              <ArrowRight size={14} />
            </button>
            <button
              onClick={onClose}
              className={`mt-4 w-full py-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-dim transition-colors hover:text-ink ${focusRing}`}
            >
              ← Back to the listening room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0b] text-ink">
      {/* Header */}
      <header className="flex items-stretch justify-between border-b border-line">
        <div className="flex flex-col gap-0.5 px-4 py-3 md:px-6">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.4em] text-dim">
            The Vault — Library Manager
          </span>
          <span className="font-display text-lg uppercase leading-none tracking-tight md:text-xl">
            Slughouse Records
          </span>
        </div>
        <div className="flex items-stretch">
          <span className="hidden items-center border-l border-line px-5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-dim md:flex">
            {adminUser?.email}
          </span>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 border-l border-line px-4 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-dim transition-colors hover:bg-panel hover:text-ink ${focusRing}`}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
          <button
            onClick={onClose}
            className={`flex items-center border-l border-line px-4 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-dim transition-colors hover:bg-panel hover:text-acid md:px-6 ${focusRing}`}
          >
            ← Player
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-8 md:px-6">
        {/* Upload Section */}
        <section className="border border-line">
          <div className="flex items-center gap-3 border-b border-line bg-panel px-5 py-3">
            <span className="font-mono text-[0.65rem] text-acid">01</span>
            <h3 className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.3em] text-ink">
              <Upload size={13} /> Add New Track
            </h3>
          </div>

          <div className="p-5">
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelStyles}>Title</label>
                <input
                  type="text"
                  value={newTrackTitle}
                  onChange={(e) => setNewTrackTitle(e.target.value)}
                  className={inputStyles}
                  placeholder="Song Title"
                />
              </div>
              <div>
                <label className={labelStyles}>Artist</label>
                <input
                  type="text"
                  value={newTrackArtist}
                  onChange={(e) => setNewTrackArtist(e.target.value)}
                  className={inputStyles}
                  placeholder="Artist Name"
                />
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-4 md:flex-row">
              <label
                className={`flex flex-1 cursor-pointer flex-col items-center border border-dashed border-line px-4 py-6 transition-colors hover:border-acid hover:bg-panel ${focusRing}`}
              >
                <Music className="h-7 w-7 text-acid" />
                <span className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-dim">
                  Select Audio File
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="audio/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </label>

              <button
                onClick={handleAddTrack}
                disabled={isUploading}
                className={`flex w-full items-center justify-center gap-2 bg-acid px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] text-black transition-transform hover:scale-[1.02] disabled:opacity-60 md:w-auto ${focusRing}`}
              >
                {isUploading ? (
                  <span className="h-4 w-4 animate-spin border-2 border-black/30 border-t-black"></span>
                ) : null}
                {isUploading ? "Processing…" : "Add to Vault"}
              </button>
            </div>
            <p className="mt-4 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-dim/70">
              Tracks upload straight to the vault — embedded album art is picked
              up automatically.
            </p>
          </div>
        </section>

        {/* Edit Section */}
        <section className="mt-6 border border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[0.65rem] text-acid">02</span>
              <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-ink">
                Edit Metadata
              </h3>
            </div>
            <button
              onClick={handleSaveOrder}
              disabled={!orderDirty || isSavingOrder}
              className={`border px-4 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.2em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                orderDirty
                  ? "border-acid text-acid hover:bg-acid hover:text-black"
                  : "border-line text-dim"
              } ${focusRing}`}
            >
              {isSavingOrder
                ? "Saving…"
                : orderDirty
                  ? "Save queue order"
                  : "Order saved"}
            </button>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
              <div>
                <label className={labelStyles}>Track</label>
                <select
                  value={editTrackId}
                  onChange={(e) => handleSelectEdit(e.target.value)}
                  className={inputStyles}
                >
                  <option value="">Select track</option>
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title} · {track.artist}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelStyles}>Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={inputStyles}
                  placeholder="Song Title"
                />
              </div>
              <div>
                <label className={labelStyles}>Artist</label>
                <input
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className={inputStyles}
                  placeholder="Artist"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleUpdateTrack}
                disabled={isUpdating}
                className={`border border-ink px-6 py-3 font-mono text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-ink hover:text-black disabled:opacity-50 ${focusRing}`}
              >
                {isUpdating ? "Saving…" : "Update Track"}
              </button>
            </div>
          </div>
        </section>

        {/* Track List */}
        <section className="mt-6 border border-line">
          <div className="flex items-center justify-between border-b border-line bg-panel px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[0.65rem] text-acid">03</span>
              <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-ink">
                Catalog
              </h3>
            </div>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-dim">
              {tracks.length} {tracks.length === 1 ? "Track" : "Tracks"}
            </span>
          </div>
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

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 border border-acid bg-[#0c0c0b] px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-acid"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default Admin;

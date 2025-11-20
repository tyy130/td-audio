import React, { useState, useRef } from 'react';
import { Track } from '../types';
import { Reorder, useDragControls } from 'framer-motion';
import { Trash2, GripVertical, Music, Sparkles, Upload, Lock, ArrowRight } from 'lucide-react';
import { generateTrackDescription } from '../services/gemini';
import { saveTrack, deleteTrack } from '../services/storage';
import { DEFAULT_COVER } from '../constants';

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
      className="flex items-center justify-between bg-neutral-900/40 border border-neutral-800/50 p-3 rounded-xl hover:bg-neutral-800/50 transition-colors group"
    >
      <div className="flex items-center gap-4 overflow-hidden">
        <div
          className="cursor-grab touch-none text-neutral-600 hover:text-neutral-300 active:cursor-grabbing p-2"
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical size={18} />
        </div>
        <div className="h-10 w-10 rounded bg-neutral-800 flex items-center justify-center flex-shrink-0 text-indigo-500">
            <Music size={16} />
        </div>
        <div className="min-w-0">
          <h4 className="font-medium text-neutral-200 truncate">{track.title}</h4>
          <p className="text-sm text-neutral-500 truncate">{track.artist}</p>
        </div>
      </div>
      
      <button 
        onClick={onDelete}
        className="p-2 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={18} />
      </button>
    </Reorder.Item>
  );
};

interface AdminProps {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  onClose: () => void;
}

const Admin: React.FC<AdminProps> = ({ tracks, setTracks, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleLogin = (e?: React.FormEvent) => {
      e?.preventDefault();
      // Simple client-side check for demo
      if (password === 'admin') {
          setIsAuthenticated(true);
      } else {
          alert('Incorrect password. Hint: admin');
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    // Auto-fill metadata from filename if empty
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    if (!newTrackTitle) setNewTrackTitle(fileName);
    if (!newTrackArtist) setNewTrackArtist('Unknown Artist');

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
    
    // Generate AI description automatically
    let description = "Just added.";
    try {
        description = await generateTrackDescription(newTrackTitle, newTrackArtist);
    } catch (err) {
        console.warn("AI generation skipped");
    }

    const newTrack: Track = {
      id,
      title: newTrackTitle || "Untitled",
      artist: newTrackArtist || "Unknown",
      fileHandle: file, // Store the file object for IDB
      src: URL.createObjectURL(file), // Temporary URL for immediate playback
      duration: 0, // Ideally we'd read metadata here, skipping for brevity
      addedAt: Date.now(),
      coverArt: DEFAULT_COVER,
      description
    };

    await saveTrack(newTrack);
    setTracks(prev => [...prev, newTrack]);
    
    // Reset form
    setNewTrackTitle('');
    setNewTrackArtist('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsUploading(false);
  };

  const handleDelete = async (id: string) => {
      await deleteTrack(id);
      setTracks(prev => prev.filter(t => t.id !== id));
  };

  if (!isAuthenticated) {
      return (
          <div className="flex items-center justify-center h-full w-full bg-black">
              <div className="w-full max-w-sm p-8 bg-neutral-900 rounded-2xl border border-neutral-800 text-center">
                  <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-500">
                      <Lock size={20} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Admin Access</h2>
                  <p className="text-neutral-500 mb-6">Enter password to manage library</p>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button 
                          type="submit"
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                          Login <ArrowRight size={16} />
                      </button>
                  </form>
                  <button onClick={onClose} className="mt-6 text-sm text-neutral-600 hover:text-neutral-400">
                      Cancel and go back
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 pb-24 bg-black min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">Library Manager</h2>
        <button onClick={onClose} className="text-sm font-medium text-neutral-500 hover:text-white transition-colors">
          Back to Player
        </button>
      </div>

      {/* Upload Section */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-8 backdrop-blur-sm">
        <h3 className="text-xl font-semibold text-indigo-400 mb-4 flex items-center gap-2">
          <Upload size={20} /> Add New Track
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase mb-1">Title</label>
            <input
              type="text"
              value={newTrackTitle}
              onChange={(e) => setNewTrackTitle(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Song Title"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase mb-1">Artist</label>
            <input
              type="text"
              value={newTrackArtist}
              onChange={(e) => setNewTrackArtist(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Artist Name"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
           <label className="flex-1 w-full flex flex-col items-center px-4 py-6 bg-black text-blue rounded-lg shadow-lg tracking-wide uppercase border border-neutral-800 cursor-pointer hover:bg-neutral-900 hover:border-indigo-500 transition-all">
                <Music className="w-8 h-8 text-indigo-500" />
                <span className="mt-2 text-base leading-normal text-neutral-300">Select Audio File</span>
                <input type='file' className="hidden" accept="audio/*" ref={fileInputRef} onChange={handleFileUpload} />
            </label>
            
            <button 
              onClick={handleAddTrack}
              disabled={isUploading}
              className="h-full w-full md:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isUploading ? (
                 <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              ) : (
                 <Sparkles size={18} />
              )}
              {isUploading ? 'Processing...' : 'Add to Library'}
            </button>
        </div>
        <p className="text-xs text-neutral-600 mt-4">
          * Tracks are stored in your browser's database. Gemini 2.5 Flash generates descriptions automatically.
        </p>
      </div>

      {/* Track List */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-neutral-300 mb-4">Current Tracks</h3>
        <Reorder.Group axis="y" values={tracks} onReorder={setTracks} className="space-y-2">
          {tracks.map((track) => (
            <TrackItem key={track.id} track={track} onDelete={() => handleDelete(track.id)} />
          ))}
        </Reorder.Group>
        {tracks.length === 0 && (
            <div className="text-center py-12 text-neutral-600 border-2 border-dashed border-neutral-900 rounded-xl bg-neutral-900/30">
                No tracks yet. Upload some music!
            </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
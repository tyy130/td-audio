// Upload helpers live apart from storage.ts so the Vercel Blob client only
// loads with the admin screen, not for every listener.
import { upload } from '@vercel/blob/client';
import { Track } from '../types';
import { buildUrl, handleResponse, TrackInsert } from './storage';

export const saveTrack = async (
  metadata: TrackInsert,
  file: File,
  coverFile?: File,
): Promise<Track> => {
  const filename = `${metadata.id}-${file.name}`;

  const blob = await upload(filename, file, {
    access: 'public',
    contentType: file.type || 'audio/mpeg',
    handleUploadUrl: buildUrl('/uploads/blob'),
    multipart: true,
  });
  const publicUrl = blob.url;

  let coverUrl = metadata.coverArt;
  if (coverFile) {
    try {
      const coverBlob = await upload(`${metadata.id}-cover.jpg`, coverFile, {
        access: 'public',
        contentType: coverFile.type || 'image/jpeg',
        handleUploadUrl: buildUrl('/uploads/blob'),
        multipart: false,
      });
      coverUrl = coverBlob.url;
    } catch (error) {
      console.warn('Unable to upload cover art', error);
    }
  }

  const finalMetadata = {
    ...metadata,
    title: metadata.title,
    artist: metadata.artist,
    genre: metadata.genre,
    album: metadata.album,
    duration: metadata.duration || 0,
    coverArt: coverUrl,
    waveformPeaks: metadata.waveformPeaks,
    src: publicUrl,
    storagePath: blob.pathname || filename
  };

  const response = await fetch(buildUrl('/tracks'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(finalMetadata),
  });

  const handled = await handleResponse(response);
  return handled.json();
};

export const uploadTrackCover = async (
  trackId: string,
  file: File,
): Promise<string> => {
  const blob = await upload(`${trackId}-cover.jpg`, file, {
    access: 'public',
    contentType: file.type || 'image/jpeg',
    handleUploadUrl: buildUrl('/uploads/blob'),
    multipart: false,
  });
  return blob.url;
};

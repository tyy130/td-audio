-- Slughouse Records Database Schema (Postgres/Neon)
-- Run via psql or Neon SQL Editor

CREATE TABLE IF NOT EXISTS tracks (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  audio_url TEXT NOT NULL,
  audio_path TEXT DEFAULT NULL,
  cover_art TEXT DEFAULT NULL,
  duration INT DEFAULT 0,
  added_at BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tracks_added_at ON tracks(added_at);

CREATE TABLE IF NOT EXISTS track_metrics (
  track_id VARCHAR(36) PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  play_count INT NOT NULL DEFAULT 0,
  vibe_total INT NOT NULL DEFAULT 0,
  vibe_count INT NOT NULL DEFAULT 0,
  last_played_at BIGINT NULL
);

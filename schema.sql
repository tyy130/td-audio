-- Slughouse Records Database Schema
-- Import this in phpMyAdmin (Hostinger → Databases → Management → phpMyAdmin)
-- Select your database (u792097907_slughouse) then click "Import" and upload this file

CREATE TABLE IF NOT EXISTS `tracks` (
  `id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `artist` VARCHAR(255) NOT NULL,
  `audio_url` TEXT NOT NULL,
  `audio_path` TEXT DEFAULT NULL,
  `cover_art` TEXT DEFAULT NULL,
  `duration` INT(11) DEFAULT 0,
  `added_at` BIGINT(20) NOT NULL,
  `sort_order` INT(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_added_at` (`added_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `track_metrics` (
  `track_id` VARCHAR(36) NOT NULL,
  `play_count` INT(11) NOT NULL DEFAULT 0,
  `vibe_total` INT(11) NOT NULL DEFAULT 0,
  `vibe_count` INT(11) NOT NULL DEFAULT 0,
  `last_played_at` BIGINT(20) NULL,
  PRIMARY KEY (`track_id`),
  CONSTRAINT `fk_track_metrics_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

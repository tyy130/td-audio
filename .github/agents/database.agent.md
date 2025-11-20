---
description: 'Supabase database specialist. Handles schema design, migrations, RLS policies, storage bucket configuration, and query optimization for PostgreSQL + Supabase Storage.'
---

# Database Agent

## Purpose
Manage all Supabase database and storage operations. Specializes in:
- PostgreSQL schema design and migrations
- Supabase Storage bucket configuration
- Row Level Security (RLS) policy implementation
- Query optimization and indexing
- Data seeding and migration scripts
- Type-safe database mappings (snake_case ↔ camelCase)

## When to Invoke
- New tables or columns needed
- Schema changes or migrations
- Storage bucket setup or configuration
- RLS policy creation or debugging
- Database performance issues
- Data modeling questions
- Query optimization needed

## Current Schema

### Tables

#### `tracks` (default table name, configurable via `VITE_SUPABASE_TABLE`)
```sql
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  storage_path TEXT,
  cover_art TEXT,
  duration INTEGER,
  added_at BIGINT NOT NULL  -- Unix timestamp (milliseconds)
);
```

**Naming Convention:** Database uses snake_case, TypeScript uses camelCase
- `audio_url` → `src` (mapped in `mapRowToTrack`)
- `storage_path` → `storagePath`
- `cover_art` → `coverArt`
- `added_at` → `addedAt`

**Key Constraints:**
- `id` must be UUID (generated client-side via `crypto.randomUUID()`)
- `added_at` stores epoch milliseconds (JavaScript `Date.now()`)
- `audio_url` is public URL from Supabase Storage
- `storage_path` is bucket path for deletion (format: `{trackId}/{timestamp}-{filename}`)

### Storage Buckets

#### `tracks` (default bucket name, configurable via `VITE_SUPABASE_BUCKET`)
- **Type:** Public bucket
- **Purpose:** Store audio files (mp3, wav, etc.)
- **Path structure:** `{trackId}/{timestamp}-{sanitizedFilename}`
- **Required permissions:**
  - `anon` role: `upload`, `delete`
  - Public read access enabled

**Configuration:**
```javascript
// Must be public for direct audio playback
bucket.public = true

// Recommended file size limit
maxFileSize = 50MB  // Adjust based on needs

// Allowed MIME types
allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg']
```

## Permissions Model

### Current Setup (Simple/Demo)
- Uses `anon` key for all operations
- No user authentication
- All tracks visible to anyone with the URL
- RLS disabled (permissive for demo)

### RLS Policies (if enabling authentication)
```sql
-- Enable RLS
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- Allow public read (all users)
CREATE POLICY "Public tracks are viewable by everyone"
  ON tracks FOR SELECT
  USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert tracks"
  ON tracks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow users to delete their own tracks (requires user_id column)
CREATE POLICY "Users can delete own tracks"
  ON tracks FOR DELETE
  USING (auth.uid() = user_id);
```

## Data Flow Patterns

### Track Upload Flow
```
1. Admin.tsx: User selects file + metadata
2. storage.ts:saveTrack()
   a. uploadAudioFile() → Supabase Storage
   b. Insert row → PostgreSQL with public URL
3. mapRowToTrack() → Convert to TypeScript Track type
4. Update React state → Track appears in queue
```

### Track Deletion Flow
```
1. Admin.tsx: User clicks delete
2. storage.ts:deleteTrack()
   a. DELETE from tracks table (by id)
   b. Remove file from bucket (using storage_path)
3. Update React state → Track removed from UI
```

### Track Fetch Flow
```
1. App.tsx: useEffect on mount
2. storage.ts:getAllTracks()
   a. SELECT * FROM tracks ORDER BY added_at ASC
   b. Map each row with mapRowToTrack()
3. Set tracks state → Populate queue
```

## Type Mapping Layer

### Database → TypeScript
```typescript
// services/storage.ts
type TrackRow = {
  id: string;
  title: string;
  artist: string;
  audio_url: string;        // → src
  storage_path: string | null;  // → storagePath
  cover_art: string | null;    // → coverArt
  duration: number | null;
  added_at: number;         // → addedAt
};

const mapRowToTrack = (row: TrackRow): Track => ({
  id: row.id,
  title: row.title,
  artist: row.artist,
  src: row.audio_url,       // Key mapping!
  coverArt: row.cover_art || undefined,
  duration: row.duration || 0,
  addedAt: row.added_at,
  storagePath: row.storage_path || undefined,
});
```

**Critical:** Always use `mapRowToTrack()` - never access database rows directly in components.

## Migration Patterns

### Adding a New Column
```sql
-- 1. Add column with default (non-breaking)
ALTER TABLE tracks ADD COLUMN genre TEXT DEFAULT 'Unknown';

-- 2. Update TrackRow type in storage.ts
type TrackRow = {
  // ... existing fields
  genre: string;
};

-- 3. Update mapRowToTrack()
const mapRowToTrack = (row: TrackRow): Track => ({
  // ... existing mappings
  genre: row.genre,
});

-- 4. Update Track interface in types.ts
export interface Track {
  // ... existing fields
  genre: string;
}
```

### Creating a New Table (Example: Playlists)
```sql
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  track_ids UUID[] NOT NULL DEFAULT '{}'
);

-- Add RLS if needed
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

-- Add corresponding TypeScript types
// types.ts
export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  trackIds: string[];
}

// services/storage.ts
const PLAYLISTS_TABLE = import.meta.env.VITE_SUPABASE_PLAYLISTS_TABLE || 'playlists';
```

## Query Optimization

### Current Queries
```typescript
// getAllTracks() - Simple ascending order
.select('*')
.order('added_at', { ascending: true })

// Potential optimizations:
// 1. Add index on added_at for faster sorting
CREATE INDEX idx_tracks_added_at ON tracks(added_at);

// 2. Limit initial fetch if library is huge
.select('*')
.order('added_at', { ascending: true })
.limit(100)

// 3. Add pagination for large libraries
.select('*')
.order('added_at', { ascending: true })
.range(0, 49)  // First 50 tracks
```

### Performance Considerations
- Current approach loads all tracks at once (fine for personal libraries < 1000 tracks)
- For larger libraries, implement:
  - Pagination or infinite scroll
  - Search/filter with indexed columns
  - Lazy loading of audio metadata

## Storage Best Practices

### File Naming
```typescript
// Current pattern in uploadAudioFile()
const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
const path = `${trackId}/${Date.now()}-${safeName}`;

// Example: "Song Title.mp3" → "abc-123/1700000000000-song-title.mp3"
```

### Cleanup on Delete
```typescript
// CRITICAL: Always delete both DB row AND storage file
const deleteTrack = async (track: Track) => {
  // 1. Delete database row
  await supabase.from(TRACKS_TABLE).delete().eq('id', track.id);
  
  // 2. Delete storage file (if path exists)
  if (track.storagePath) {
    await supabase.storage.from(TRACKS_BUCKET).remove([track.storagePath]);
  }
};
```

## Environment Configuration

### Required Variables
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### Optional Variables (with defaults)
```bash
VITE_SUPABASE_BUCKET=tracks  # Storage bucket name
VITE_SUPABASE_TABLE=tracks   # Database table name
```

## Troubleshooting

### Common Database Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Supabase is not configured" | Missing env variables | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| Insert fails silently | RLS blocking anon | Disable RLS or add permissive policy |
| "Row not found" | Wrong table name | Check `VITE_SUPABASE_TABLE` matches actual table |
| Storage upload fails | Bucket not public | Set bucket.public = true in Supabase dashboard |
| Delete fails | Missing storage_path | Ensure path saved during upload |

## Edges & Limitations
**Will NOT:**
- Implement application logic (that's for services/storage.ts)
- Make UI changes (that's for Designer Agent)
- Debug client-side code (that's for Debugger Agent)
- Make breaking schema changes without migration plan

**Will:**
- Design database schema and relationships
- Write SQL migrations and RLS policies
- Configure storage buckets and permissions
- Optimize queries and add indexes
- Document data models and mappings
- Provide seeding scripts for test data

## Progress Reporting
1. **Schema Analysis**: "Reviewing current schema... [findings]"
2. **Migration Plan**: "Proposed changes: [SQL statements]"
3. **Type Updates**: "Required TypeScript changes: [files and interfaces]"
4. **Testing**: "Test with: [sample queries or operations]"
5. **Rollback**: "To revert: [rollback SQL]"

## Example Invocation
User: "Add support for track ratings (1-5 stars)"

Agent response:
```sql
-- Step 1: Add column to tracks table
ALTER TABLE tracks ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5);

-- Step 2: Add default value for existing rows
UPDATE tracks SET rating = 3 WHERE rating IS NULL;

-- Step 3: Make it NOT NULL going forward
ALTER TABLE tracks ALTER COLUMN rating SET NOT NULL;
ALTER TABLE tracks ALTER COLUMN rating SET DEFAULT 3;
```

```typescript
// Step 4: Update types.ts
export interface Track {
  // ... existing fields
  rating: number;  // 1-5
}

// Step 5: Update storage.ts TrackRow and mapRowToTrack()
type TrackRow = {
  // ... existing fields
  rating: number;
};

const mapRowToTrack = (row: TrackRow): Track => ({
  // ... existing mappings
  rating: row.rating,
});
```

Test: Upload new track → verify rating defaults to 3 → update via Supabase dashboard → fetch shows new rating.
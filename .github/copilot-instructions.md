# TD Audio Player - AI Coding Instructions

## Project Overview
Private music player ("Slughouse Records") built with React + TypeScript + Vite. Audio files land on Hostinger file storage while metadata lives in a MySQL database behind a lightweight Express API. Features password-protected admin panel for library management and a custom player UI with shuffle/repeat modes.

## Architecture

### Data Flow
1. **API Layer** (`server/src/index.js`): Express app with `/tracks` endpoints. Handles MySQL queries plus file uploads via Multer. Configure with `server/.env` (MySQL host, media folder, base URL, optional admin token).
2. **Track Management** (`services/storage.ts`): Frontend helper that talks to the Express API using `fetch`. Pulls `VITE_API_BASE_URL` and optional `VITE_ADMIN_TOKEN` from Vite env vars.
3. **State Management** (`App.tsx`): Central state with no external store. Manages tracks, current track, playback modes, and persists settings to localStorage as `td-audio-settings`.
4. **Player Audio** (`hooks/useAudio.ts`): HTMLAudioElement wrapper. Creates new Audio instance per track change - manages playback, duration tracking, and auto-advance callbacks.

### Key Components
- **App.tsx**: Root coordinator. Handles track selection logic, shuffle/repeat modes, and localStorage persistence.
- **Player.tsx**: Main UI. Passes playback actions to parent, receives state as props. Desktop/mobile responsive layouts (sidebar queue hidden on mobile).
- **Admin.tsx**: Password-protected (`admin`) library manager. Uses `framer-motion` for drag-reorder. Uploads through the REST helper in `services/storage.ts` (multipart formdata).
- **Visualizer.tsx**: Animated bar visualization using CSS animations, not connected to actual audio data.

## Critical Patterns

### Track Data Structure
```typescript
// types.ts defines this shape
interface Track {
  id: string;           // UUID generated client-side
  src: string;          // Public URL returned by API (MEDIA_BASE_URL + relative path)
  storagePath?: string; // Relative file path stored in MySQL for cleanup
  // ... other fields
}
```
The API already returns camelCase, so the frontend just trusts the payload.

### Playback Logic
- **Shuffle**: `pickRandomTrack()` filters out current track before randomizing
- **Repeat Modes**: `'off'` stops at end, `'all'` loops playlist, `'one'` loops track via `shouldLoop` in useAudio
- **Auto-advance**: `handleAutoAdvance()` called from `useAudio` `onEnded`. Respects repeat mode - does NOT advance if `repeatMode === 'one'` or last track with `repeatMode === 'off'`

### Environment Variables
Frontend (`.env.local`):
```bash
VITE_API_BASE_URL=https://slughouse-api.yourhost.com
VITE_ADMIN_TOKEN=optional-shared-secret
```

Backend (`server/.env`):
```bash
MYSQL_HOST=...
MYSQL_DATABASE=...
MYSQL_USER=...
MYSQL_PASSWORD=...
MEDIA_ROOT=/home/<user>/uploads
MEDIA_BASE_URL=https://playback.slughouse.com/uploads/
ALLOWED_ORIGINS=https://playback.slughouse.com
ADMIN_TOKEN=optional-shared-secret
```

## Development Workflows

### Run Dev Server
```bash
npm run dev                 # frontend on :3000
npm run dev --prefix server # backend on :4000
```

### Hostinger Setup (see README.md)
1. Provision MySQL DB + user and run the schema from the README.
2. Create `/uploads` (or custom) directory accessible over HTTPS; set `MEDIA_ROOT` + `MEDIA_BASE_URL` accordingly.
3. Deploy `/server` to Hostinger and keep it running (PM2/systemd or their Node hosting).

### Adding Features to Player
- New playback controls → Add to `Player.tsx`, wire up via props to `App.tsx` handlers
- Persistent settings → Update `PersistentSettings` type and localStorage effects in `App.tsx`
- Audio processing → Modify `useAudio` hook, which wraps HTMLAudioElement directly

## Styling Conventions
- **Tailwind utility-first**: All styling via className, no separate CSS files
- **Color palette**: Indigo/purple gradient backgrounds, neutral grays for UI
- **Brand voice**: "Slughouse Records" theme with exclusive/private messaging ("keep it close", "vault")
- **Responsive**: Mobile-first, queue sidebar hidden on `md:` breakpoint
- **Animations**: Framer Motion for drag/drop in Admin, CSS transitions/animations elsewhere

## Common Pitfalls
1. **Audio cleanup**: `useAudio` always removes event listeners in cleanup. Don't manually manage Audio elements outside this hook.
2. **Track reordering**: Uses `framer-motion` Reorder.Group in Admin - parent state must update via `onReorder={setTracks}`.
3. **File uploads**: `saveTrack()` always sends multipart form data with metadata fields. Backend writes file first, then inserts MySQL row; it cleans up on failure.
4. **Error handling**: Alerts surface API errors; check backend logs for MySQL or filesystem failures.
5. **Cover art fallback**: `DEFAULT_COVER` from constants.ts used when missing. Player.tsx has `onError` handler for broken images.

## Testing Approach
No formal test suite. Manual testing workflow:
1. Verify upload in Admin panel
2. Check track appears in queue
3. Test playback controls (play/pause/next/prev)
4. Verify shuffle randomization (check at least 3 tracks differ from sequential)
5. Test repeat modes with console logging if needed
6. Check localStorage persistence across page reload

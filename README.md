# Slughouse Listen

The private Slughouse Records listening room at [listen.slughouse.com](https://listen.slughouse.com).

React 19 + Vite on the front, Vercel Functions in `api/`, Neon Postgres for the catalog and play stats, and Vercel Blob for audio and cover art.

## What's where

| Path | What it does |
| --- | --- |
| `App.tsx` | Library loading, playback queue, shuffle/repeat, saved settings |
| `components/Player.tsx` | Listening room: now playing, transport, keyboard shortcuts, Media Session |
| `components/Catalog.tsx` | Track list grouped by album, artist or genre |
| `components/Visualizer.tsx` | Level bars (own animation loop, no React re-renders) |
| `components/Admin.tsx` | The Vault: upload, edit, album covers, reorder, delete (lazy-loaded) |
| `hooks/useAudio.ts` | The audio element, Web Audio analyser, and the touch-device fallback |
| `services/storage.ts` | Read-side API calls (tracks, plays, ratings) |
| `services/uploads.ts` | Blob uploads, admin only so listeners never download it |
| `api/` | Vercel Functions: tracks CRUD, plays, ratings, auth, blob upload tokens |
| `scripts/migrate-covers.mjs` | One-off cover art migration |

## Local development

```bash
npm install
npx vercel dev     # app + API on http://localhost:3000
```

`npm run dev` runs the frontend alone (no API). `vercel env pull .env.local` fills in most values, but sensitive ones come back as empty strings, so set those by hand.

Checks (the same ones CI runs on pull requests):

```bash
npx tsc --noEmit
npm run build
```

## Environment

See [`.env.example`](./.env.example). All backend values live in the Vercel project.

## Deploys

Vercel's Git integration deploys `main` to production. Every other branch gets a preview URL. The Gauntlet workflow in `.github/workflows/gauntlet.yml` typechecks, builds and scans for secrets on each pull request.

## Admin

Open the Vault from the gear icon (or `?admin=1`). Sign-in is Sign in with Vercel, and only one address is accepted, checked server-side: `AUTHORIZED_ADMIN_EMAIL`, or the owner address hardcoded in `api/_lib/auth.js` when that isn't set. Writes and blob uploads are authorized by the signed session cookie.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space or K | Play / pause |
| ← / → | Seek 5 seconds |
| Shift + ← / → | Previous / next track |
| M | Mute |

## API

- `GET /api/tracks`, `POST /api/tracks`
- `GET|PATCH|DELETE /api/tracks/:id` (PATCH with an empty `album` or `genre` clears it)
- `POST /api/tracks/reorder`
- `POST /api/tracks/:id/play`
- `POST /api/tracks/:id/vibe`
- `POST /api/uploads/blob`
- `GET /api/auth/authorize`, `/api/auth/callback`, `/api/auth/me`, `POST /api/auth/signout`

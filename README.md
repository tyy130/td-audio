# Slughouse Listen

Modern Slughouse media player for `listen.slughouse.com`.

This repo is now set up for a Vercel deployment model: React 19 + Vite frontend, Vercel serverless API routes, Neon Postgres, and Vercel Blob-compatible uploads. It also includes your local source media under [`music/SUNO Downloads`](./music/SUNO%20Downloads).

## Why This Base

- `td-audio` is the newest player repo and has the most mature product surface.
- `audio-player-master` contains older but useful Hostinger/shared-host deployment scripts.
- `slughouse-media-player` appears to be an earlier player that targeted `playback.slughouse.com`.

## Local Development

```bash
npm install
npm run dev
```

For API routes during development:

```bash
npx vercel dev
```

## Required Environment

Copy [`.env.example`](./.env.example) to `.env.local` for local work:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

Backend values are expected in the Vercel project:

```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
APP_BASE_URL=https://listen.slughouse.com
SESSION_SECRET=replace-with-a-long-random-string
AUTHORIZED_ADMIN_EMAIL=1forfunnn@gmail.com
VERCEL_APP_CLIENT_ID=your-vercel-app-client-id
VERCEL_APP_CLIENT_SECRET=your-vercel-app-client-secret
S3_BUCKET=your-bucket
S3_REGION=auto
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
```

## Vercel Setup

1. Import this repo into Vercel.
2. Set the framework to `Vite` if Vercel does not auto-detect it.
3. Create a Vercel app for Sign in with Vercel.
4. Add `https://listen.slughouse.com/api/auth/callback` as an authorization callback URL in that Vercel app.
5. Add the environment variables from [`.env.example`](./.env.example).
6. Run the SQL in [`schema.sql`](./schema.sql) against Neon before first use.
7. Add the custom domain `listen.slughouse.com` in the Vercel project settings.

The repository now uses CI only in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml). Deployment should come from Vercel's Git integration instead of GitHub Actions SSH scripts.

## Admin Auth

Admin access is protected by Sign in with Vercel and only the exact email below is accepted server-side:

- `1forfunnn@gmail.com`

Write operations and blob uploads are authorized from the signed admin session cookie. There is no client-side admin password and no client-exposed admin token anymore.

## API Notes

The Vercel functions now include:

- `GET /api/tracks`
- `POST /api/tracks`
- `PATCH /api/tracks/:id`
- `DELETE /api/tracks/:id`
- `POST /api/tracks/reorder`
- `POST /api/tracks/:id/play`
- `POST /api/tracks/:id/vibe`
- `PUT /api/uploads/blob`

## Content Notes

The checked-in `music/` files are source assets for curation. The current app’s admin flow uploads tracks into blob/object storage rather than serving the local `music/` directory directly.

# TD Audio Player Backend (PHP)

## Overview
This backend provides a REST API for the Slughouse Records music player, running on Hostinger shared hosting with MySQL. It supports track uploads, listing, and deletion, and is designed for use with the React frontend.

## API Endpoints
### `GET /api/tracks`
Returns all tracks in the database.

### `POST /api/tracks`
Upload a new track (multipart/form-data, admin only).

### `DELETE /api/tracks/{id}`
Delete a track by ID (admin only).

### `GET /api/db-check.php`
Check database connectivity (returns JSON).

### `GET /db.test.php`
Standalone DB connection test (returns HTML).

## Configuration
Edit `api/config.php` with your Hostinger MySQL credentials:

```php
return [
   'DB_HOST' => 'srv995.hstgr.io',
   'DB_NAME' => 'your_db',
   'DB_USER' => 'your_user',
   'DB_PASS' => 'your_pass',
];

## Deployment
1. Push code to Hostinger Git repo.
2. Ensure all files are in `/public_html/playback/`.
3. Set correct credentials in `api/config.php`.
4. Test `/api/db-check.php` and `/db.test.php` in browser.

When deploying to Hostinger under `/playback`, the frontend assets and API are configured with the following defaults:

- Vite `base` is set to `/playback/` in `vite.config.ts` when NODE_ENV is `production`.
- The frontend will resolve API URLs to `/playback/api` by default unless `VITE_API_BASE_URL` is set.

If your Hostinger site is on a different subpath (not `/playback`), update `vite.config.ts` and `VITE_API_BASE_URL` accordingly before building the project.

## Troubleshooting

- If you see "Access denied" errors, check credentials and user permissions in Hostinger MySQL panel.
- If `/api/db-check.php` or `/db.test.php` return 404, check file presence and .htaccess rules.

## Security

- Do not expose real credentials in public repos.
- `.htaccess` handles CORS and API routing only.
- All backend scripts load credentials from `config.php`.

## License
MIT
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TD Audio Player - Slughouse Records

Private music vault for Slughouse Records. React + Vite front-end talks to a tiny Express API that lives on Hostinger. Tracks upload straight to your Hostinger file system, metadata lands in MySQL, and everyone who has the link streams from the same source.

**🎵 [View App in AI Studio](https://ai.studio/apps/drive/1Vl8Bvjxt2LIwSi1nkJfJpKPZ24zHs_b7)**

## ✨ Features

- 🔐 Password-protected library management
- ☁️ Hostinger-backed MySQL + file storage (no third-party APIs)
- 🔀 Shuffle & repeat modes (off/all/one)
- 🎨 Drag-and-drop queue reordering
- 💾 Persistent playback settings via localStorage
- 📱 Responsive mobile-first layout
- 🎵 Multipart upload with automatic file serving
- 🌙 Exclusive "Slughouse Records" aesthetic

## 🧱 Architecture

| Layer | Stack | Notes |
| --- | --- | --- |
| Frontend | React 19 + Vite + TypeScript | Lives in `/` – static deploy to Surge (`playback.slughouse`) |
| Backend | Express 4 + MySQL2 + Multer | Lives in `/server` – deploy to Hostinger VPS / Node hosting |
| Database | Hostinger MySQL | `tracks` table stores metadata + relative file path |
| Storage | Hostinger file uploads | API writes into `MEDIA_ROOT`, served via `MEDIA_BASE_URL` |

## 🚀 Quick Start (Local)

### 1. Dependencies

- **Node.js** 18+
- **MySQL** database (Hostinger panel works great)

### 2. Install packages

```bash
git clone <repo>
cd td-audio
npm install                 # frontend deps
npm install --prefix server # backend deps
```

### 3. Environment Variables

Frontend (`.env.local`):

```bash
cp .env.example .env.local
# Edit .env.local:
VITE_API_BASE_URL=http://localhost:4000
VITE_ADMIN_TOKEN=  # leave blank for dev
```

Storage & upload 💾

This project supports two upload flows:

- Presigned, direct-to-bucket (recommended): the frontend requests a presigned PUT URL from `/api/uploads/presign` (admin-only) and uploads the file directly to your object storage (S3 / R2 / Backblaze). After successful upload the client POSTs metadata to `/api/tracks` with `src` set to the public file URL.

- Server-side multipart upload (fallback): If presign is not configured, the frontend will upload the file to `/tracks` using multipart form data; server stores files on disk at `MEDIA_ROOT`.

Environment variables for presigned uploads:

- `S3_BUCKET` — bucket name
- `S3_REGION` — region (optional if `S3_ENDPOINT` is provided)
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — credentials
- `S3_ENDPOINT` — optional custom S3-compatible endpoint (e.g., R2 or Backblaze)
- `STORAGE_PUBLIC_BASE_URL` — optional base URL for public file URLs (e.g., https://cdn.example.com or https://bucket.s3.amazonaws.com)

Add these to your Vercel Production environment variables before deploying to enable presigned uploads.


Backend (`server/.env`):

```bash
cp server/.env.example server/.env
# Edit server/.env:
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=slughouse
MYSQL_USER=root
MYSQL_PASSWORD=secret
MEDIA_ROOT=/absolute/path/to/td-audio/server/uploads
MEDIA_BASE_URL=http://localhost:4000/media/
ALLOWED_ORIGINS=http://localhost:3000
PORT=4000
```

The server auto-creates `MEDIA_ROOT` if missing. For local dev, `MEDIA_BASE_URL` points to the Express static route.

### 4. Database Schema

```sql
CREATE TABLE tracks (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  audio_url TEXT NOT NULL,
  audio_path TEXT,
  cover_art TEXT,
  duration INT DEFAULT 0,
  added_at BIGINT NOT NULL
);
```

### 5. Run locally

```bash
npm run dev                  # frontend on http://localhost:3000
npm run dev --prefix server  # backend on http://localhost:4000
```

Upload a couple of MP3s from the admin panel—everyone hitting the dev URL shares the same playlist.

## 🌐 Hostinger Deployment

### Backend (Node.js on Hostinger)

1. **Provision MySQL** via hPanel → Databases → MySQL Databases
   - Note the host (e.g., `mysql1234.services.com`), database name, user, and password
   - Run the schema SQL (see step 4 in Quick Start)

2. **Create uploads directory** on the Hostinger filesystem
   ```bash
   mkdir -p /home/u792097907/uploads
   chmod 755 /home/u792097907/uploads
   ```
   Expose via HTTPS (e.g., `https://playback.slughouse/uploads/` mapped in Apache/Nginx config or Hostinger's static file settings).

3. **Deploy backend code**
   - Upload `/server` via Git, FTP, or File Manager
   - SSH into Hostinger and run:
     ```bash
     cd ~/server
     npm install --production
     ```
   - Create `server/.env` with production values (see `server/.env.example`)

4. **Keep backend running**
   - Use PM2: `pm2 start src/index.js --name slughouse-api`
   - Or systemd service if available
   - Verify health: `curl https://your-backend-url.com/health`

### Frontend (Surge or Static Host)

1. **Set production API URL**
   ```bash
   echo "VITE_API_BASE_URL=https://your-backend-url.com" > .env.local
   echo "VITE_ADMIN_TOKEN=your-shared-secret" >> .env.local  # optional
   ```

2. **Build and deploy**
   ```bash
   npm run build
   npx surge ./dist https://slughouse.surge.sh
   ```

3. **Test end-to-end**
   - Open `https://slughouse.surge.sh`
   - Upload a track from admin panel (password: `admin`)
   - Verify audio plays and all users see the same playlist

## 🛠️ API Surface

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/tracks` | Returns ordered playlist |
| `POST` | `/tracks` | Requires `multipart/form-data` (`file` + `id`, `title`, `artist`, etc.) |
| `DELETE` | `/tracks/:id` | Removes metadata + deletes the uploaded file |

Optional: set `ADMIN_TOKEN` on the server to require `x-admin-token` header. The frontend reads `VITE_ADMIN_TOKEN` and sends it automatically.

## 🎮 Usage

- Open the settings cog to access the admin modal (default password `admin`)
- Upload audio + metadata, reorder with drag handles, delete with the trash icon
- Player supports shuffle, repeat, keyboard shortcuts, and shareable invite links (footer button)

## 🏗️ Build Scripts

```bash
npm run build                 # frontend → dist/
npm run preview               # preview static build
npm run start --prefix server # start backend without file watching
```

## 🐛 Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Request failed` when uploading | Confirm `server/.env` values, ensure backend is reachable from the browser, and that `MEDIA_ROOT` is writable |
| Tracks appear but audio 404s | `MEDIA_BASE_URL` must point to a public URL that maps to `MEDIA_ROOT` (include trailing slash) |
| `Unauthorized` from API | Either remove `ADMIN_TOKEN` on the server or set the same value in `VITE_ADMIN_TOKEN` before building |
| Playlist empty | Check MySQL credentials + table schema, restart backend to see any connection errors in logs |
| Files not deleted | Ensure the backend process has permission to unlink files inside `MEDIA_ROOT` |

## 🤝 Contributing

1. Fork repo
2. `git checkout -b feature/something`
3. Commit + push + open PR

## 📝 License

MIT – feel free to adapt for your own private listening rooms.

## 🙏 Credits

- React + TypeScript + Vite
- Express & Multer for the API
- Lucide icons & Framer Motion for the vibe

---

**🏠 Slughouse Records** – *Keep it close*

# Migration Complete: Supabase → Hostinger MySQL + Express

## What Changed

### Backend (New)
✅ **Created Express API** in `/server`
- MySQL2 connection pool for Hostinger database
- Multer file upload handling
- Static file serving via `/media` route
- CORS + optional admin token auth
- Transaction-safe delete with file cleanup

### Frontend (Refactored)
✅ **Rewrote `services/storage.ts`** to call REST endpoints
- `saveTrack()` sends multipart form data to `POST /tracks`
- `getAllTracks()` fetches from `GET /tracks`
- `deleteTrack()` calls `DELETE /tracks/:id`
- Removed all Supabase client code

✅ **Updated `components/Admin.tsx`** upload flow
- Uses `FormData` for file + metadata
- Sends optional `x-admin-token` header
- Error messages reference backend, not Supabase

### Documentation
✅ **Updated README.md** with full Hostinger setup
✅ **Created HOSTINGER_DEPLOY.md** with step-by-step backend deployment
✅ **Updated env examples** (`.env.example`, `server/.env.example`)
✅ **Filled out reviewer agent** (`.github/agents/reviewer.agent.md`)

### Cleanup
✅ Removed `services/supabase.ts`
✅ Removed `@supabase/supabase-js` dependency (done earlier)
✅ Added `server/uploads` to `.gitignore`

## Deployment Status

### ✅ Frontend
- **URL**: https://playback.slughouse.com
- **Status**: Deployed successfully (343.4 KB, 3 files)
- **Build**: Vite production build with REST storage

### ⏳ Backend (Awaiting Hostinger Deployment)
- **Code**: Ready in `/server` directory
- **Dependencies**: Installed (`express`, `mysql2`, `multer`, `cors`, `dotenv`)
- **Instructions**: See `HOSTINGER_DEPLOY.md`

**Next Steps for Backend:**
1. SSH into Hostinger
2. Upload `/server` directory
3. Run MySQL schema creation
4. Configure `server/.env` with actual credentials
5. Start with PM2: `pm2 start src/index.js --name slughouse-api`
6. Verify: `curl http://localhost:4000/health`

## Environment Variables

### Frontend (`.env.local`)
```bash
VITE_API_BASE_URL=https://your-backend-url.com
VITE_ADMIN_TOKEN=optional-shared-secret
```

### Backend (`server/.env`)
```bash
MYSQL_HOST=mysql.services.com
MYSQL_DATABASE=u792097907_slughouse
MYSQL_USER=u792097907_tdv
MYSQL_PASSWORD=your-password
MEDIA_ROOT=/home/u792097907/uploads
MEDIA_BASE_URL=https://playback.slughouse.com/uploads/
ALLOWED_ORIGINS=https://playback.slughouse.com
ADMIN_TOKEN=optional-shared-secret
PORT=4000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/tracks` | Fetch all tracks |
| POST | `/tracks` | Upload track (multipart/form-data) |
| DELETE | `/tracks/:id` | Delete track + file |

## Database Schema

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

## Testing Checklist

Once backend is deployed:

- [ ] Frontend loads at https://playback.slughouse.com
- [ ] Admin panel accepts password (`admin`)
- [ ] Upload MP3 file with metadata
- [ ] Track appears in player queue
- [ ] Audio plays without 404
- [ ] Delete track removes file and DB entry
- [ ] Multiple browser sessions see same playlist
- [ ] CORS allows frontend to call backend

## Architecture Flow

```
User Browser
    ↓
https://playback.slughouse.com (Static React App)
    ↓
VITE_API_BASE_URL (Express API on Hostinger)
    ↓
MySQL Database ← stores metadata
    +
File System ← stores audio files
    ↓
MEDIA_BASE_URL (Public HTTPS URL)
    ↓
User Browser (streams audio)
```

## File Structure

```
td-audio/
├── server/                  # Backend API
│   ├── src/
│   │   └── index.js        # Express app
│   ├── package.json
│   └── .env.example
├── services/
│   └── storage.ts          # REST client
├── components/
│   ├── Admin.tsx           # Upload UI
│   └── Player.tsx          # Playback UI
├── .env.example            # Frontend env template
├── README.md               # Main documentation
├── HOSTINGER_DEPLOY.md     # Backend deployment guide
└── dist/                   # Built frontend (deployed to Surge)
```

## Migration Benefits

✅ **No third-party dependencies** - Fully self-hosted on Hostinger  
✅ **Cost control** - Use existing Hostinger resources  
✅ **Data ownership** - MySQL + files under your control  
✅ **Simpler architecture** - Single Express server, no external APIs  
✅ **Local development** - Works with localhost MySQL  

## Known Limitations

⚠️ **Frontend currently points to localhost** - Update `VITE_API_BASE_URL` and rebuild after backend deployment  
⚠️ **No authentication system** - Client-side password check only (`admin`)  
⚠️ **File uploads limited by `MAX_UPLOAD_BYTES`** - Default 25 MB  
⚠️ **No CDN for audio** - Files served directly from Hostinger  

## Rollback Plan

If issues arise, revert to Supabase:
1. Restore `services/supabase.ts` from git history
2. Install `@supabase/supabase-js`
3. Revert `services/storage.ts` to Supabase implementation
4. Rebuild and redeploy frontend

---

**Status**: Frontend deployed ✅ | Backend code ready ⏳ | Hostinger setup pending

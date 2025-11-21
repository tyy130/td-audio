# Deployment Status - playback.slughouse.com

## ✅ Completed

### Frontend
-- **URL**: https://playback.slughouse
- **Status**: ✅ Live and deployed (343.4 KB)
- **Build**: Production-ready Vite bundle
- **Storage Service**: Points to REST API (with localhost fallback for dev)

### Backend Code
- **Location**: `/server` directory in repo
- **Dependencies**: Installed and ready
- **Stack**: Express + MySQL2 + Multer + CORS
- **Endpoints**: 
  - `GET /health` - Health check
  - `GET /tracks` - List all tracks
  - `POST /tracks` - Upload track (requires admin token if configured)
  - `DELETE /tracks/:id` - Delete track (requires admin token if configured)

### Documentation
- ✅ `HOSTINGER_DEPLOY.md` - Complete backend deployment guide
- ✅ `server/.env.example` - Backend environment template
- ✅ `.env.example` - Frontend environment template
- ✅ `README.md` - Updated with new architecture
- ✅ `.github/copilot-instructions.md` - AI context updated

## ⏳ Remaining Tasks (Hostinger Side)

### 1. Deploy Backend to Hostinger

Follow `HOSTINGER_DEPLOY.md`:

1. **SSH into your Hostinger server**
2. **Upload `/server` directory**
   ```bash
   scp -r server/* user@slughouse.com:~/slughouse-api/
   ```

3. **Create `.env` file** with your actual credentials:
   ```bash
   cd ~/slughouse-api
   nano .env
   ```
   
   Paste (with your real values):
   ```env
   MYSQL_HOST=your-mysql-host.mysql.services.com
   MYSQL_PORT=3306
   MYSQL_DATABASE=u792097907_slughouse
   MYSQL_USER=u792097907_tdv
   MYSQL_PASSWORD=your-actual-password
   MYSQL_CONN_LIMIT=10
   
   PORT=4000
   
   ALLOWED_ORIGINS=https://playback.slughouse.com,http://localhost:3000
   
   ADMIN_TOKEN=your-shared-secret-123
   
   MEDIA_ROOT=/home/u792097907/uploads
   MEDIA_BASE_URL=https://playback.slughouse.com/uploads/
   MAX_UPLOAD_BYTES=26214400
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Run the backend**:
   ```bash
   # For testing
   npm run dev
   
   # For production (use PM2 or systemd)
   pm2 start src/index.js --name slughouse-api
   pm2 save
   pm2 startup
   ```

6. **Test the API**:
   ```bash
   curl http://localhost:4000/health
   # Should return: {"status":"ok"}
   ```

### 2. Configure Domain/Reverse Proxy

You have two options:

#### Option A: Subdomain (Recommended)
Point `api.playback.slughouse.com` to your backend:
- Add A record or configure reverse proxy in Hostinger panel
- Update frontend `.env.local`:
  ```env
  VITE_API_BASE_URL=https://api.playback.slughouse.com
  ```

#### Option B: Same Domain Path
Serve backend at `https://playback.slughouse.com/api`:
- Configure Apache/Nginx reverse proxy
- Update frontend `.env.local`:
  ```env
  VITE_API_BASE_URL=https://playback.slughouse.com/api
  ```

### 3. Expose Uploads Directory

Make `/home/u792097907/uploads` accessible via HTTPS:

**Option A: Hostinger File Manager**
- Configure static file mapping in hPanel to serve uploads at `/uploads`

**Option B: Apache/Nginx**
Add to your vhost config:
```apache
Alias /uploads /home/u792097907/uploads
<Directory /home/u792097907/uploads>
    Require all granted
</Directory>
```

### 4. Test End-to-End

Once backend is running:

1. ✅ Visit https://playback.slughouse.com
2. ✅ Click Settings (gear icon)
3. ✅ Enter password: `admin`
4. ✅ Upload an MP3 file with title/artist
5. ✅ Return to player - track should appear in queue
6. ✅ Click play - audio should stream
7. ✅ Test delete - track should be removed

### 5. Update Frontend API URL (Production)

Once backend is live at a public URL:

1. Create `.env.local` in repo root:
   ```env
   VITE_API_BASE_URL=https://api.playback.slughouse.com
   VITE_ADMIN_TOKEN=your-shared-secret-123
   ```

2. Rebuild and redeploy:
   ```bash
   npm run build
   npx surge ./dist https://playback.slughouse.com
   ```

## Current State

### What Works Now
- ✅ Frontend loads at playback.slughouse.com
- ✅ Player UI fully functional (no tracks yet)
- ✅ Admin panel accessible with password
- ⏳ **Backend needs deployment to actually upload/store tracks**

### What's Blocked
- ❌ Track uploads (needs backend API running)
- ❌ Track playback (needs backend + file storage)
- ❌ Multi-user sync (needs backend database)

## Files You Need

All backend code is ready in the repo at:
- `/server/src/index.js` - Express server
- `/server/package.json` - Dependencies
- `/server/.env.example` - Config template

## Quick Reference

### Local Development
```bash
# Frontend (port 3000)
npm run dev

# Backend (port 4000)
cd server && npm run dev
```

### Production URLs
-- **Frontend**: https://playback.slughouse (✅ deployed)
-- **Backend**: https://api.playback.slughouse (⏳ pending)
- **Uploads**: https://playback.slughouse.com/uploads/ (⏳ pending)

## Next Step

**Deploy the backend to Hostinger** following `HOSTINGER_DEPLOY.md` and you'll have a fully functional shared music player! 🎵

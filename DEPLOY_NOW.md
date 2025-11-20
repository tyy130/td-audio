# 🚀 DEPLOY TO YOUR HOSTINGER - Step by Step

Based on your screenshots, here's exactly what to do:

## ✅ Step 1: Database (2 minutes)

1. Open **hPanel** → **Databases** → **Management**
2. You already have database `u792097907_slughouse` with user `u792097907_tdv` ✓
3. Click **Enter phpMyAdmin**
4. Select database on left
5. Click **SQL** tab
6. Paste this and click **Go**:

```sql
CREATE TABLE IF NOT EXISTS tracks (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  audio_url TEXT NOT NULL,
  audio_path TEXT,
  cover_art TEXT,
  duration INT DEFAULT 0,
  added_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## ✅ Step 2: Upload Backend (3 minutes)

### Using File Manager (from your screenshot):

1. Open **File Manager** in hPanel
2. Navigate to `/public_html/playback/` (I can see this folder exists! ✓)
3. Click **New Folder** → Name it: `api`
4. Click **New Folder** → Name it: `uploads`
5. Select `uploads` folder → Right-click → **Permissions** → Set to `755`
6. Go into `api` folder
7. Click **Upload Files** → Upload `php-backend/index.php`
8. Right-click `index.php` → **Edit**
9. Find line 15 and change:
   ```php
   define('DB_PASS', 'YOUR_PASSWORD_HERE');
   ```
   To your actual MySQL password (from Databases panel)
10. Click **Save**

## ✅ Step 3: Test Backend (30 seconds)

Open in browser:
```
https://playback.slughouse.com/api/health
```

Should see:
```json
{"status":"ok"}
```

If you see that, backend is working! 🎉

## ✅ Step 4: Update Frontend (2 minutes)

In your codespace terminal:

```bash
# Create env file
cat > .env.local << 'EOF'
VITE_API_BASE_URL=https://playback.slughouse.com/api
EOF

# Rebuild
npm run build

# Redeploy
npx surge ./dist https://playback.slughouse.com
```

## ✅ Step 5: Test End-to-End (1 minute)

1. Visit https://playback.slughouse.com
2. Click **Settings** icon (gear)
3. Enter password: `admin`
4. Click **Add New Track**
5. Fill in title/artist
6. Select MP3 file
7. Click **Add to Library**
8. Go back to player
9. Click **Play** ▶️

If music plays, YOU'RE DONE! 🎵

## Troubleshooting

### "Database connection failed"
- Check password in `/public_html/playback/api/index.php` line 15
- Verify database exists in phpMyAdmin

### "Upload failed"
- Check `/public_html/playback/uploads` permissions: 755 or 777
- Check PHP upload limits in hPanel → **Select PHP Options**

### CORS errors
- Verify API returns correct headers (check browser console)
- Frontend must be at `https://playback.slughouse.com` (not localhost)

## Your Current Setup (from screenshots)

✅ SSH: 145.223.106.232:65002  
✅ MySQL: srv995.hstgr.io  
✅ Database: u792097907_slughouse  
✅ User: u792097907_tdv  
✅ Domain: playback.slughouse.com  
✅ File Manager access ✓  

## File Structure After Deployment

```
/public_html/playback/
├── api/
│   └── index.php          ← Backend API (UPDATE PASSWORD!)
├── uploads/               ← Audio files (755 permissions)
├── index.html             ← React app (from Surge)
└── assets/
    └── *.js               ← React bundles
```

## Need Help?

Check **Error Logs** in hPanel → **Advanced** → **Error Logs**

---

**That's it! Total time: ~8 minutes. Everything runs on your Hostinger shared hosting!** 🚀

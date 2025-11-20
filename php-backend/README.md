# Deploy PHP Backend to Hostinger Shared Hosting

## Quick Start (Use File Manager - Easiest!)

1. **Open File Manager** in hPanel
2. Navigate to `/public_html/playback/`
3. Create folder: **`api`**
4. Upload `php-backend/index.php` to `/public_html/playback/api/`
5. Click **Edit** on `index.php`, change line 15:
   ```php
   define('DB_PASS', 'your-actual-mysql-password');
   ```
6. Create folder: **`uploads`** (permissions: 755)
7. Test: https://playback.slughouse.com/api/health

## Database Setup

In phpMyAdmin (Hostinger → Databases → Management → phpMyAdmin):

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

## Update Frontend

Create `.env.local`:
```env
VITE_API_BASE_URL=https://playback.slughouse.com/api
```

Rebuild:
```bash
npm run build
npx surge ./dist https://playback.slughouse.com
```

## Done!

Your app is now fully hosted on Hostinger shared hosting - no external services needed! 🎉

# API Folder (Hostinger)

This folder contains the PHP backend meant to be deployed to `/public_html/playback/api` on Hostinger shared hosting. Files included:

- `index.php` - the API endpoints (health, tracks CRUD)
- `db-check.php` - simple DB verification tool
- `.env.example` - sample environment variables

Set environment variables via `.htaccess` or Hostinger control panel:

```
SetEnv DB_HOST srv995.hstgr.io
SetEnv DB_NAME u792097907_slug_dev
SetEnv DB_USER u792097907_slug_user
SetEnv DB_PASS QYw?A#bOQnS
SetEnv ADMIN_TOKEN your-secret
SetEnv MEDIA_BASE_URL https://playback.slughouse.com/uploads/
```

After Hostinger Git deploys the repo, confirm:

```
https://playback.slughouse.com/api/health
https://playback.slughouse.com/api/db-check.php
```


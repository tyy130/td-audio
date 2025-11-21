# Backend Deployment to Hostinger

## Prerequisites
- Hostinger hosting account with Node.js support
- SSH access to your Hostinger server
- MySQL database provisioned via hPanel

## Step-by-Step Deployment

### 1. Database Setup

Log into hPanel → Databases → MySQL Databases and run this schema:

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

Note your:
- MySQL host (e.g., `mysql1234.services.com`)
- Database name (e.g., `u792097907_slughouse`)
- Username (e.g., `u792097907_tdv`)
- Password

### 2. Create Uploads Directory

SSH into Hostinger:

```bash
ssh u792097907@yourdomain.com
mkdir -p ~/uploads
chmod 755 ~/uploads
```

Configure your web server (Apache/Nginx) or Hostinger's static file mapping to serve `~/uploads` at a public URL like `https://slughouse.com/uploads/`.

### 3. Upload Backend Code

Option A: **Git** (recommended)
```bash
cd ~
git clone https://github.com/tyy130/td-audio.git
cd td-audio/server
npm install --production
```

Option B: **FTP/File Manager**
- Zip the `/server` directory locally
- Upload via hPanel File Manager
- Unzip on the server
- Run `npm install --production` via SSH

### 4. Configure Environment

Create `server/.env` with your production values:

```bash
nano ~/td-audio/server/.env
```

Paste (adjust values):

```dotenv
MYSQL_HOST=mysql1234.services.com
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

Save and exit (Ctrl+X, Y, Enter).

### Secrets management (VERY IMPORTANT)

- **Do not commit** `api/config.php` to Git. This file contains live DB credentials and must be kept out of the repository.
- Keep `api/config.example.php` in the repo as a template; never include actual secrets in example files.
- On the server, create `api/config.php` from the example and fill in production credentials:

```bash
cp api/config.example.php api/config.php
nano api/config.php # update credentials
```
- If credentials were committed to Git history, **rotate the credentials** in the Hostinger dashboard immediately.
- If you need to remove secrets from Git history, use `git filter-repo` or BFG and then force push — but this rewrites history and will affect forks and PRs.

### 5. Start the Server

#### Using PM2 (recommended for persistence):

```bash
npm install -g pm2
cd ~/td-audio/server
pm2 start src/index.js --name slughouse-api
pm2 save
pm2 startup  # follow instructions to enable startup on reboot
```

#### Using Node directly:

```bash
cd ~/td-audio/server
nohup node src/index.js > api.log 2>&1 &
```

### 6. Verify Health

```bash
curl http://localhost:4000/health
# Should return: {"status":"ok"}
```

If you've configured a reverse proxy to expose port 4000 publicly:

```bash
curl https://your-backend-url.com/health
```

### 7. Configure Reverse Proxy (Optional)

If you want `https://api.playback.slughouse.com` to point to your backend:

**Apache** (`.htaccess` or VirtualHost):
```apache
ProxyPass /api http://localhost:4000
ProxyPassReverse /api http://localhost:4000
```

**Nginx**:
```nginx
location /api {
  proxy_pass http://localhost:4000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

Or use Hostinger's Node.js app hosting if available (configure via hPanel).

### 8. Monitor Logs

```bash
pm2 logs slughouse-api
# or
tail -f ~/td-audio/server/api.log
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Change `PORT` in `.env` or kill existing process |
| MySQL connection refused | Check `MYSQL_HOST` and firewall rules |
| File upload fails | Verify `MEDIA_ROOT` permissions (chmod 755) |
| CORS errors | Add frontend URL to `ALLOWED_ORIGINS` |
| 502 Bad Gateway | Ensure Node process is running (`pm2 status`) |
### Deployment failure: "untracked files would be overwritten"

If Hostinger's Git deploy runs `git pull` and fails with an error like:

```
pull: error: The following untracked working tree files would be overwritten by merge:
  db.test.php
Please move or remove them before you merge.
Aborting
```

This happens when the remote file is untracked but the repo now contains a tracked file with the same name. To resolve:

1. SSH into your Hostinger server and move or backup the untracked files before pulling:

```bash
ssh u792097907@<HOST>
cd /home/u792097907/domains/slughouse.com/public_html/playback
mkdir -p ~/playback_backup/$(date +%Y%m%d%H%M%S)
mv db.test.php ~/playback_backup/$(date +%Y%m%d%H%M%S)/
git pull origin main
```

2. Safer automated approach (recommended): Use rsync-based deployment in CI (GitHub Actions) instead of Hostinger's Git deploy to avoid many `git pull` conflicts. See `GITHUB_ACTIONS_SETUP.md` for details.

3. If you need to preserve server local changes that you do not want to be overwritten, move them into a separate filename `db.test.local.php` and add that pattern to `.gitignore` to prevent conflicts.

4. If you need to clean *all* untracked files on the server before pulling (risky), you can run:

```bash
# Be careful - this deletes untracked files permanently!
git clean -fd
git pull origin main
```

Alternatively, run the helper script `scripts/host_cleanup.sh` from the server to safely back up untracked files and reset to `origin/main` (see the repo `scripts/` directory).


## Updating Code
## Frontend (Vite) Deployment (Static)

1. Build locally or in CI:

```bash
npm ci
npm run build
```

2. Copy `dist` to Hostinger (to be served by the `playback` subdomain). Example using `rsync`:

```bash
rsync -avz --delete dist/ u792097907@ssh.hostinger.com:/home/u792097907/domains/slughouse.com/public_html/playback/
```

3. Copy PHP API files (do not overwrite `config.php` which contains DB credentials). Example:

```bash
rsync -avz --exclude 'config.php' api/ u792097907@ssh.hostinger.com:/home/u792097907/domains/slughouse.com/public_html/playback/api/
```

4. Set the playback subdomain `playback.slughouse.com` root path in Hostinger to `/public_html/playback` if you want the app to be hosted at `https://playback.slughouse.com/` (recommended).

5. Verify the site:

```bash
curl -I https://playback.slughouse.com/
curl -I https://playback.slughouse.com/api/health
```

6. If the frontend shows a blank page, check that `index.html` path references the correct asset path (via `VITE_BASE_URL` or `vite.config.ts` base setting). Typical fix: set Vite base to `'/'` for subdomain root deployments.


```bash
cd ~/td-audio
git pull origin main
cd server
npm install --production
pm2 restart slughouse-api
```

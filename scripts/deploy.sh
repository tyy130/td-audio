#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy.sh <remote-host> <remote-user> <remote-path> [ssh-port]
# Example: ./scripts/deploy.sh example.hostinger.com u792097907 /home/u792097907/domains/slughouse.com/public_html/playback 22

HOST=${1:?Host required}
USER=${2:?User required}
REMOTE_PATH=${3:?Remote path required}
PORT=${4:-22}

echo "Building project..."
npm ci --silent
npm run build --silent

echo "Syncing built files to $USER@$HOST:$REMOTE_PATH"
# Upload dist contents to remote playback root
rsync -avz --delete -e "ssh -p $PORT -o StrictHostKeyChecking=no" dist/ "$USER@$HOST:$REMOTE_PATH/"

# Upload API PHP files (exclude config.php) so we don't overwrite credentials
rsync -avz -e "ssh -p $PORT -o StrictHostKeyChecking=no" --exclude 'config.php' api/ "$USER@$HOST:$REMOTE_PATH/api/"

# Ensure proper permissions on remote files
ssh -p $PORT -o StrictHostKeyChecking=no "$USER@$HOST" "chmod -R 755 '$REMOTE_PATH' || true"

echo "Deployment complete. Verify playback at: https://playback.slughouse.com/"

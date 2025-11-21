#!/usr/bin/env bash
set -euo pipefail

# host_cleanup.sh
# Use on the Hostinger server when `git pull` aborts because of untracked files.
# This script moves all untracked files into a timestamped backup directory, then pulls latest code.

REPO_ROOT=${1:-/home/u792097907/domains/slughouse.com/public_html/playback}
BACKUP_DIR=~/playback_backup/$(date +%Y%m%d%H%M%S)

echo "Repo: $REPO_ROOT"

if [ ! -d "$REPO_ROOT" ]; then
  echo "ERROR: Repo root does not exist: $REPO_ROOT"
  exit 1
fi

cd "$REPO_ROOT"

# Ensure a safe place to backup.
mkdir -p "$BACKUP_DIR"

# List untracked files. Use git ls-files to find 'others'. Move them if any.
UNTRACKED=$(git ls-files --others --exclude-standard)
if [ -z "$UNTRACKED" ]; then
  echo "No untracked files to move — proceeding to git pull"
else
  echo "Backing up untracked files to $BACKUP_DIR"
  # Move each untracked file to the backup directory, keeping relative path structure
  while IFS= read -r file; do
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    mv -- "$file" "$BACKUP_DIR/$file"
  done <<< "$UNTRACKED"
  echo "Backed up untracked files:"
  ls -la "$BACKUP_DIR"
fi

# Optionally, stash local changes (only tracked files)
if ! git diff --quiet --exit-code || ! git diff --cached --quiet --exit-code; then
  echo "Tracked file changes detected. Stashing them before pull."
  git stash --include-untracked --message "pre-pull-$(date +%s)"
fi

# Fetch and reset to the remote main branch
git fetch --all --prune
# Ensure origin/main exists and is intended branch. You may change 'main' to your production branch.
git reset --hard origin/main

# Ensure correct permissions
chown -R $(whoami) . || true
chmod -R 755 . || true

# If you moved config.php or other files, make sure they exist in expected location
if [ -f "$BACKUP_DIR/api/config.php" ] && [ ! -f "api/config.php" ]; then
  echo "Preserving server config: copying backup config to api/config.php"
  cp "$BACKUP_DIR/api/config.php" api/config.php
  chmod 600 api/config.php
fi

echo "Git pull (reset to origin/main) completed successfully."

echo "If you want to restore a single specific file from the backup, you can use:`\n  mv $BACKUP_DIR/path/to/file $REPO_ROOT/path/to/file`"

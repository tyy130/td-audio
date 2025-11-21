#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy.sh <remote-host> <remote-user> <remote-path> [ssh-port] [--write-config] [--force]
# Example: ./scripts/deploy.sh example.hostinger.com u792097907 /home/u792097907/domains/slughouse/public_html/playback 22

# Parse options and positional args
WRITE_CONFIG=0
FORCE_WRITE=0
SKIP_BUILD=0
while [[ $# -gt 0 ]]; do
	case "$1" in
		--write-config)
			WRITE_CONFIG=1; shift;;
		--force)
			FORCE_WRITE=1; shift;;
		--skip-build)
			SKIP_BUILD=1; shift;;
		--)
			shift; break;;
		-*)
			echo "Unknown option: $1"; exit 1;;
		*)
			break;;
	esac
done

HOST=${1:?Host required}
USER=${2:?User required}
REMOTE_PATH=${3:?Remote path required}
PORT=${4:-22}

if [ "$SKIP_BUILD" -eq 0 ]; then
	echo "Building project..."
	npm ci --silent
	npm run build --silent
else
	echo "Skipping build (--skip-build passed)"
fi

echo "Syncing built files to $USER@$HOST:$REMOTE_PATH"
# Upload dist contents to remote playback root
rsync -avz --delete -e "ssh -p $PORT -o StrictHostKeyChecking=no" dist/ "$USER@$HOST:$REMOTE_PATH/"

# Upload API PHP files (exclude config.php) so we don't overwrite credentials
rsync -avz -e "ssh -p $PORT -o StrictHostKeyChecking=no" --exclude 'config.php' api/ "$USER@$HOST:$REMOTE_PATH/api/"

# Ensure proper permissions on remote files
ssh -p $PORT -o StrictHostKeyChecking=no "$USER@$HOST" "chmod -R 755 '$REMOTE_PATH' || true"

echo "Deployment complete. Verify playback at: https://playback.slughouse/"

if [ "$WRITE_CONFIG" -eq 1 ]; then
	echo "--write-config requested. Ensuring required environment variables are set..."
	# Required secrets for creating a server-side config file
	: "${HOSTINGER_DB_HOST:?HOSTINGER_DB_HOST environment variable required to write config}" 2>/dev/null || true
	if [ -z "${HOSTINGER_DB_HOST:-}" ] || [ -z "${HOSTINGER_DB_NAME:-}" ] || [ -z "${HOSTINGER_DB_USER:-}" ] || [ -z "${HOSTINGER_DB_PASS:-}" ]; then
		echo "ERROR: HOSTINGER_DB_HOST, HOSTINGER_DB_NAME, HOSTINGER_DB_USER and HOSTINGER_DB_PASS must be set in your environment to use --write-config" >&2
		exit 1
	fi

	TMP_CONFIG="tmp_api_config.php"
	echo "Creating temporary config file..."
	cat > "$TMP_CONFIG" <<EOF
<?php
return [
	'DB_HOST' => "${HOSTINGER_DB_HOST}",
	'DB_NAME' => "${HOSTINGER_DB_NAME}",
	'DB_USER' => "${HOSTINGER_DB_USER}",
	'DB_PASS' => "${HOSTINGER_DB_PASS}",
	'ADMIN_TOKEN' => "${HOSTINGER_ADMIN_TOKEN:-}",
];
EOF
	# Protect the local file
	chmod 600 "$TMP_CONFIG"

	echo "Uploading config to $USER@$HOST:$REMOTE_PATH/api/config.php (atomic)"
	# Use rsync to copy the file as a tmp file and move it on the server atomically; backup old config if present.
	rsync -avz -e "ssh -p $PORT -o StrictHostKeyChecking=no" "$TMP_CONFIG" "$USER@$HOST:$REMOTE_PATH/api/config.php.tmp"

	# If the remote config exists and --force wasn't passed, stop and ask the user to set --force
	if [ "$FORCE_WRITE" -ne 1 ]; then
		if ssh -p $PORT -o StrictHostKeyChecking=no "$USER@$HOST" "[ -f '$REMOTE_PATH/api/config.php' ]"; then
			echo "A config.php already exists on the remote host. Re-run with --force to overwrite (or remove the file manually)." >&2
			shred -u "$TMP_CONFIG" || rm -f "$TMP_CONFIG"
			exit 1
		fi
	fi

	echo "Running remote backup & atomic rename..."
	ssh -p $PORT -o StrictHostKeyChecking=no "$USER@$HOST" "mkdir -p '$REMOTE_PATH/api' && if [ -f '$REMOTE_PATH/api/config.php' ]; then mv '$REMOTE_PATH/api/config.php' '$REMOTE_PATH/api/config.php.bak.$(date +%s)'; fi && mv '$REMOTE_PATH/api/config.php.tmp' '$REMOTE_PATH/api/config.php' && chmod 600 '$REMOTE_PATH/api/config.php'"

	echo "Config upload complete; cleaning up local tmp file"
	shred -u "$TMP_CONFIG" || rm -f "$TMP_CONFIG"
fi

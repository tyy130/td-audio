#!/usr/bin/env bash
set -euo pipefail

# Small helper that creates api/config.php from api/config.example.php and prompts for values
EXAMPLE=api/config.example.php
DEST=api/config.php
if [ ! -f "$EXAMPLE" ]; then
  echo "$EXAMPLE not found. Aborting."
  exit 1
fi
cp "$EXAMPLE" "$DEST"

# Replace placeholders if any (none in example) - else the user should edit the file
if command -v sed >/dev/null 2>&1; then
  echo "Created $DEST; please edit it with real secrets:"
  echo "  nano $DEST"
else
  echo "Created $DEST; please edit it with real secrets and do not commit it."
fi

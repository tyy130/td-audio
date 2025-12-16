#!/usr/bin/env bash
set -euo pipefail

echo "This script helps set GitHub Actions secrets and Vercel Production environment variables."
echo "It requires the following CLIs installed and authenticated: gh (GitHub CLI) and vercel (Vercel CLI)."

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install and authenticate it first: https://cli.github.com/" >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI not found. Install and authenticate it first: https://vercel.com/docs/cli" >&2
  exit 1
fi

read -rp "GitHub repo slug (owner/repo) [${GITHUB_REPOSITORY:-}]: " REPO
REPO=${REPO:-${GITHUB_REPOSITORY:-}}
if [ -z "$REPO" ]; then
  echo "Repository slug is required (owner/repo)." >&2
  exit 1
fi

echo
echo "Step 1: GitHub Secrets"
read -rp "Enter Vercel token (VERCEL_TOKEN) [generate at https://vercel.com/account/tokens]: " VERCEL_TOKEN
read -rp "Enter SITE_URL (production URL, e.g., https://your-project.vercel.app): " SITE_URL

echo "Setting GitHub secrets..."
echo "$VERCEL_TOKEN" | gh secret set VERCEL_TOKEN --repo "$REPO" --body-file -
echo "$SITE_URL" | gh secret set SITE_URL --repo "$REPO" --body-file -

echo
echo "Step 2: Vercel Project & Env Vars"
read -rp "Vercel project name (as shown in Vercel dashboard): " VERCEL_PROJECT
if [ -z "$VERCEL_PROJECT" ]; then
  echo "Project name required" >&2; exit 1
fi

echo "Now we'll add the following Vercel Production env vars. Leave a value empty to skip."
vars=(DATABASE_URL S3_BUCKET S3_REGION S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY STORAGE_PUBLIC_BASE_URL ADMIN_TOKEN)
for v in "${vars[@]}"; do
  read -rp "Enter value for $v (or press Enter to skip): " val
  if [ -n "$val" ]; then
    # Add env var to Vercel using CLI; pass value via stdin to avoid exposing in history.
    printf "%s\n" "$val" | vercel env add "$v" production --yes --token "$VERCEL_TOKEN" >/dev/null 2>&1 || {
      echo "Failed to set $v via vercel CLI; trying via API..."
      # Try via Vercel API
      # Find project id
      PROJ_JSON=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v9/projects/$VERCEL_PROJECT") || true
      PROJECT_ID=$(echo "$PROJ_JSON" | grep -o '"id":"[^"]\+' | head -n1 | sed 's/"id":"//')
      if [ -z "$PROJECT_ID" ]; then
        echo "Could not determine project ID for $VERCEL_PROJECT. Set env var manually in Vercel dashboard." >&2
      else
        curl -s -X POST "https://api.vercel.com/v9/projects/$PROJECT_ID/env" \
          -H "Authorization: Bearer $VERCEL_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"key\": \"$v\", \"value\": \"$val\", \"target\": [\"production\"]}" >/dev/null
        echo "Set $v via Vercel API"
      fi
    } && echo "Set $v via vercel CLI"
  else
    echo "Skipped $v"
  fi
done

echo
echo "Step 3: Trigger deployment workflow"
read -rp "Trigger GitHub 'Deploy to Vercel and Smoke Test' workflow now? (y/N): " run_now
if [[ "$run_now" =~ ^[Yy]$ ]]; then
  gh workflow run deploy_and_smoke.yml --repo "$REPO"
  echo "Workflow dispatched. Check Actions in GitHub for progress.";
else
  echo "You can trigger the workflow later from Settings -> Actions -> Workflows or push to main.";
fi

echo "Setup script complete. Verify Vercel env vars and secrets in the web UIs if necessary."

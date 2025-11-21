# GitHub Actions Hostinger Deployment Setup

This guide helps you enable the GitHub Actions workflow that builds and deploys the frontend `dist/` and the PHP API to Hostinger via SSH + rsync.

## Required Secrets
Add the following secrets to the repository (Settings → Secrets → Actions):

- `HOSTINGER_SSH_PRIVATE_KEY` — SSH private key for the host user (for example `u792097907@ssh.hostinger.com`). This must be the private key (no passphrase is preferred for automation).
- `HOSTINGER_HOST` — The SSH host (e.g., `ssh.hostinger.com` or the IP address).
- `HOSTINGER_USER` — The SSH username (e.g., `u792097907`).
- `HOSTINGER_REMOTE_PATH` — The remote directory where your `playback` site is hosted (e.g., `/home/u792097907/domains/slughouse/public_html/playback`).
- `HOSTINGER_PORT` — The SSH port (optional; default `22`).
 - `PLAYBACK_SITE_URL` — The site URL for verification (e.g., `https://playback.slughouse`).
- `VITE_BASE_URL` — Optional: set to `/playback/` if you deploy to a sub-path; otherwise keep blank to use `/`.

Optional secrets for automated server-side config creation
- `HOSTINGER_DB_HOST` — Database host for the API (e.g., `srv995.hstgr.io`).
- `HOSTINGER_DB_NAME` — Database name for the API.
- `HOSTINGER_DB_USER` — Database user used by the API.
- `HOSTINGER_DB_PASS` — Database password for the API user.

If you set the `HOSTINGER_DB_PASS` secret, the workflow will create `api/config.php` on the host at deploy time using these secrets (the workflow will still exclude `api/config.php` from the repo). If you prefer manual control, do not add these secrets and instead create `api/config.php` manually directly on the server (see `HOSTINGER_DEPLOY.md`).

If you'd like to use the `scripts/deploy.sh` helper to write server-side config, use the `--write-config` flag and in CI pass the DB secrets as env variables to the step. Example step (calls the script and safely writes `api/config.php` to the host):

```yaml
- name: Deploy and write config (optional)
	if: ${{ secrets.HOSTINGER_DB_PASS }}
	env:
		HOST: ${{ secrets.HOSTINGER_HOST }}
		USER: ${{ secrets.HOSTINGER_USER }}
		REMOTE_PATH: ${{ secrets.HOSTINGER_REMOTE_PATH }}
		PORT: ${{ secrets.HOSTINGER_PORT }}
		HOSTINGER_DB_HOST: ${{ secrets.HOSTINGER_DB_HOST }}
		HOSTINGER_DB_NAME: ${{ secrets.HOSTINGER_DB_NAME }}
		HOSTINGER_DB_USER: ${{ secrets.HOSTINGER_DB_USER }}
		HOSTINGER_DB_PASS: ${{ secrets.HOSTINGER_DB_PASS }}
		HOSTINGER_ADMIN_TOKEN: ${{ secrets.HOSTINGER_ADMIN_TOKEN }}
	run: |
		./scripts/deploy.sh "${{ secrets.HOSTINGER_HOST }}" "${{ secrets.HOSTINGER_USER }}" "${{ secrets.HOSTINGER_REMOTE_PATH }}" "${{ secrets.HOSTINGER_PORT }}" --write-config --force
```

Note: The `--force` option forces overwriting a potentially-existing `api/config.php` file. It's recommended to rotate secrets (DB or admin) before enabling this, and restrict the scope of the `HOSTINGER_SSH_PRIVATE_KEY` to the deployment user to reduce blast radius.

## Creating an SSH key (if needed)
If you don't already have an SSH key for automated deployments, generate one and add the public key to Hostinger's SSH keys in hPanel.

```bash
ssh-keygen -t rsa -b 4096 -C "deploy@slughouse" -f ~/.ssh/slughouse-deploy -N ""
# Copy the public key to Hostinger's hPanel -> SSH Access -> Add Key
cat ~/.ssh/slughouse-deploy.pub
```

Then add the private key contents to `HOSTINGER_SSH_PRIVATE_KEY` secret in GitHub.

## Steps to add secrets
1. Go to your GitHub repository → Settings → Secrets → Actions → New repository secret.
2. Enter the name (one of the keys above) and paste the secret value.
3. Save each secret.

## Trigger the workflow
- The workflow runs automatically when you push to `main`.
- To test manually, trigger a push to `main` or use the GitHub UI in the ``Actions`` tab to run the workflow.

## Secrets & server-side config

- **Do not commit** `api/config.php` to the repository; the workflow intentionally excludes this file. Instead keep credentials on the server-side only.
- Create a server-side `api/config.php` based on `api/config.example.php` and update credentials on the host.
- If credentials were checked into the repository previously, rotate database credentials in Hostinger hPanel immediately.

## Post-setup checks
- Verify the site is listening by visiting `PLAYBACK_SITE_URL` in a browser.
- Verify the `api/health` endpoint is responding with `200`.

## Security Notes
- Do not commit `config.php` (with live DB credentials) to the public repo. Keep it on the server.
- Keep the SSH private key secret, only set as a GitHub secret.

---

If you want, I can add an optional step to the workflow to notify you (via Slack or email) when the deployment succeeds/fails. Let me know which notification method you'd prefer and I can add it.
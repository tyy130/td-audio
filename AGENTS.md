# Repository Guidelines

## Layout
Root-level Vite app (no `src/`): `App.tsx`, `index.tsx`, `components/`, `hooks/`, `services/`. Serverless API in `api/` (plain JS, Vercel Functions). One-off scripts in `scripts/`. See README for a file map.

## Commands
- `npx vercel dev`: app + API locally
- `npx tsc --noEmit`: typecheck (CI gate)
- `npm run build`: production build (CI gate)

## Style
- TypeScript + React function components, 2-space indent, double quotes in TSX.
- Tailwind v3 compiled at build time (`tailwind.config.js`). Brand tokens: `ink`, `dim`, `line`, `panel`, `acid`, `surface`. Don't name a color `base`: it collides with the `text-base` font size.
- Use `focusRing` and the helpers in `components/ui.ts` for new controls.
- Keep anything only the Vault needs out of the listener bundle (import it from `Admin.tsx` or lazy-load it).

## Playback rules worth knowing
- On touch devices the audio element must never go through Web Audio (`createMediaElementSource`), or playback dies when the screen locks. `hooks/useAudio.ts` handles this. Don't remove that check.
- Media Session handlers in `Player.tsx` drive lock-screen controls.

## Commits and PRs
Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). `main` deploys to production, so work on a branch and open a PR. Include screenshots for UI changes.

## Hygiene
No secrets or `.env*` files in git (except `.env.example`). Mock the API in tests; never point local test runs at the production database.

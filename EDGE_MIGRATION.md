# Edge Migration Notes

This project now supports reading non-secret config from Vercel Edge Config and connecting to a serverless Postgres (Neon) from Edge Functions.

Key points:
- Use Vercel **Environment Variables** (or GitHub Secrets) for sensitive values such as `DATABASE_URL`.
- Use **Edge Config** for public/non-secret values (feature flags, media base URL).
- The `edge-functions/` directory contains sample edge function `tracks.ts` that queries Neon via `@neondatabase/serverless`.
- Add `HOSTING` specific configuration in `vercel.json` to route `/api/*` to edge-function equivalents if you deploy to Vercel.

See `services/db-neon.ts` and `services/edgeConfig.ts` for usage examples.

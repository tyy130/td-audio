<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Vl8Bvjxt2LIwSi1nkJfJpKPZ24zHs_b7

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Duplicate `.env.example` (or create `.env.local`) and add your Supabase credentials:
   ```bash
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=public-anon-key
   VITE_SUPABASE_BUCKET=tracks # optional, defaults to "tracks"
   VITE_SUPABASE_TABLE=tracks  # optional, defaults to "tracks"
   ```
3. Run the app:
   `npm run dev`

## Supabase setup

1. Create a Supabase project and grab the project URL + anon key.
2. Storage → create a **public** bucket named `tracks` (or any name that matches `VITE_SUPABASE_BUCKET`).
3. Table editor → create a table called `tracks` with the following columns:
   - `id` (uuid/text) primary key
   - `title` (text)
   - `artist` (text)
   - `audio_url` (text)
   - `storage_path` (text)
   - `cover_art` (text, nullable)
   - `duration` (integer, nullable)
   - `added_at` (bigint, stores epoch milliseconds)
4. Grant `insert/select/delete` on the `tracks` table and `upload/delete` on the bucket to the `anon` role.
5. Restart `npm run dev` after updating environment variables.

Once configured, any track uploaded via the admin panel is stored in Supabase storage and new visitors with the link will immediately see and play the shared tracks.

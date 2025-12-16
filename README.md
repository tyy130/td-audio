<div align="center">
<img width="1200" height="475" alt="Slughouse Records" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Slughouse Records

**Private music vault** – React + Vite frontend with Vercel serverless API and Neon Postgres.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/your-repo/td-audio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## ✨ Features

- 🔐 Password-protected library management
- ☁️ Vercel serverless + Neon Postgres
- 📤 S3-compatible presigned uploads
- 🔀 Shuffle & repeat modes (off / all / one)
- 🎨 Drag-and-drop queue reordering
- 💾 Persistent playback settings
- 📱 Mobile-first responsive design
- 🎵 Exclusive "Slughouse Records" aesthetic

## 🧱 Architecture

| Layer | Stack |
| --- | --- |
| Frontend | React 19 + Vite + TypeScript + Tailwind |
| Backend | Vercel Serverless Functions (Node.js 18) |
| Database | Neon Serverless Postgres |
| Storage | S3-compatible (presigned PUT uploads) |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Neon database ([neon.tech](https://neon.tech))
- S3-compatible storage (R2, Backblaze, etc.)

### Environment Variables

Create `.env.local`:

```bash
# Frontend
VITE_API_BASE_URL=http://localhost:3000/api

# Backend (set in Vercel dashboard)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
S3_BUCKET=your-bucket
S3_REGION=auto
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
```

### Local Development

```bash
npm install
npm run dev          # Frontend on :5173
vercel dev           # API functions on :3000
```

### Deploy to Production

```bash
vercel --prod
```

## 📁 Project Structure

```
├── api/                  # Vercel serverless functions
│   ├── health.js         # Health check endpoint
│   ├── tracks/index.js   # Track CRUD operations
│   └── uploads/presign.js# Presigned upload URLs
├── components/           # React components
├── hooks/                # Custom React hooks
├── services/             # API client services
├── App.tsx               # Main application
└── schema.sql            # Database schema
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/tracks` | List all tracks |
| POST | `/api/tracks` | Create track (admin) |
| DELETE | `/api/tracks?id={id}` | Delete track (admin) |
| POST | `/api/uploads/presign` | Get presigned upload URL |

## 📄 License

MIT © 2024

---

<div align="center">

**Made by [Tyler Hill](https://tacticdev.com)**

</div>

import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use VITE_BASE_URL env var to allow deploying to a sub-path if needed (default '/').
const basePath = process.env.NODE_ENV === 'production' ? (process.env.VITE_BASE_URL || '/') : '/';

export default defineConfig({
  base: basePath,
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});

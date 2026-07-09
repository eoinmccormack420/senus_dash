import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Railway's build for the backend service only includes the
    // assiduous_dash/ subtree (confirmed via a deploy log showing
    // WhiteNoise couldn't find a sibling directory) — so the build
    // has to land INSIDE assiduous_dash/ to actually be part of the
    // deployed image, not next to it.
    outDir: '../assiduous_dash/frontend_dist',
    emptyOutDir: true,
  },
  server: {
    // Backend is same-origin in production (Django serves this build
    // directly — see assiduous_dash/urls.py), so the API client just
    // uses relative "/api" paths with no env var needed. This proxy
    // makes that same relative path work in local dev too, where the
    // frontend (5173) and Django (8000) are actually separate origins.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})

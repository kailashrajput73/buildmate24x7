import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, /api and /files are proxied to the .NET API so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:5080', changeOrigin: true },
      '/files': { target: process.env.VITE_API_PROXY ?? 'http://localhost:5080', changeOrigin: true },
    },
  },
})

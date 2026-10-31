import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, /api and /files are proxied to the .NET API so no CORS setup is needed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = process.env.VITE_API_PROXY ?? env.VITE_API_PROXY ?? 'http://localhost:5080'
  return {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/files': { target, changeOrigin: true },
    },
  },
  }
})

/** @type {import('next').NextConfig} */
const API = process.env.API_URL ?? 'http://localhost:5080'

const nextConfig = {
  reactStrictMode: true,
  // Isolated local verification builds can coexist with the running development server.
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // The design kit is styled with styled-components (SSR via app/registry.tsx).
  compiler: { styledComponents: true },
  // Browser calls go to /api and /files on this origin and are proxied to the .NET API (no CORS needed).
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/files/:path*', destination: `${API}/files/:path*` },
    ]
  },
  images: { unoptimized: true },
}
export default nextConfig

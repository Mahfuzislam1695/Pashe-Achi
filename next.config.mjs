/**
 * The pages (customer site at /, admin panel at /admin). They are served by the NestJS server in
 * src/server/main.ts on the same port as the API, so there is no separate `next dev` or `next start`.
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // This folder is the project root (its package-lock.json), even if a parent folder has a lockfile.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  // The phone version that lived under /app is now the Kingfisher app (mobile/). Its old links,
  // home-screen shortcuts and notifications open the same page here (/app/orders/12 → /orders/12).
  // /app-download is a different path and is not matched.
  async redirects() {
    return [
      { source: '/app', destination: '/home', permanent: true },
      { source: '/app/:path+', destination: '/:path+', permanent: true },
      // The APK's old address: the API now serves the one uploaded on /admin/system, or this bundled file.
      { source: '/downloads/kingfisher.apk', destination: '/api/v1/app/apk', permanent: false },
    ]
  },
  // The push notification worker (public/sw.js): always fetched fresh, and it may load nothing else.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
  experimental: {
    // The customer site and the admin panel have separate root layouts, so unknown URLs are
    // answered by src/app/global-not-found.tsx.
    globalNotFound: true,
  },
}

export default nextConfig

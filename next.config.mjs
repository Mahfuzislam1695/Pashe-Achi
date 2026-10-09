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
  experimental: {
    // The customer site and the admin panel have separate root layouts, so unknown URLs are
    // answered by src/app/global-not-found.tsx.
    globalNotFound: true,
  },
}

export default nextConfig

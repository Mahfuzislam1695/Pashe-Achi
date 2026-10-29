import { APP_LOGO_HERO, APP_NAME, APP_TAGLINE } from '@/shared'
import type { MetadataRoute } from 'next'

/**
 * The web app manifest (/manifest.webmanifest). "Add to Home Screen" opens the fresh market screen,
 * and on an iPhone or iPad push notifications work only once the site is added this way. (Shortcuts
 * added when the start page was /app still work: next.config.mjs redirects /app to /bazar.)
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME.bn} · ${APP_NAME.en}`,
    short_name: APP_NAME.bn,
    description: APP_TAGLINE.bn,
    lang: 'bn',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    // --blue in the customer site's Kingfisher palette.
    theme_color: '#1265d8',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: APP_LOGO_HERO, sizes: '512x512', type: 'image/webp' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      // On a white square with the bird inside the safe zone, for launchers that crop icons to a shape.
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

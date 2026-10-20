import type { Metadata } from 'next'

import { APP_LOGO_LARGE, APP_NAME } from '@/shared'
import { fontVariables } from './fonts'

export const metadata: Metadata = {
  title: `404 · ${APP_NAME.en}`,
  icons: { icon: [{ url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' }], apple: '/apple-icon.png' },
}

/**
 * Any URL that matches no page. The customer site and the admin panel have separate root layouts
 * (and stylesheets), so this page brings its own small inline styles.
 */
export default function GlobalNotFound() {
  return (
    <html lang="bn" className={fontVariables}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 16,
          background: '#f4f7fb',
          color: '#172033',
          fontFamily: "var(--font-latin), var(--font-bangla), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main style={{ textAlign: 'center', maxWidth: 360 }}>
          <img src={APP_LOGO_LARGE} alt={APP_NAME.en} width={120} height={120} style={{ display: 'block', margin: '0 auto 12px', objectFit: 'contain' }} />
          <p style={{ margin: 0, fontSize: 56, fontWeight: 700, color: '#1265d8', lineHeight: 1 }}>404</p>
          <h1 style={{ margin: '16px 0 4px', fontSize: 22, color: '#0e1c48' }}>পাতাটি পাওয়া যায়নি</h1>
          <p style={{ margin: 0, color: '#65748b' }}>This page could not be found.</p>
          <a
            href="/"
            style={{ display: 'inline-block', marginTop: 24, padding: '12px 22px', borderRadius: 12, background: '#1265d8', color: '#fff', fontWeight: 600, textDecoration: 'none' }}
          >
            হোমে ফিরুন · Go home
          </a>
        </main>
      </body>
    </html>
  )
}

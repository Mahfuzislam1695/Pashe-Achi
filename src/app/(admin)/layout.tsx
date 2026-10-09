import { APP_NAME } from '@/shared'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { LANG_COOKIE } from '@/admin/lib/constants'
import { hindSiliguri } from '../fonts'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: { default: `${APP_NAME.en} Admin`, template: `%s · ${APP_NAME.en} Admin` },
  description: 'Orders, customers, pricing and notifications for Pashe Achi.',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The admin panel defaults to English; the toggle switches to Bangla.
  const lang = (await cookies()).get(LANG_COOKIE)?.value === 'bn' ? 'bn' : 'en'
  return (
    <html lang={lang} className={hindSiliguri.variable}>
      <body>
        <Providers initialLang={lang}>{children}</Providers>
      </body>
    </html>
  )
}

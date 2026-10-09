import { APP_NAME } from '@/shared'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'

import { LANG_COOKIE } from '@/customer/lib/constants'
import { hindSiliguri } from '../fonts'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: `${APP_NAME.en} — ${APP_NAME.bn}`,
  description: 'কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান — এক অ্যাপে।',
  applicationName: APP_NAME.en,
  // Label under the icon when the site is added to an iPhone home screen.
  appleWebApp: { title: APP_NAME.bn },
  icons: {
    icon: [
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = (await cookies()).get(LANG_COOKIE)?.value === 'en' ? 'en' : 'bn'
  return (
    <html lang={lang} className={hindSiliguri.variable}>
      <body className="antialiased">
        <Providers initialLang={lang}>{children}</Providers>
      </body>
    </html>
  )
}

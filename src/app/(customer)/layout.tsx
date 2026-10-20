import { APP_NAME } from '@/shared'
import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'

import { LANG_COOKIE } from '@/customer/lib/constants'
import { fontVariables } from '../fonts'
import { Providers } from './providers'
import './globals.css'

// The share banner needs an absolute URL, so it is built on the origin the page was asked for
// (the proxy's forwarded host and protocol, when there is one).
export async function generateMetadata(): Promise<Metadata> {
  const request = await headers()
  const host = request.get('x-forwarded-host') ?? request.get('host')
  const protocol = request.get('x-forwarded-proto')?.split(',')[0] ?? 'http'
  return { ...metadata, metadataBase: host && URL.canParse(`${protocol}://${host}`) ? new URL(`${protocol}://${host}`) : null }
}

const metadata: Metadata = {
  title: `${APP_NAME.en} — ${APP_NAME.bn}`,
  description: 'কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান — এক অ্যাপে।',
  applicationName: APP_NAME.en,
  // Label under the icon when the site is added to an iPhone home screen. Added that way it opens
  // full screen and can get push notifications (src/app/manifest.ts).
  appleWebApp: { title: APP_NAME.bn, capable: true },
  icons: {
    icon: [
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  // The banner shown when a link to the site is shared (public/og-image.jpg, 1200×630).
  openGraph: {
    type: 'website',
    siteName: APP_NAME.en,
    title: `${APP_NAME.en} — ${APP_NAME.bn}`,
    description: 'কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান — এক অ্যাপে।',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: APP_NAME.en }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-image.jpg'] },
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
    <html lang={lang} className={fontVariables}>
      <body className="antialiased">
        <Providers initialLang={lang}>{children}</Providers>
      </body>
    </html>
  )
}

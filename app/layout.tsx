import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Hind_Siliguri } from 'next/font/google'
import { APP_NAME } from '@/lib/brand'
import './globals.css'

const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bangla',
})

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="bn" className={hindSiliguri.variable}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

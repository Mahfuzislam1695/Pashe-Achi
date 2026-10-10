import { APP_NAME, APP_TAGLINE } from '@/shared'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { SESSION_COOKIE } from '@/customer/lib/constants'
import { LandingScreen } from '@/customer/features/landing'

export const metadata: Metadata = {
  title: `${APP_NAME.en} — ${APP_TAGLINE.en}`,
  description:
    'কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান — এক অ্যাপে। Fresh market, house shifting, emergency medicine and parcel delivery in one app.',
}

// Signed-in visitors still see the landing page; they just get "Open app" instead of Sign up / Login.
export default async function LandingPage() {
  const signedIn = (await cookies()).has(SESSION_COOKIE)
  return <LandingScreen signedIn={signedIn} />
}

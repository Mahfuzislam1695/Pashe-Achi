import { APP_NAME } from '@/shared'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { SESSION_COOKIE } from '@/customer/lib/constants'
import { AccountDeletionScreen } from '@/customer/features/legal'

export const metadata: Metadata = {
  title: `Delete your account — ${APP_NAME.en}`,
  description: `${APP_NAME.bn} অ্যাকাউন্ট মুছে ফেলার নিয়ম। How to delete your ${APP_NAME.en} account, and what is deleted and kept.`,
}

// Public (src/proxy.ts PUBLIC_PATHS): the account-deletion "web link" Google Play asks for.
export default async function AccountDeletionPage() {
  const signedIn = (await cookies()).has(SESSION_COOKIE)
  return <AccountDeletionScreen signedIn={signedIn} />
}

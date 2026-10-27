import { APP_NAME } from '@/shared'
import type { Metadata } from 'next'

import { PrivacyScreen } from '@/customer/features/legal'

export const metadata: Metadata = {
  title: `Privacy policy — ${APP_NAME.en}`,
  description: `${APP_NAME.bn} প্রাইভেসি পলিসি। What the ${APP_NAME.en} website and app collect, why, and how to change or delete it.`,
}

// Public (src/proxy.ts PUBLIC_PATHS): Google Play and the App Store link to it.
export default function PrivacyPage() {
  return <PrivacyScreen />
}

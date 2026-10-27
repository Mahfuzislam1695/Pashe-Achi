import { APP_NAME } from '@/shared'
import type { Metadata } from 'next'

import { DownloadScreen } from '@/customer/features/download'
import { displayFont } from '../../fonts'

export const metadata: Metadata = {
  title: `Get the app — ${APP_NAME.en}`,
  description: `${APP_NAME.bn} অ্যাপ ডাউনলোড করুন। Get the ${APP_NAME.en} app for Android, or order on the website.`,
}

// Public, like the landing page (src/proxy.ts): the links are in APP_DOWNLOADS (src/shared/brand.ts).
export default function DownloadPage() {
  return <DownloadScreen fontClass={displayFont.variable} />
}

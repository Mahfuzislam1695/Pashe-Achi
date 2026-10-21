'use client'

import { APP_DOWNLOADS, APP_NAME } from '@/shared'
import { ArrowLeft, FileDown, Play, Smartphone } from 'lucide-react'
import Link from 'next/link'

import { DeveloperCredit } from '@/customer/components/developer-credit'
import { ContactDock, LangToggle, Logo } from '@/customer/components/ui'
import { useLang } from '@/customer/lib/i18n'
import { appPaths, webPaths as paths } from '@/customer/lib/paths'

/**
 * /app-download: the Android app on Google Play and as an APK, each "শীঘ্রই আসছে" until its link is
 * set in APP_DOWNLOADS (src/shared/brand.ts), and the web app, which works today. It has the landing
 * page's look and its Chat/Call dock (at every width here); `fontClass` carries the landing page's
 * headline font.
 */
export function DownloadScreen({ fontClass = '' }: { fontClass?: string }) {
  const { t, lang, setLang } = useLang()
  const { playStore, apk } = APP_DOWNLOADS
  const soon = <span className="lp-soon">{t('শীঘ্রই আসছে', 'Coming soon')}</span>

  return (
    <div className={`landing lp-dl-page ${fontClass}`}>
      <header className="lp-header is-scrolled">
        <div className="lp-container lp-header-row">
          <Link href={paths.entry} aria-label={APP_NAME[lang]}>
            <Logo />
          </Link>
          <div className="lp-header-actions">
            <LangToggle compact lang={lang} onChange={setLang} />
            <Link className="lp-btn lp-btn-sm lp-login" href={paths.entry}>
              <ArrowLeft size={16} />
              {t('হোম', 'Home')}
            </Link>
          </div>
        </div>
      </header>

      <main className="lp-app lp-dl">
        <div className="lp-container lp-app-grid lp-dl-grid">
          <div>
            <p className="lp-tagline">{APP_NAME[lang]}</p>
            <h1>{t('অ্যাপ ডাউনলোড করুন', 'Get the app')}</h1>
            <p className="lp-dl-lead">
              {t(
                'ফোন থেকেই বাজার, ঔষুধ, পার্সেল আর বাসা বদলের অর্ডার দিন। দাম এলে আর অর্ডারের প্রতিটি ধাপে নোটিফিকেশন পাবেন।',
                'Order groceries, medicine, parcels and house moves from your phone, with a notification when the price arrives and at every step.',
              )}
            </p>

            <ul className="lp-dl-options">
              <li className="lp-dl-option">
                <Play size={22} />
                <strong>
                  Google Play
                  {!playStore && soon}
                </strong>
                <p>{t('Play Store থেকে ইনস্টল করুন, আপডেট আপনাআপনি আসবে।', 'Install it from the Play Store; updates arrive on their own.')}</p>
                {playStore && (
                  <a className="lp-btn lp-btn-sun" href={playStore} target="_blank" rel="noopener noreferrer">
                    <Play size={18} />
                    {t('Google Play-তে দেখুন', 'Open in Google Play')}
                  </a>
                )}
              </li>

              <li className="lp-dl-option">
                <FileDown size={22} />
                <strong>
                  {t('Android অ্যাপ (APK)', 'Android app (APK)')}
                  {!apk && soon}
                </strong>
                <p>{t('Play Store ছাড়াই সরাসরি ফোনে ইনস্টল করুন।', 'Install it straight on your phone, without the Play Store.')}</p>
                {apk && (
                  <>
                    <a className="lp-btn lp-btn-ghost" href={apk} download>
                      <FileDown size={18} />
                      {t('APK ডাউনলোড করুন', 'Download the APK')}
                    </a>
                    <p className="lp-dl-note">
                      {t('ইনস্টলের সময় ফোন এই উৎস থেকে ইনস্টলের অনুমতি চাইতে পারে; অনুমতি দিন।', 'Your phone may ask you to allow installs from this source; allow it to install.')}
                    </p>
                  </>
                )}
              </li>

              <li className="lp-dl-option">
                <Smartphone size={22} />
                <strong>
                  {t('ওয়েব অ্যাপ', 'Web app')}
                  <span className="lp-ready">{t('এখনই চালু', 'Available now')}</span>
                </strong>
                <p>
                  {t(
                    'কিছু ডাউনলোড করতে হয় না। ব্রাউজারে খুলে হোম স্ক্রিনে রেখে দিন; iPhone-এ Share থেকে “Add to Home Screen”।',
                    'Nothing to download. Open it in your browser and keep it on your home screen; on an iPhone use Share, then “Add to Home Screen”.',
                  )}
                </p>
                {/* The main button while the Android app is still coming; beside a live download it steps back. */}
                <Link className={`lp-btn ${playStore || apk ? 'lp-btn-ghost' : 'lp-btn-sun'}`} href={appPaths.entry}>
                  <Smartphone size={18} />
                  {t('অ্যাপ ভার্সন খুলুন', 'Open the app version')}
                </Link>
              </li>
            </ul>
          </div>

          <div className="lp-app-visual">
            <div className="lp-phone">
              <img src={`/images/app-${lang}.webp`} alt={t('অ্যাপের কাঁচা বাজার স্ক্রিন', 'The fresh market screen of the app')} width={780} height={1688} />
            </div>
          </div>
        </div>
      </main>

      <footer className="lp-footer lp-dl-footer">
        <div className="lp-container lp-copyright">
          <span>
            © {new Date().getFullYear()} {APP_NAME[lang]}
          </span>
          <DeveloperCredit tone="dark" />
        </div>
      </footer>
      <ContactDock />
    </div>
  )
}

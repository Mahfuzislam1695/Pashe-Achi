'use client'

import { BellOff, BellRing } from 'lucide-react'

import { useLang } from '@/customer/lib/i18n'
import { usePush } from '@/customer/lib/push'

/**
 * On the order page while a price is coming or waiting for a confirm: one tap to get it on the
 * phone even when the site is closed. Shown only while notifications are off and could be turned on.
 */
export function PushPrompt() {
  const { t } = useLang()
  const push = usePush()
  if (push.status !== 'off') return null
  return (
    <div className="push-prompt">
      <BellRing size={18} aria-hidden="true" />
      <p>{t('দাম জানালেই ফোনে নোটিফিকেশন পেতে চালু করুন।', 'Turn on phone notifications to hear the moment your price is ready.')}</p>
      <button type="button" className="secondary-button" onClick={push.enable} disabled={push.busy} aria-busy={push.busy}>
        {push.busy ? t('অপেক্ষা করুন…', 'Please wait…') : t('চালু করুন', 'Turn on')}
      </button>
      {push.failed && <small role="alert">{t('চালু করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।', "Couldn't turn them on. Check the connection and try again.")}</small>}
    </div>
  )
}

/** The Notifications screen's switch for phone notifications in this browser, or why there is none. */
export function PushSetting() {
  const { t } = useLang()
  const push = usePush()
  if (!push.status || push.status === 'unavailable') return null

  const on = push.status === 'on'
  const hint =
    push.status === 'blocked'
      ? t(
          'এই ব্রাউজারে এই সাইটের নোটিফিকেশন বন্ধ করা আছে। ঠিকানার বারের আইকন থেকে Notifications → Allow করে পেজটি রিফ্রেশ করুন।',
          'Notifications are blocked for this site. Allow them from the icon in the address bar, then refresh the page.',
        )
      : push.status === 'ios-install'
        ? t(
            'iPhone বা iPad-এ: Safari-র Share বোতাম → Add to Home Screen চাপুন, তারপর হোম স্ক্রিনের অ্যাপ থেকে খুলে এখানে চালু করুন।',
            'On an iPhone or iPad: tap Share → Add to Home Screen in Safari, then open the app from the home screen and turn them on here.',
          )
        : push.status === 'unsupported'
          ? t('এই ব্রাউজারে ফোন নোটিফিকেশন পাওয়া যায় না। Chrome বা Firefox ব্যবহার করুন।', 'This browser cannot show phone notifications. Use Chrome or Firefox.')
          : on
            ? t('দাম, অর্ডারের খবর ও অফার সাইট বন্ধ থাকলেও ফোনে আসবে।', 'Prices, order updates and offers reach this phone even when the site is closed.')
            : t('চালু করলে সাইট বন্ধ থাকলেও দাম ও অর্ডারের খবর ফোনে পাবেন।', 'Turn them on to get prices and order updates even when the site is closed.')

  return (
    <div className={`push-setting ${on ? 'on' : ''}`}>
      {on ? <BellRing size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />}
      <span>
        <strong>{on ? t('ফোনে নোটিফিকেশন: চালু', 'Phone notifications: on') : t('ফোনে নোটিফিকেশন: বন্ধ', 'Phone notifications: off')}</strong>
        <span>{hint}</span>
        {push.failed && <small role="alert">{t('চালু করা যায়নি। আবার চেষ্টা করুন।', "Couldn't turn them on. Try again.")}</small>}
      </span>
      {(push.status === 'on' || push.status === 'off') && (
        <button type="button" className="secondary-button" onClick={on ? push.disable : push.enable} disabled={push.busy} aria-busy={push.busy}>
          {push.busy ? t('অপেক্ষা করুন…', 'Please wait…') : on ? t('বন্ধ করুন', 'Turn off') : t('চালু করুন', 'Turn on')}
        </button>
      )}
    </div>
  )
}

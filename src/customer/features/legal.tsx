'use client'

import { APP_NAME, HEAD_OFFICE } from '@/shared'
import { ArrowLeft, LogIn, MapPin, MessageCircle, Phone, Trash2 } from 'lucide-react'
import Link from 'next/link'

import { DeveloperCredit } from '@/customer/components/developer-credit'
import { ContactDock, LangToggle, Logo } from '@/customer/components/ui'
import { useLang } from '@/customer/lib/i18n'
import { webPaths as paths } from '@/customer/lib/paths'
import { useCatalog } from '@/customer/lib/queries'

/** Shown on both pages; change it with the text. */
const UPDATED = { bn: '২৭ অক্টোবর ২০২৬', en: '27 October 2026' }

/**
 * The frame of the public reading pages (/privacy, /account-deletion): the landing page's header and
 * footer around one light card. Google Play and the App Store link to both.
 */
function LegalPage({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useLang()
  return (
    <div className="landing lp-legal-page">
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
      <main className="lp-legal">
        <article className="lp-container lp-legal-card">{children}</article>
      </main>
      <footer className="lp-footer lp-dl-footer">
        <div className="lp-container lp-copyright">
          <span>
            © {new Date().getFullYear()} {APP_NAME[lang]} · <Link href={paths.privacy}>{t('প্রাইভেসি পলিসি', 'Privacy policy')}</Link> ·{' '}
            <Link href={paths.accountDeletion}>{t('অ্যাকাউন্ট মুছে ফেলা', 'Delete your account')}</Link>
          </span>
          <DeveloperCredit tone="dark" />
        </div>
      </footer>
      <ContactDock />
    </div>
  )
}

/** How to reach us: the live support line from the Catalog, and the head office. */
function ContactCard() {
  const { lang } = useLang()
  const support = useCatalog().data?.support
  return (
    <div className="lp-legal-contact">
      {support && (
        <>
          <a href={`tel:${support.phone}`}>
            <Phone size={16} />
            {support.phone}
          </a>
          <a href={support.whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} />
            WhatsApp
          </a>
        </>
      )}
      <span>
        <MapPin size={16} />
        {HEAD_OFFICE.label[lang]}: {HEAD_OFFICE.address[lang]}
      </span>
    </div>
  )
}

/** /privacy: what the site and the Kingfisher app collect, why, who sees it, how long it is kept, and the customer's choices. */
export function PrivacyScreen() {
  const { t, lang } = useLang()
  const name = APP_NAME[lang]
  return (
    <LegalPage>
      <h1>{t('প্রাইভেসি পলিসি', 'Privacy policy')}</h1>
      <p className="lp-legal-updated">{t(`সর্বশেষ আপডেট: ${UPDATED.bn}`, `Last updated: ${UPDATED.en}`)}</p>
      <p className="lp-legal-lead">
        {t(
          `${name} কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদানের সেবা দেয়: এই ওয়েবসাইটে এবং Android ও iPhone-এর ${name} অ্যাপে। আপনার কোন তথ্য আমরা রাখি, কেন রাখি আর কীভাবে আপনি তা বদলাতে বা মুছে ফেলতে পারেন, এখানে সহজ ভাষায় লেখা আছে।`,
          `${name} delivers fresh market shopping, house shifting, emergency medicine and parcels, through this website and the ${name} app for Android and iPhone. This page explains, in plain words, what we keep about you, why, and how you can change or delete it.`,
        )}
      </p>

      <section>
        <h2>{t('যে তথ্য আমরা রাখি', 'What we collect')}</h2>
        <ul>
          <li>
            <strong>{t('অ্যাকাউন্ট:', 'Account:')}</strong> {t('আপনার নাম, মোবাইল নম্বর ও ভাষা। পাসওয়ার্ড ব্যবহার করলে তা শুধু এনক্রিপ্ট করা (hash) অবস্থায় থাকে।', 'your name, mobile number and language. If you use a password, we keep only a one-way hash of it.')}
          </li>
          <li>
            <strong>{t('লোকেশন:', 'Location:')}</strong>{' '}
            {t(
              'আপনার অ্যাকাউন্ট ও প্রতিটি অর্ডারের জন্য ম্যাপে যে জায়গা বাছেন: ঠিকানা, বাসা/ফ্ল্যাট/রোড আর ম্যাপের পিন। “বর্তমান লোকেশন” চাপলে বা ম্যাপ খুললে তবেই অ্যাপ ফোনের লোকেশন নেয়; পেছনে থেকে কখনো নেয় না।',
              'the place you pick on the map for your account and each order: the address, your house, flat or road, and the map pin. The app reads your phone’s location only when you tap “Current location” or open the map, never in the background.',
            )}
          </li>
          <li>
            <strong>{t('অর্ডার:', 'Orders:')}</strong>{' '}
            {t(
              'বাজার ও ঔষুধের তালিকা, আপনার দেওয়া প্রেসক্রিপশনের ছবি বা PDF, ডেলিভারির দিন ও সময়, যোগাযোগ ও গ্রহীতার মোবাইল নম্বর, নোট, বিল আর অর্ডারের প্রতিটি ধাপ।',
              'your bazar and medicine lists, the prescription photos or PDFs you upload, delivery dates and times, contact and receiver mobile numbers, notes, bills and every step of the order.',
            )}
          </li>
          <li>
            <strong>{t('নোটিফিকেশন:', 'Notifications:')}</strong>{' '}
            {t('নোটিফিকেশন চালু করলে আপনার ব্রাউজার বা ফোনের নোটিফিকেশন ঠিকানা (push token) আর ভাষা।', 'if you turn them on, the push address of your browser or phone (its push token) and your language.')}
          </li>
          <li>
            <strong>{t('নিরাপত্তা:', 'Security:')}</strong>{' '}
            {t(
              'সাইন আপ, প্রোফাইল বদল ও লগইনের মতো কাজের সময় IP ঠিকানা ও ডিভাইস/ব্রাউজারের ধরন আমাদের নিরাপত্তা লগে থাকে।',
              'the IP address and the type of device or browser are written to our security log when you sign up, change your profile and so on.',
            )}
          </li>
        </ul>
        <p>
          {t(
            'আমরা আপনার কনট্যাক্ট লিস্ট, আপনার বেছে দেওয়া ছবি ছাড়া অন্য কোনো ছবি বা বিজ্ঞাপনের আইডি নিই না, এবং কোনো বিজ্ঞাপন দেখাই না।',
            'We do not read your contacts, any photos other than those you choose to upload, or advertising IDs, and we show no ads.',
          )}
        </p>
      </section>

      <section>
        <h2>{t('কেন রাখি', 'Why we use it')}</h2>
        <ul>
          <li>{t('আপনার অর্ডার নেওয়া, দাম জানানো, পৌঁছে দেওয়া এবং সমস্যায় আপনার সাথে যোগাযোগ করা।', 'To take, price and deliver your orders and to contact you about them.')}</li>
          <li>{t('দাম, অর্ডারের প্রতিটি ধাপ আর অফারের নোটিফিকেশন পাঠানো।', 'To send you prices, order updates and offers.')}</li>
          <li>{t('আপনার অ্যাকাউন্ট নিরাপদ রাখা ও প্রতারণা ঠেকানো।', 'To keep your account safe and prevent fraud.')}</li>
          <li>{t('আইন অনুযায়ী বিক্রির হিসাব রাখা।', 'To keep the sales records the law requires.')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('কারা দেখতে পান', 'Who sees it')}</h2>
        <p>
          {t(
            'আমাদের স্টাফ ও ডেলিভারি কর্মী, আপনার অর্ডারের জন্য যতটুকু দরকার ততটুকু। আমরা আপনার তথ্য কখনো বিক্রি করি না। কয়েকটি সেবা আমাদের হয়ে কাজ করে:',
            'Our staff and delivery riders, as much as your order needs. We never sell your data. A few services work for us:',
          )}
        </p>
        <ul>
          <li>{t('OpenStreetMap: ম্যাপের ছবি তাদের সার্ভার থেকে আসে, আর পিনের ঠিকানা আমাদের সার্ভার তাদের Nominatim সেবা থেকে জেনে নেয় (আপনার অ্যাকাউন্টের তথ্য পাঠানো হয় না)।', 'OpenStreetMap: map pictures load from its servers, and our server asks its Nominatim service for the address of a map pin (nothing about your account is sent).')}</li>
          <li>{t('Google Firebase Cloud Messaging: অ্যাপে নোটিফিকেশন পৌঁছে দেয়।', 'Google Firebase Cloud Messaging: delivers notifications to the app.')}</li>
          <li>{t('ব্রাউজারের নোটিফিকেশন সেবা (Google, Apple, Mozilla, Microsoft): ওয়েবসাইটের নোটিফিকেশন পৌঁছে দেয়।', 'Browser push services (Google, Apple, Mozilla, Microsoft): deliver the website’s notifications.')}</li>
        </ul>
        <p>{t('Chat চাপলে WhatsApp আর ম্যাপের লিংক চাপলে Google Maps খোলে; সেখানে তাদের নিজেদের নীতি প্রযোজ্য।', 'Tapping Chat opens WhatsApp and a map link opens Google Maps; their own policies apply there.')}</p>
      </section>

      <section>
        <h2>{t('কতদিন রাখি', 'How long we keep it')}</h2>
        <p>
          {t(
            'অ্যাকাউন্ট যতদিন আছে ততদিন। অ্যাকাউন্ট মুছে ফেললে নাম, মোবাইল নম্বর, লোকেশন, লগইন, নোটিফিকেশন, প্রেসক্রিপশন ফাইল ও নোটিফিকেশন ঠিকানা সাথে সাথে মুছে যায়। আগের অর্ডারগুলো বিক্রির হিসাব হিসেবে থাকে (অর্ডার নম্বর, সেবা, তালিকা, বিল ও তারিখ), কিন্তু আপনার নাম, ঠিকানা, পিন ও মোবাইল নম্বর ছাড়া। প্রতারণা ঠেকাতে নিরাপত্তা লগে অ্যাকাউন্টের কাজের রেকর্ড থেকে যায়।',
            'As long as your account exists. When you delete your account, your name, mobile number, location, sign-ins, notifications, prescription files and push addresses are deleted at once. Your past orders stay as sales records (order number, service, lines, bill and dates) without your name, addresses, pins or phone numbers. Our security log keeps the record of account actions, to prevent fraud.',
          )}
        </p>
      </section>

      <section>
        <h2>{t('আপনার হাতে যা আছে', 'Your choices')}</h2>
        <ul>
          <li>{t('প্রোফাইল থেকে নাম, মোবাইল নম্বর ও লোকেশন দেখুন ও বদলান।', 'See and change your name, mobile number and location in Profile.')}</li>
          <li>{t('নোটিফিকেশন যেকোনো সময় চালু বা বন্ধ করুন।', 'Turn notifications on or off at any time.')}</li>
          <li>
            {t('যেকোনো সময় অ্যাকাউন্ট মুছে ফেলুন: ', 'Delete your account at any time: ')}
            <Link href={paths.accountDeletion}>{t('কীভাবে', 'how')}</Link>
          </li>
        </ul>
      </section>

      <section>
        <h2>{t('নিরাপত্তা ও শিশু', 'Security and children')}</h2>
        <p>
          {t(
            'সব তথ্য HTTPS দিয়ে আসা-যাওয়া করে, আর পাসওয়ার্ড কখনো খোলা অবস্থায় রাখা হয় না। এই সেবা ১৩ বছরের কম বয়সীদের জন্য নয়, আর আমরা জেনেশুনে তাদের তথ্য রাখি না।',
            'Everything travels over HTTPS, and passwords are never stored in readable form. The service is not meant for children under 13, and we do not knowingly keep their data.',
          )}
        </p>
      </section>

      <section>
        <h2>{t('যোগাযোগ ও পরিবর্তন', 'Contact and changes')}</h2>
        <p>{t('এই পলিসি নিয়ে প্রশ্ন থাকলে আমাদের জানান। পলিসি বদলালে এই পাতায় নতুন তারিখসহ জানানো হবে।', 'Ask us anything about this policy. If it changes, this page will show the new version and its date.')}</p>
        <ContactCard />
      </section>
    </LegalPage>
  )
}

/**
 * /account-deletion: the "web link" Google Play asks for. How to delete the account in the app, on
 * the website or through support, and what is deleted and kept. `signedIn` comes from the session cookie.
 */
export function AccountDeletionScreen({ signedIn }: { signedIn: boolean }) {
  const { t, lang } = useLang()
  const name = APP_NAME[lang]
  return (
    <LegalPage>
      <h1>{t(`${name} অ্যাকাউন্ট মুছে ফেলুন`, `Delete your ${name} account`)}</h1>
      <p className="lp-legal-updated">{t(`সর্বশেষ আপডেট: ${UPDATED.bn}`, `Last updated: ${UPDATED.en}`)}</p>
      <p className="lp-legal-lead">
        {t(
          'অ্যাপ বা ওয়েবসাইট থেকে নিজেই যেকোনো সময় অ্যাকাউন্ট মুছে ফেলতে পারেন। চলমান অর্ডার থাকলে আগে তা শেষ হতে দিন বা বাতিল করুন।',
          'You can delete your account yourself at any time, in the app or on the website. If an order is still running, let it finish or cancel it first.',
        )}
      </p>

      <section>
        <h2>{t('কীভাবে মুছবেন', 'How to delete it')}</h2>
        <ol>
          <li>{t(`${name} অ্যাপে: প্রোফাইল → অ্যাকাউন্ট মুছে ফেলুন → আপনার মোবাইল নম্বর লিখে নিশ্চিত করুন।`, `In the ${name} app: Profile → Delete account → type your mobile number to confirm.`)}</li>
          <li>{t('ওয়েবসাইটে: লগইন করুন → প্রোফাইল → অ্যাকাউন্ট মুছে ফেলুন।', 'On the website: log in → Profile → Delete account.')}</li>
          <li>
            {t(
              'লগইন করতে না পারলে অ্যাকাউন্টের মোবাইল নম্বর থেকে আমাদের কল বা WhatsApp করুন; ৭ দিনের মধ্যে আমরা মুছে দেব।',
              'If you can’t log in, call or WhatsApp us from the account’s mobile number and we will delete it within 7 days.',
            )}
          </li>
        </ol>
        <div className="lp-legal-actions">
          <Link className="primary-button" href={signedIn ? `${paths.profile}#delete-account` : `${paths.login}?next=${encodeURIComponent(paths.profile)}`}>
            {signedIn ? <Trash2 size={17} /> : <LogIn size={17} />}
            {signedIn ? t('প্রোফাইলে যান', 'Go to Profile') : t('লগইন করে মুছুন', 'Log in to delete')}
          </Link>
        </div>
      </section>

      <section>
        <h2>{t('যা মুছে যায়', 'What is deleted')}</h2>
        <ul>
          <li>{t('আপনার নাম, মোবাইল নম্বর, লোকেশন ও পয়েন্ট।', 'Your name, mobile number, location and points.')}</li>
          <li>{t('সব ডিভাইসের লগইন: সব জায়গা থেকে সাথে সাথে লগআউট হয়ে যাবেন।', 'Your sign-ins on every device: you are signed out everywhere at once.')}</li>
          <li>{t('নোটিফিকেশন, ফোন ও ব্রাউজারের নোটিফিকেশন ঠিকানা আর প্রেসক্রিপশনের ফাইল।', 'Your notifications, the push addresses of your phones and browsers, and your prescription files.')}</li>
          <li>{t('আগের অর্ডারের ঠিকানা, ম্যাপের পিন, মোবাইল নম্বর ও নোট।', 'The addresses, map pins, phone numbers and notes on your past orders.')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('যা থেকে যায়', 'What is kept')}</h2>
        <ul>
          <li>{t('আগের অর্ডারগুলো বিক্রির হিসাব হিসেবে: অর্ডার নম্বর, সেবা, তালিকা, বিল ও তারিখ, কিন্তু আপনার পরিচয় ছাড়া।', 'Your past orders as sales records: order number, service, lines, bill and dates, without anything that identifies you.')}</li>
          <li>{t('প্রতারণা ঠেকাতে নিরাপত্তা লগে অ্যাকাউন্টের কাজের রেকর্ড।', 'The record of account actions in our security log, to prevent fraud.')}</li>
        </ul>
        <p>{t('মুছে ফেলা আর ফেরানো যায় না। একই নম্বর দিয়ে পরে আবার নতুন অ্যাকাউন্ট খুলতে পারবেন।', 'Deletion can’t be undone. You can open a new account with the same number later.')}</p>
      </section>

      <section>
        <h2>{t('যোগাযোগ', 'Contact')}</h2>
        <ContactCard />
      </section>
    </LegalPage>
  )
}

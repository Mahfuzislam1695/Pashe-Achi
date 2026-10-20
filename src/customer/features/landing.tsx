'use client'

import { APP_LOGO_HERO, APP_NAME, APP_TAGLINE, describeDeliveryHours, ORDER_STATUS_LABELS, SERVICE_IDS, SERVICE_LABELS, type ServiceId } from '@/shared'
import { BadgeCheck, BellRing, ChevronDown, Clock, Headset, Languages, LogIn, Menu, MessageCircle, Phone, ReceiptText, Smartphone, UserPlus, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Photo, useServiceBlurbs, useServiceCharges } from '@/customer/components/banner'
import { DeveloperCredit } from '@/customer/components/developer-credit'
import { ServiceSwitcher } from '@/customer/components/service-switcher'
import { QuotePreviewCard } from '@/customer/components/showcase'
import { ContactDock, LangToggle, Logo } from '@/customer/components/ui'
import { useLang } from '@/customer/lib/i18n'
import { appPaths, webPaths as paths } from '@/customer/lib/paths'
import { useCatalog, useOffers } from '@/customer/lib/queries'
import { OfferCard } from './offers'
import { SERVICE_ICONS } from './orders'

const SECTIONS = ['offers', 'services', 'how', 'app', 'pricing', 'faq'] as const

/**
 * The public home page. A deep indigo hero whose service switcher shows each service with its live
 * charges, then what is promised, the services, how ordering works, the app, the charges and the
 * questions. Every number comes from the live catalog; nothing on the page is invented. `fontClass`
 * carries the headline font (Anek Bangla), which only this page loads.
 */
export function LandingScreen({ signedIn, fontClass = '' }: { signedIn: boolean; fontClass?: string }) {
  const { t, lang, setLang, text } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const catalog = useCatalog().data
  // আজকের অফার: the section (and its menu link) only appears while an offer is running.
  const offers = useOffers().data ?? []
  const sections = SECTIONS.filter(id => id !== 'offers' || offers.length > 0)

  // The header is transparent over the hero and turns solid once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const sectionLabel: Record<(typeof SECTIONS)[number], string> = {
    offers: t('আজকের অফার', "Today's offers"),
    services: t('সেবাসমূহ', 'Services'),
    how: t('যেভাবে কাজ করে', 'How it works'),
    app: t('অ্যাপ', 'App'),
    pricing: t('খরচ', 'Pricing'),
    faq: t('প্রশ্নোত্তর', 'FAQ'),
  }

  const authActions = signedIn ? (
    <Link className="lp-btn lp-btn-sm lp-signup" href={paths.home}>
      {t('অ্যাপ খুলুন', 'Open app')}
    </Link>
  ) : (
    <>
      <Link className="lp-btn lp-btn-sm lp-login" href={paths.login}>
        <LogIn size={16} />
        {t('লগইন', 'Login')}
      </Link>
      <Link className="lp-btn lp-btn-sm lp-signup" href={paths.signup}>
        <UserPlus size={16} />
        {t('সাইন আপ', 'Sign up')}
      </Link>
    </>
  )

  return (
    <div className={`landing ${fontClass}`}>
      <header className={`lp-header ${scrolled || menuOpen ? 'is-scrolled' : ''}`}>
        <div className="lp-container lp-header-row">
          <Link href={paths.entry} aria-label={APP_NAME[lang]}>
            <Logo />
          </Link>
          <nav className={`lp-nav ${menuOpen ? 'open' : ''}`} aria-label={t('পেজের অংশ', 'Page sections')}>
            {sections.map(id => (
              <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>
                {sectionLabel[id]}
              </a>
            ))}
            <div className="lp-nav-actions">{authActions}</div>
          </nav>
          <div className="lp-header-actions">
            <LangToggle compact lang={lang} onChange={setLang} />
            <div className="lp-header-auth">{authActions}</div>
            <button
              type="button"
              className="lp-menu"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t('মেনু বন্ধ করুন', 'Close menu') : t('মেনু খুলুন', 'Open menu')}
              onClick={() => setMenuOpen(open => !open)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-tagline">{APP_TAGLINE[lang]}</p>
              <h1>{t('বাজার, ঔষুধ, পার্সেল, বাসা বদল — ঘরে বসেই', 'Groceries, medicine, parcels and house moves, from home')}</h1>
              <p className="lp-lead">
                {t(
                  'লিস্ট পাঠান, আমরা দাম জানাই। পুরো বিল দেখে আপনি কনফার্ম করলে তবেই অর্ডার বুক হয়।',
                  "Send your list and we send the price. Nothing is booked until you've seen the whole bill and confirmed it.",
                )}
              </p>
              <div className="lp-hero-actions">
                {signedIn ? (
                  <Link className="lp-btn lp-btn-sun" href={paths.home}>
                    {t('অ্যাপ খুলুন', 'Open app')}
                  </Link>
                ) : (
                  <>
                    <Link className="lp-btn lp-btn-sun" href={paths.signup}>
                      <UserPlus size={18} />
                      {t('ফ্রি অ্যাকাউন্ট খুলুন', 'Create a free account')}
                    </Link>
                    <Link className="lp-btn lp-btn-ghost" href={paths.login}>
                      {t('লগইন', 'Login')}
                    </Link>
                  </>
                )}
              </div>
              {!signedIn && <p className="lp-hero-note">{t('সাইন আপ ফ্রি, এক মিনিটের কাজ।', 'Signing up is free and takes about a minute.')}</p>}
            </div>
            <ServiceSwitcher paths={paths} />
          </div>
        </section>

        <div className="lp-container lp-promises-wrap">
          <Promises />
        </div>

        {offers.length > 0 && (
          <section id="offers" className="lp-section lp-offers">
            <div className="lp-container">
              <SectionHead title={t('চলমান অফার, আজই নিন', 'Running offers, grab them today')} subtitle={t('সীমিত সময়ের অফার। অর্ডার করতে লগইন বা সাইন আপ করুন।', 'Offers for a limited time. Log in or sign up to order.')} />
              <div className="offer-grid">
                {offers.map(offer => (
                  <OfferCard key={offer.id} offer={offer} paths={paths} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="services" className="lp-section">
          <div className="lp-container">
            <SectionHead
              title={t('চারটি সেবা, একটি অ্যাকাউন্ট', 'Four services, one account')}
              subtitle={t('যেটা দরকার বেছে নিন। খরচ সবসময় আগেই দেখানো থাকে।', 'Pick what you need. The charges are always shown up front.')}
            />
            <ServicesBento />
          </div>
        </section>

        <section id="how" className="lp-section lp-tinted">
          <div className="lp-container lp-how-grid">
            <div>
              <SectionHead title={t('যেভাবে অর্ডার করবেন', 'How ordering works')} subtitle={t('অর্ডার দিতে এক মিনিটের বেশি লাগে না।', 'Ordering takes about a minute.')} />
              <Steps />
            </div>
            <div className="lp-how-visual">
              <QuotePreviewCard />
              <p>{t('বাজার ও ঔষুধের দাম এভাবে আসে। কনফার্ম করার পর দাম আর বদলায় না।', 'This is how a bazar or medicine price arrives. Once you confirm, the price stays fixed.')}</p>
            </div>
          </div>
        </section>

        <AppSection />

        <section id="pricing" className="lp-section">
          <div className="lp-container">
            <SectionHead
              title={t('স্বচ্ছ খরচ, কোনো লুকানো চার্জ নেই', 'Clear charges, nothing hidden')}
              subtitle={t('আমাদের সেবা ও ডেলিভারি খরচ। বাজার ও ঔষুধের দাম আলাদা, যা আপনি দেখে কনফার্ম করবেন।', 'Our service and delivery charges. Goods and medicine are paid at their price, which you see before you confirm.')}
            />
            <PricingLedger />
          </div>
        </section>

        <section id="faq" className="lp-section lp-tinted">
          <div className="lp-container lp-faq-grid">
            <div>
              <SectionHead title={t('সাধারণ কিছু প্রশ্ন', 'Common questions')} subtitle={t('উত্তর না পেলে সরাসরি আমাদের জিজ্ঞেস করুন।', 'Can’t find an answer? Ask us directly.')} />
              <SupportCard />
            </div>
            <Faq />
          </div>
        </section>

        <section className="lp-band-section">
          <div className="lp-container">
            <div className="lp-band">
              <Photo name="city" className="lp-band-photo" sizes="(min-width: 1240px) 1200px, 100vw" />
              <div>
                <h2>{t('আজই প্রথম অর্ডার দিন', 'Place your first order today')}</h2>
                <p>{t('এক মিনিটে অ্যাকাউন্ট খুলুন, তারপর যেকোনো সেবা অর্ডার করুন।', 'Create an account in a minute, then order any service.')}</p>
                <div className="lp-band-actions">
                  {signedIn ? (
                    <Link className="lp-btn lp-btn-sun" href={paths.home}>
                      {t('অ্যাপ খুলুন', 'Open app')}
                    </Link>
                  ) : (
                    <>
                      <Link className="lp-btn lp-btn-sun" href={paths.signup}>
                        <UserPlus size={18} />
                        {t('ফ্রি অ্যাকাউন্ট খুলুন', 'Create a free account')}
                      </Link>
                      <Link className="lp-btn lp-btn-ghost" href={paths.login}>
                        {t('লগইন', 'Login')}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <img className="lp-band-logo" src={APP_LOGO_HERO} alt="" width={512} height={512} />
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-grid">
          <div className="lp-footer-brand">
            <Logo />
            <p>{APP_TAGLINE[lang]}</p>
            {catalog?.support && (
              <div className="lp-footer-contact">
                <a href={`tel:${catalog.support.phone}`}>
                  <Phone size={15} />
                  {catalog.support.phone}
                </a>
                <a href={catalog.support.whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={15} />
                  WhatsApp
                </a>
              </div>
            )}
          </div>
          <nav aria-label={sectionLabel.services}>
            <strong>{sectionLabel.services}</strong>
            {SERVICE_IDS.map(service => (
              <Link key={service} href={paths.service(service)}>
                {text(SERVICE_LABELS[service])}
              </Link>
            ))}
          </nav>
          <nav aria-label={t('অ্যাকাউন্ট', 'Account')}>
            <strong>{t('অ্যাকাউন্ট', 'Account')}</strong>
            {signedIn ? (
              <Link href={paths.home}>{t('অ্যাপ খুলুন', 'Open app')}</Link>
            ) : (
              <>
                <Link href={paths.login}>{t('লগইন', 'Login')}</Link>
                <Link href={paths.signup}>{t('সাইন আপ', 'Sign up')}</Link>
              </>
            )}
            <a href="#pricing">{sectionLabel.pricing}</a>
            <a href="#faq">{sectionLabel.faq}</a>
          </nav>
          <div>
            <strong>{t('ভাষা', 'Language')}</strong>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
        </div>
        <div className="lp-container lp-copyright">
          <span>
            © {new Date().getFullYear()} {APP_NAME[lang]}
          </span>
          <DeveloperCredit tone="dark" />
        </div>
      </footer>
      <ContactDock />
      <MobileActionBar signedIn={signedIn} />
    </div>
  )
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="lp-head">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

/** Four things the app guarantees, with the delivery hours and support number from the live catalog. */
function Promises() {
  const { t, text } = useLang()
  const catalog = useCatalog().data
  const bazarHours = catalog?.deliveryHours.bazar
  const hours = !bazarHours
    ? null
    : bazarHours.length
      ? t(`কাঁচা বাজার: ${describeDeliveryHours(bazarHours).bn} পর্যন্ত`, `Fresh market: ${text(describeDeliveryHours(bazarHours))}`)
      : t('যেকোনো সময়', 'Any time')
  return (
    <ul className="lp-promises">
      <li>
        <ReceiptText size={20} />
        <strong>{t('কনফার্মের আগেই পুরো বিল', 'The full bill before you confirm')}</strong>
        <span>{t('আপনি কনফার্ম না করলে অর্ডার বুক হয় না।', 'Nothing is booked until you confirm it.')}</span>
      </li>
      <li>
        <Clock size={20} />
        <strong>{t('ডেলিভারির সময়', 'Delivery hours')}</strong>
        <span>{hours ?? t('লোড হচ্ছে…', 'Loading…')}</span>
      </li>
      <li>
        <BadgeCheck size={20} />
        <strong>{t('ফ্রি অ্যাকাউন্ট', 'Free account')}</strong>
        <span>{t('কোনো সাবস্ক্রিপশন নেই, শুধু অর্ডারের বিল।', 'No subscription; you pay only for your orders.')}</span>
      </li>
      <li>
        <Headset size={20} />
        <strong>{t('কল বা WhatsApp-এ সাপোর্ট', 'Support by call or WhatsApp')}</strong>
        {catalog?.support ? <a href={`tel:${catalog.support.phone}`}>{catalog.support.phone}</a> : <span>{t('লোড হচ্ছে…', 'Loading…')}</span>}
      </li>
    </ul>
  )
}

/** The four services, each tile shaped by what it has to say: bazar's flow, shifting's vehicles. */
function ServicesBento() {
  const { t, text, taka } = useLang()
  const catalog = useCatalog().data
  const blurb = useServiceBlurbs()
  const charge = useServiceCharges(catalog?.pricing)
  const vehicles = catalog?.vehicles.filter(vehicle => vehicle.isActive) ?? []
  const order = (service: ServiceId) => t(`${text(SERVICE_LABELS[service])} অর্ডার করুন`, `Order ${text(SERVICE_LABELS[service]).toLowerCase()}`)
  const heading = (service: ServiceId) => {
    const Icon = SERVICE_ICONS[service]
    return (
      <h3>
        <Icon size={22} />
        {text(SERVICE_LABELS[service])}
      </h3>
    )
  }

  return (
    <div className="lp-bento">
      <article className="lp-tile lp-tile-bazar svc-bazar">
        <Photo name="bazar" className="lp-tile-photo" sizes="(min-width: 1024px) 460px, 100vw" />
        <div className="lp-tile-body">
          {heading('bazar')}
          <p>{blurb.bazar}</p>
          <ol className="lp-flow" aria-label={t('কাঁচা বাজার যেভাবে কাজ করে', 'How fresh market works')}>
            <li>{t('লিস্ট লিখুন', 'Write your list')}</li>
            <li>{t('আমরা দাম জানাই', 'We send the price')}</li>
            <li>{t('কনফার্ম করুন', 'You confirm')}</li>
          </ol>
          {charge && <span className="lp-tile-price">{charge.bazar}</span>}
          <Link className="lp-tile-link" href={paths.service('bazar')}>
            {order('bazar')}
          </Link>
        </div>
      </article>

      <article className="lp-tile lp-tile-medicine svc-medicine">
        <Photo name="medicine" className="lp-tile-photo" sizes="(min-width: 1024px) 360px, 100vw" />
        <div className="lp-tile-body">
          {heading('medicine')}
          <p>{t('ঔষুধের নাম লিখুন বা প্রেসক্রিপশনের ছবি অথবা PDF আপলোড করুন। দাম জানালে দেখে কনফার্ম করবেন।', 'Type the medicine names or upload a photo or PDF of the prescription. We send the price for you to confirm.')}</p>
          {charge && <span className="lp-tile-price">{charge.medicine}</span>}
          <Link className="lp-tile-link" href={paths.service('medicine')}>
            {order('medicine')}
          </Link>
        </div>
      </article>

      <article className="lp-tile lp-tile-shifting svc-shifting">
        <Photo name="shifting" className="lp-tile-photo" sizes="(min-width: 1024px) 300px, 100vw" />
        <div className="lp-tile-body">
          {heading('shifting')}
          <p>{blurb.shifting}</p>
          {vehicles.length > 0 && (
            <dl className="lp-tile-rates" aria-label={t('গাড়ী ভাড়া', 'Vehicle rent')}>
              {vehicles.slice(0, 3).map(vehicle => (
                <div key={vehicle.id}>
                  <dt>{text(vehicle.name)}</dt>
                  <dd>{taka(vehicle.rate)}</dd>
                </div>
              ))}
            </dl>
          )}
          <Link className="lp-tile-link" href={paths.service('shifting')}>
            {order('shifting')}
          </Link>
        </div>
      </article>

      <article className="lp-tile lp-tile-parcel svc-parcel">
        <Photo name="parcel" className="lp-tile-photo" sizes="(min-width: 1024px) 300px, 100vw" />
        <div className="lp-tile-body">
          {heading('parcel')}
          <p>{blurb.parcel}</p>
          {charge && <span className="lp-tile-price">{charge.parcel}</span>}
          <Link className="lp-tile-link" href={paths.service('parcel')}>
            {order('parcel')}
          </Link>
        </div>
      </article>
    </div>
  )
}

/** The four steps of an order, in order. */
function Steps() {
  const { t } = useLang()
  const steps: [string, string][] = [
    [t('সেবা বেছে নিন', 'Choose a service'), t('বাজার, বাসা বদল, ঔষুধ বা পার্সেল — যেটা দরকার।', 'Bazar, shifting, medicine or a parcel: whatever you need.')],
    [t('লিস্ট বা তথ্য দিন', 'Fill in your list'), t('ম্যাপে ঠিকানা, সময় আর লিস্ট দিন।', 'Pick the address on the map, then add the time and your list.')],
    [
      t('দাম জেনে কনফার্ম করুন', 'Get the price, then confirm'),
      t(
        'বাজার ও ঔষুধের দাম আমরা যাচাই করে পাঠাই; বাসা বদল ও পার্সেলের বিল সাথে সাথেই দেখা যায়।',
        'We check and send bazar and medicine prices; shifting and parcel bills show as you fill in the form.',
      ),
    ],
    [t('অর্ডার ট্র্যাক করুন', 'Track your order'), t('অর্ডারের প্রতিটি ধাপ নোটিফিকেশনে জানতে পারবেন।', 'You get a notification at every step of the order.')],
  ]
  return (
    <ol className="lp-steps">
      {steps.map(([title, body]) => (
        <li key={title}>
          <strong>{title}</strong>
          <p>{body}</p>
        </li>
      ))}
    </ol>
  )
}

/** The app version: a real screenshot of it, what it does on a phone, and the way in. */
function AppSection() {
  const { t, lang } = useLang()
  return (
    <section id="app" className="lp-section lp-app">
      <div className="lp-container lp-app-grid">
        <div className="lp-app-visual">
          <div className="lp-phone">
            <img src={`/images/app-${lang}.webp`} alt={t('অ্যাপের কাঁচা বাজার স্ক্রিন', 'The fresh market screen of the app')} width={780} height={1688} loading="lazy" />
          </div>
        </div>
        <div>
          <SectionHead
            title={t('ফোনে চলে অ্যাপের মতো', 'Works like an app on your phone')}
            subtitle={t('কিছু ডাউনলোড করতে হয় না। ফোনের ব্রাউজারে খুলে হোম স্ক্রিনে রেখে দিন।', 'Nothing to download. Open it in your phone’s browser and keep it on your home screen.')}
          />
          <ul className="lp-app-points">
            <li>
              <BellRing size={22} />
              <strong>{t('প্রতিটি ধাপে নোটিফিকেশন', 'A notification at every step')}</strong>
              <span>{t('দাম এলে, অর্ডার বুক হলে আর পৌঁছালে নোটিফিকেশন পাবেন।', 'You are notified when the price arrives, when the order is booked and when it is delivered.')}</span>
            </li>
            <li>
              <Smartphone size={22} />
              <strong>{t('হোম স্ক্রিনে যোগ করুন', 'Add it to your home screen')}</strong>
              <span>{t('iPhone-এ Share থেকে “Add to Home Screen”, Android-এ ব্রাউজারের মেনু থেকে।', 'On an iPhone use Share, then “Add to Home Screen”; on Android, the browser menu.')}</span>
            </li>
            <li>
              <Languages size={22} />
              <strong>{t('বাংলা ও English', 'Bangla and English')}</strong>
              <span>{t('যেকোনো সময় এক ট্যাপে ভাষা বদলান।', 'Switch the language at any time with one tap.')}</span>
            </li>
          </ul>
          <Link className="lp-btn lp-btn-sun" href={appPaths.entry}>
            <Smartphone size={18} />
            {t('অ্যাপ ভার্সন খুলুন', 'Open the app version')}
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Live charges from the admin panel's Catalog (the same numbers the bill uses), with each service's hours. */
function PricingLedger() {
  const { t, text, taka } = useLang()
  const catalog = useCatalog()
  if (!catalog.data) {
    return <p className="empty-note">{catalog.isError ? t('খরচ এখন দেখানো যাচ্ছে না।', 'Charges are not available right now.') : t('লোড হচ্ছে…', 'Loading…')}</p>
  }
  const { pricing, vehicles, deliveryHours } = catalog.data
  const cards: { service: ServiceId; lines: [string, number][] }[] = [
    {
      service: 'bazar',
      lines: [
        [t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), pricing.bazarShoppingFee],
        [t('ডেলিভারী খরচ', 'Delivery charge'), pricing.bazarDeliveryFee],
      ],
    },
    {
      service: 'shifting',
      lines: [
        [t('জনপ্রতি লেবার মজুরী', 'Wage per labourer'), pricing.wagePerLabourer],
        [t('প্রতি ফ্লোর (loading)', 'Per floor (loading)'), pricing.loadingRatePerFloor],
        [t('প্রতি ফ্লোর (unloading)', 'Per floor (unloading)'), pricing.unloadingRatePerFloor],
      ],
    },
    { service: 'medicine', lines: [[t('ডেলিভারী চার্জ', 'Delivery charge'), pricing.medicineDeliveryFee]] },
    { service: 'parcel', lines: [[t('ডেলিভারী খরচ', 'Delivery charge'), pricing.parcelDeliveryFee]] },
  ]
  const active = vehicles.filter(vehicle => vehicle.isActive)

  return (
    <div className="lp-pricing">
      {cards.map(({ service, lines }) => {
        const Icon = SERVICE_ICONS[service]
        const windows = deliveryHours[service]
        const hours = windows.length ? t(`${describeDeliveryHours(windows).bn} পর্যন্ত`, describeDeliveryHours(windows).en) : t('যেকোনো সময়', 'Any time')
        return (
          <article key={service} className={`lp-price svc-${service}`}>
            <header>
              <Icon size={20} />
              <span>
                <h3>{text(SERVICE_LABELS[service])}</h3>
                <small>{hours}</small>
              </span>
            </header>
            <dl>
              {lines.map(([label, amount]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{taka(amount)}</dd>
                </div>
              ))}
            </dl>
            {service === 'shifting' && active.length > 0 && (
              <>
                <p className="lp-price-sub">{t('গাড়ী ভাড়া', 'Vehicle rent')}</p>
                <dl>
                  {active.map(vehicle => (
                    <div key={vehicle.id}>
                      <dt>{text(vehicle.name)}</dt>
                      <dd>{taka(vehicle.rate)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </article>
        )
      })}
    </div>
  )
}

/** Call and WhatsApp, from the support numbers in the admin panel's Catalog. */
function SupportCard() {
  const { t } = useLang()
  const support = useCatalog().data?.support
  return (
    <div id="contact" className="lp-support">
      <Headset size={22} />
      <strong>{t('আরো প্রশ্ন আছে?', 'Still have questions?')}</strong>
      <p>{t('আমাদের সাপোর্ট টিম কল বা WhatsApp-এ সাহায্য করবে।', 'Our support team will help by phone or on WhatsApp.')}</p>
      {support && (
        <div className="lp-support-actions">
          <a className="lp-btn lp-btn-blue" href={`tel:${support.phone}`}>
            <Phone size={16} />
            {t('কল করুন', 'Call us')}
          </a>
          <a className="lp-btn lp-btn-line" href={support.whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} />
            WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}

/** Common questions. The answers only state rules the app enforces. */
function Faq() {
  const { t } = useLang()
  const items: [string, string][] = [
    [
      t('কীভাবে অর্ডার করব?', 'How do I place an order?'),
      t(
        'অ্যাকাউন্ট খুলে সেবা বেছে নিন ও ফর্মে তথ্য দিন। বাসা বদল ও পার্সেলে বিল দেখে “অর্ডার নিশ্চিত করুন” চাপুন। বাজার ও ঔষুধে লিস্ট পাঠান; আমরা দাম জানালে অর্ডারের পাতায় “কনফার্ম করুন” চাপুন।',
        'Create an account, pick a service and fill in the form. For shifting and parcels, check the bill and tap “Confirm order”. For bazar and medicine, send your list; when we send the price, tap “Confirm” on the order’s page.',
      ),
    ],
    [
      t('বিল কীভাবে হিসাব হয়?', 'How is the bill worked out?'),
      t(
        'বিলে আমাদের সেবা ও ডেলিভারি খরচ যোগ হয়, যা খরচ অংশে দেওয়া আছে। বাজার ও ঔষুধের দাম আমরা যাচাই করে জানাই; দূরত্ব বা বাজারের পরিমাণ অনুযায়ী মজুরী ও ডেলিভারি খরচ বদলালে সেটাও বিলে দেখাই। আপনি কনফার্ম করলে সেই বিলই চূড়ান্ত।',
        'The bill adds our service and delivery charges, listed under Pricing. We check and send the price of the goods or medicine, and if the distance or the size of the bazar changes the shopping fee or delivery charge, the bill shows that too. Once you confirm it, that bill is final.',
      ),
    ],
    [
      t('কখন ডেলিভারি পাব?', 'When will it be delivered?'),
      t(
        'প্রতিটি সেবার ডেলিভারির সময় সূচী অর্ডারের পাতায় দেখানো থাকে। সেই সময়ের মধ্যে আপনার সুবিধামতো দিন ও সময় বেছে নিন।',
        'Each service shows its delivery hours on its order screen. Pick a day and time within them.',
      ),
    ],
    [
      t('প্রেসক্রিপশন কি আপলোড করা যায়?', 'Can I upload a prescription?'),
      t('হ্যাঁ। জরুরী ঔষুধ অর্ডারের সাথে প্রেসক্রিপশনের ছবি বা PDF আপলোড করতে পারবেন।', 'Yes. Add a photo or PDF of your prescription to a medicine order.'),
    ],
    [
      t('অর্ডার কি বাতিল করা যায়?', 'Can I cancel an order?'),
      t(
        `অর্ডার বুক হওয়ার আগে, অর্থাৎ “${ORDER_STATUS_LABELS.PENDING.bn}” বা “${ORDER_STATUS_LABELS.QUOTED.bn}” থাকা অবস্থায়, অর্ডারের পাতা থেকেই বাতিল করতে পারবেন।`,
        `Yes, before it is booked: while it is “${ORDER_STATUS_LABELS.PENDING.en}” or “${ORDER_STATUS_LABELS.QUOTED.en}”. Cancel it from the order’s page.`,
      ),
    ],
    [
      t('অর্ডারের অবস্থা কীভাবে জানব?', 'How do I follow my order?'),
      t(
        'অর্ডার হিস্ট্রিতে প্রতিটি অর্ডারের অবস্থা দেখা যায়, আর প্রতিটি পরিবর্তনে নোটিফিকেশন পাবেন।',
        'Order history shows the status of every order, and you get a notification at each change.',
      ),
    ],
  ]
  return (
    <div className="lp-faq">
      {items.map(([question, answer]) => (
        <details key={question}>
          <summary>
            {question}
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  )
}

/**
 * Phones and tablets: Sign up (or Open app), Chat and Call stay at the bottom of the screen. It takes
 * the place of the floating Chat/Call dock, which returns on the web from 1024px.
 */
function MobileActionBar({ signedIn }: { signedIn: boolean }) {
  const { t } = useLang()
  const support = useCatalog().data?.support
  return (
    <div className="lp-mobile-bar">
      {signedIn ? (
        <Link className="lp-btn lp-btn-sun" href={paths.home}>
          {t('অ্যাপ খুলুন', 'Open app')}
        </Link>
      ) : (
        <Link className="lp-btn lp-btn-sun" href={paths.signup}>
          <UserPlus size={18} />
          {t('ফ্রি অ্যাকাউন্ট খুলুন', 'Create a free account')}
        </Link>
      )}
      {support && (
        <>
          <a className="lp-bar-link" href={support.whatsapp} target="_blank" rel="noopener noreferrer" title={t('WhatsApp-এ চ্যাট করুন', 'Chat on WhatsApp')}>
            <MessageCircle size={18} />
            Chat
          </a>
          <a className="lp-bar-link call" href={`tel:${support.phone}`} title={t('সাপোর্টে কল করুন', 'Call support')}>
            <Phone size={18} />
            Call
          </a>
        </>
      )}
    </div>
  )
}

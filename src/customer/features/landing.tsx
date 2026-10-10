'use client'

import { APP_LOGO_HERO, APP_NAME, APP_TAGLINE, APP_WELCOME, SERVICE_IDS, SERVICE_LABELS, type ServiceId } from '@/shared'
import { ArrowRight, BellRing, Clock, LogIn, Menu, MessageCircle, Phone, ReceiptText, UserPlus, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { ContactDock, LangToggle, Logo } from '@/customer/components/ui'
import { useLang } from '@/customer/lib/i18n'
import { webPaths as paths } from '@/customer/lib/paths'
import { useCatalog } from '@/customer/lib/queries'
import { SERVICE_ICONS } from './orders'

const SECTIONS = ['services', 'how', 'pricing', 'contact'] as const

/** The public home page: what the service is, what it costs, how to reach us. Phone and web. */
export function LandingScreen({ signedIn }: { signedIn: boolean }) {
  const { t, lang, setLang, text } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)

  const sectionLabel: Record<(typeof SECTIONS)[number], string> = {
    services: t('সেবাসমূহ', 'Services'),
    how: t('যেভাবে কাজ করে', 'How it works'),
    pricing: t('খরচ', 'Pricing'),
    contact: t('যোগাযোগ', 'Contact'),
  }
  const serviceBlurb: Record<ServiceId, string> = {
    bazar: t('বাজারের লিস্ট লিখে দিন, আমরা বাজার করে বাসায় পৌঁছে দেব।', 'Write your list; we do the shopping and bring it home.'),
    shifting: t('গাড়ী, লেবার আর ফ্লোর বেছে নিন, খরচ আগেই জেনে নিন।', 'Pick a vehicle, labourers and floors, and see the cost first.'),
    medicine: t('প্রেসক্রিপশন আপলোড করুন, ঔষুধ পৌঁছে যাবে আপনার ঠিকানায়।', 'Upload your prescription and we deliver the medicine.'),
    parcel: t('পণ্য এক ঠিকানা থেকে নিয়ে আরেক ঠিকানায় পৌঁছে দিই।', 'We collect a parcel from one address and deliver it to another.'),
  }

  const authActions = signedIn ? (
    <Link className="primary-button" href={paths.home}>
      {t('অ্যাপ খুলুন', 'Open app')}
      <ArrowRight size={16} />
    </Link>
  ) : (
    <>
      <Link className="secondary-button" href={paths.login}>
        <LogIn size={16} />
        {t('লগইন', 'Login')}
      </Link>
      <Link className="primary-button" href={paths.signup}>
        <UserPlus size={16} />
        {t('সাইন আপ', 'Sign up')}
      </Link>
    </>
  )

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-container landing-header-row">
          <Link href={paths.entry} aria-label={APP_NAME[lang]}>
            <Logo />
          </Link>
          <nav className={`landing-nav ${menuOpen ? 'open' : ''}`} aria-label={t('পেজের অংশ', 'Page sections')}>
            {SECTIONS.map(id => (
              <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>
                {sectionLabel[id]}
              </a>
            ))}
            <div className="landing-nav-actions">{authActions}</div>
          </nav>
          <div className="landing-header-actions">
            <LangToggle compact lang={lang} onChange={setLang} />
            <div className="landing-header-auth">{authActions}</div>
            <button
              type="button"
              className="icon-button landing-menu"
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
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="eyebrow">{APP_WELCOME[lang]}</p>
              <h1>{APP_TAGLINE[lang]}</h1>
              <p className="landing-lead">
                {t(
                  'কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান — একটি অ্যাকাউন্টে চারটি সেবা। অর্ডার করার আগেই পুরো বিল দেখে নিন।',
                  'Fresh market, house shifting, emergency medicine and parcel delivery: four services, one account. See the full bill before you order.',
                )}
              </p>
              <div className="landing-cta">
                {signedIn ? (
                  <Link className="primary-button" href={paths.home}>
                    {t('অ্যাপ খুলুন', 'Open app')}
                    <ArrowRight size={17} />
                  </Link>
                ) : (
                  <>
                    <Link className="primary-button" href={paths.signup}>
                      <UserPlus size={17} />
                      {t('ফ্রি অ্যাকাউন্ট খুলুন', 'Create a free account')}
                    </Link>
                    <Link className="secondary-button" href={paths.login}>
                      <LogIn size={17} />
                      {t('লগইন', 'Login')}
                    </Link>
                  </>
                )}
              </div>
              <ul className="landing-points">
                <li>
                  <ReceiptText size={17} />
                  {t('অর্ডারের আগেই বিল', 'Bill before you order')}
                </li>
                <li>
                  <BellRing size={17} />
                  {t('প্রতিটি ধাপে নোটিফিকেশন', 'Updates at every step')}
                </li>
                <li>
                  <Phone size={17} />
                  {t('কল বা চ্যাটে সাপোর্ট', 'Support by call or chat')}
                </li>
              </ul>
            </div>
            <div className="landing-hero-art">
              <img src={APP_LOGO_HERO} alt={APP_NAME[lang]} width={512} height={512} />
              {SERVICE_IDS.map(service => {
                const Icon = SERVICE_ICONS[service]
                return (
                  <span key={service} className={`landing-chip chip-${service}`}>
                    <Icon size={16} />
                    {text(SERVICE_LABELS[service])}
                  </span>
                )
              })}
            </div>
          </div>
        </section>

        <section id="services" className="landing-section">
          <div className="landing-container">
            <SectionHead title={sectionLabel.services} subtitle={t('যা দরকার, এক জায়গায়।', 'Everything you need, in one place.')} />
            <div className="landing-services">
              {SERVICE_IDS.map(service => {
                const Icon = SERVICE_ICONS[service]
                return (
                  <Link key={service} href={paths.service(service)} className={`landing-service service-${service}`}>
                    <span className="landing-service-icon">
                      <Icon size={24} />
                    </span>
                    <strong>{text(SERVICE_LABELS[service])}</strong>
                    <p>{serviceBlurb[service]}</p>
                    <span className="landing-service-link">
                      {t('অর্ডার করুন', 'Order now')}
                      <ArrowRight size={15} />
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <section id="how" className="landing-section landing-tinted">
          <div className="landing-container">
            <SectionHead title={sectionLabel.how} subtitle={t('তিনটি সহজ ধাপ।', 'Three simple steps.')} />
            <ol className="landing-steps">
              <li>
                <strong>{t('সেবা বেছে নিন', 'Choose a service')}</strong>
                <p>{t('বাজার, বাসা বদল, ঔষুধ বা পার্সেল — যেটা দরকার।', 'Bazar, shifting, medicine or a parcel: whatever you need.')}</p>
              </li>
              <li>
                <strong>{t('লিস্ট বা তথ্য দিন', 'Fill in your list')}</strong>
                <p>{t('ঠিকানা, সময় আর লিস্ট লিখুন। বিল সাথে সাথে হিসাব হয়ে যায়।', 'Add the address, time and your list. The bill is worked out as you type.')}</p>
              </li>
              <li>
                <strong>{t('নিশ্চিত করুন, আমরা পৌঁছে দেব', 'Confirm, and we deliver')}</strong>
                <p>{t('অর্ডারের প্রতিটি ধাপ নোটিফিকেশনে জানতে পারবেন।', 'You get a notification at every step of the order.')}</p>
              </li>
            </ol>
            <p className="notice landing-hours">
              <Clock size={16} />
              <span>{t('কাঁচা বাজার ডেলিভারির সময় সূচী: সকাল ৮ থেকে ১০ এবং সন্ধ্যা ৬ থেকে ৯ পর্যন্ত।', 'Fresh market delivery hours: 8–10 am and 6–9 pm.')}</span>
            </p>
          </div>
        </section>

        <section id="pricing" className="landing-section">
          <div className="landing-container">
            <SectionHead
              title={sectionLabel.pricing}
              subtitle={t('আমাদের সেবা ও ডেলিভারি খরচ। বাজার ও ঔষুধের দাম আলাদা।', 'Our service and delivery charges. Goods and medicine are paid at their price.')}
            />
            <Pricing />
          </div>
        </section>

        <section className="landing-section landing-band">
          <div className="landing-container landing-band-row">
            <div>
              <h2>{t('আজই শুরু করুন', 'Get started today')}</h2>
              <p>{t('এক মিনিটে অ্যাকাউন্ট খুলুন, তারপর যেকোনো সেবা অর্ডার করুন।', 'Create an account in a minute, then order any service.')}</p>
            </div>
            <Link className="primary-button" href={signedIn ? paths.home : paths.signup}>
              {signedIn ? t('অ্যাপ খুলুন', 'Open app') : t('সাইন আপ', 'Sign up')}
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>

        <section id="contact" className="landing-section">
          <div className="landing-container">
            <SectionHead title={sectionLabel.contact} subtitle={t('যেকোনো প্রশ্নে আমরা পাশে আছি।', 'Questions? We are right here.')} />
            <Contact />
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-grid">
          <div>
            <Logo />
            <p>{APP_TAGLINE[lang]}</p>
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
          </nav>
          <div>
            <strong>{t('ভাষা', 'Language')}</strong>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
        </div>
        <div className="landing-container landing-copyright">
          © {new Date().getFullYear()} {APP_NAME[lang]}
        </div>
      </footer>
      <ContactDock />
    </div>
  )
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="landing-section-head">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  )
}

/** Live charges from the admin panel's Catalog, the same numbers the bill uses. */
function Pricing() {
  const { t, text, taka } = useLang()
  const catalog = useCatalog()
  if (!catalog.data) {
    return <p className="empty-note">{catalog.isError ? t('খরচ এখন দেখানো যাচ্ছে না।', 'Charges are not available right now.') : t('লোড হচ্ছে…', 'Loading…')}</p>
  }
  const { pricing, vehicles } = catalog.data
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

  return (
    <div className="landing-pricing">
      {cards.map(({ service, lines }) => {
        const Icon = SERVICE_ICONS[service]
        return (
          <article key={service} className="landing-price-card">
            <header>
              <Icon size={19} />
              <strong>{text(SERVICE_LABELS[service])}</strong>
            </header>
            <dl>
              {lines.map(([label, amount]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{taka(amount)}</dd>
                </div>
              ))}
            </dl>
            {service === 'shifting' && vehicles.length > 0 && (
              <>
                <p className="landing-price-sub">{t('গাড়ী ভাড়া', 'Vehicle rent')}</p>
                <dl>
                  {vehicles.map(vehicle => (
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

function Contact() {
  const { t } = useLang()
  const support = useCatalog().data?.support
  if (!support) return null
  return (
    <div className="landing-contact">
      <a className="landing-contact-card" href={`tel:${support.phone}`}>
        <span className="landing-service-icon">
          <Phone size={22} />
        </span>
        <span>
          <strong>{t('কল করুন', 'Call us')}</strong>
          <small>{support.phone}</small>
        </span>
      </a>
      <a className="landing-contact-card" href={support.whatsapp} target="_blank" rel="noopener noreferrer">
        <span className="landing-service-icon whatsapp">
          <MessageCircle size={22} />
        </span>
        <span>
          <strong>{t('WhatsApp-এ চ্যাট', 'Chat on WhatsApp')}</strong>
          <small>{t('সাপোর্ট টিমের সাথে কথা বলুন', 'Talk to our support team')}</small>
        </span>
      </a>
    </div>
  )
}

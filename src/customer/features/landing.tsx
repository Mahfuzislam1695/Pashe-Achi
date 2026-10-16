'use client'

import { APP_LOGO_HERO, APP_NAME, APP_TAGLINE, APP_WELCOME, ORDER_STATUS_LABELS, type Pricing, SERVICE_IDS, SERVICE_LABELS, type ServiceId } from '@/shared'
import {
  ArrowRight,
  BellRing,
  ChevronDown,
  Headset,
  LayoutGrid,
  LogIn,
  Menu,
  MessageCircle,
  MousePointerClick,
  PencilLine,
  Phone,
  ReceiptText,
  UserPlus,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { DeliveryHoursNotice } from '@/customer/components/delivery-schedule'
import { BillPreviewCard, OrderTrackerCard, SplitHeadline } from '@/customer/components/showcase'
import { ContactDock, LangToggle, Logo } from '@/customer/components/ui'
import { useLang } from '@/customer/lib/i18n'
import { webPaths as paths } from '@/customer/lib/paths'
import { useCatalog } from '@/customer/lib/queries'
import { SERVICE_ICONS } from './orders'

const SECTIONS = ['services', 'how', 'pricing', 'faq', 'contact'] as const

/** The public home page: what the service is, what it costs, how to reach us. Phone and web. */
export function LandingScreen({ signedIn }: { signedIn: boolean }) {
  const { t, lang, setLang, text } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const catalog = useCatalog().data

  // The header is transparent over the hero and turns solid once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const sectionLabel: Record<(typeof SECTIONS)[number], string> = {
    services: t('সেবাসমূহ', 'Services'),
    how: t('যেভাবে কাজ করে', 'How it works'),
    pricing: t('খরচ', 'Pricing'),
    faq: t('প্রশ্নোত্তর', 'FAQ'),
    contact: t('যোগাযোগ', 'Contact'),
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
      <header className={`landing-header ${scrolled || menuOpen ? 'is-scrolled' : ''}`}>
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
              <p className="landing-eyebrow">
                <span className="live-dot" aria-hidden="true" />
                {APP_WELCOME[lang]}
              </p>
              <SplitHeadline text={APP_TAGLINE[lang]} />
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
              <div className="landing-quick">
                <span>{t('সরাসরি বেছে নিন', 'Jump to a service')}</span>
                <div>
                  {SERVICE_IDS.map(service => {
                    const Icon = SERVICE_ICONS[service]
                    return (
                      <Link key={service} href={paths.service(service)} className={`svc-${service}`}>
                        <Icon size={15} />
                        {text(SERVICE_LABELS[service])}
                      </Link>
                    )
                  })}
                </div>
              </div>
              <ul className="landing-points">
                <li>
                  <ReceiptText size={16} />
                  {t('অর্ডারের আগেই বিল', 'Bill before you order')}
                </li>
                <li>
                  <BellRing size={16} />
                  {t('প্রতিটি ধাপে নোটিফিকেশন', 'Updates at every step')}
                </li>
                <li>
                  <Phone size={16} />
                  {t('কল বা চ্যাটে সাপোর্ট', 'Support by call or chat')}
                </li>
              </ul>
            </div>
            <div className="landing-hero-visual">
              <div className="hero-orb">
                <img src={APP_LOGO_HERO} alt={APP_NAME[lang]} width={512} height={512} />
              </div>
              <BillPreviewCard className="float-card float-a" />
              <OrderTrackerCard className="float-card float-b" />
            </div>
          </div>
        </section>

        <section id="services" className="landing-section">
          <div className="landing-container">
            <SectionHead
              kicker={t('আমাদের সেবা', 'Our services')}
              title={t('যা দরকার, এক জায়গায়', 'Everything you need, in one place')}
              subtitle={t('চারটি প্রয়োজনীয় সেবা, একটি অ্যাকাউন্টে। খরচ সবসময় আগেই জানা।', 'Four everyday services in one account, with the cost always shown up front.')}
            />
            <ServiceCards pricing={catalog?.pricing} />
          </div>
        </section>

        <section id="how" className="landing-section landing-tinted">
          <div className="landing-container">
            <SectionHead kicker={sectionLabel.how} title={t('চারটি সহজ ধাপ', 'Four simple steps')} subtitle={t('অর্ডার দিতে এক মিনিটের বেশি লাগে না।', 'Ordering takes about a minute.')} />
            <Steps />
            <DeliveryHoursNotice service="bazar" windows={catalog?.deliveryHours.bazar ?? []} className="landing-hours" />
          </div>
        </section>

        <section id="why" className="landing-section">
          <div className="landing-container landing-why-grid">
            <WhyVisual />
            <div>
              <SectionHead kicker={t(`কেন ${APP_NAME.bn}`, `Why ${APP_NAME.en}`)} title={t('সহজ, স্বচ্ছ আর সবসময় পাশে', 'Simple, clear and always by your side')} />
              <Benefits />
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-section landing-tinted">
          <div className="landing-container">
            <SectionHead
              kicker={sectionLabel.pricing}
              title={t('স্বচ্ছ খরচ, কোনো লুকানো চার্জ নেই', 'Clear charges, nothing hidden')}
              subtitle={t('আমাদের সেবা ও ডেলিভারি খরচ। বাজার ও ঔষুধের দাম আলাদা।', 'Our service and delivery charges. Goods and medicine are paid at their price.')}
            />
            <PricingCards />
          </div>
        </section>

        <section id="faq" className="landing-section">
          <div className="landing-container landing-faq-grid">
            <div>
              <SectionHead kicker={sectionLabel.faq} title={t('সাধারণ কিছু প্রশ্ন', 'Common questions')} subtitle={t('উত্তর না পেলে সরাসরি আমাদের জিজ্ঞেস করুন।', 'Can’t find an answer? Ask us directly.')} />
              <SupportCard />
            </div>
            <Faq />
          </div>
        </section>

        <section className="landing-cta-section">
          <div className="landing-container">
            <div className="landing-band">
              <div className="landing-band-copy">
                <h2>{t('আজই শুরু করুন', 'Get started today')}</h2>
                <p>{t('এক মিনিটে অ্যাকাউন্ট খুলুন, তারপর যেকোনো সেবা অর্ডার করুন।', 'Create an account in a minute, then order any service.')}</p>
                <div className="landing-band-actions">
                  {signedIn ? (
                    <Link className="primary-button" href={paths.home}>
                      {t('অ্যাপ খুলুন', 'Open app')}
                      <ArrowRight size={17} />
                    </Link>
                  ) : (
                    <>
                      <Link className="primary-button" href={paths.signup}>
                        <UserPlus size={17} />
                        {t('সাইন আপ', 'Sign up')}
                      </Link>
                      <Link className="secondary-button" href={paths.login}>
                        <LogIn size={17} />
                        {t('লগইন', 'Login')}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <img className="landing-band-logo" src={APP_LOGO_HERO} alt="" width={512} height={512} />
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-grid">
          <div className="landing-footer-brand">
            <Logo />
            <p>{APP_TAGLINE[lang]}</p>
            {catalog?.support && (
              <div className="landing-footer-contact">
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
        <div className="landing-container landing-copyright">
          © {new Date().getFullYear()} {APP_NAME[lang]}
        </div>
      </footer>
      <ContactDock />
    </div>
  )
}

function SectionHead({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <div className="landing-section-head">
      <p className="landing-kicker">{kicker}</p>
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

/** The four services, each with its main charge from the live catalog. */
function ServiceCards({ pricing }: { pricing?: Pricing }) {
  const { t, text, taka } = useLang()
  const blurb: Record<ServiceId, string> = {
    bazar: t('বাজারের লিস্ট লিখে দিন, আমরা বাজার করে বাসায় পৌঁছে দেব।', 'Write your list; we do the shopping and bring it home.'),
    shifting: t('গাড়ী, লেবার আর ফ্লোর বেছে নিন, খরচ আগেই জেনে নিন।', 'Pick a vehicle, labourers and floors, and see the cost first.'),
    medicine: t('প্রেসক্রিপশন আপলোড করুন, ঔষুধ পৌঁছে যাবে আপনার ঠিকানায়।', 'Upload your prescription and we deliver the medicine.'),
    parcel: t('পণ্য এক ঠিকানা থেকে নিয়ে আরেক ঠিকানায় পৌঁছে দিই।', 'We collect a parcel from one address and deliver it to another.'),
  }
  const charge: Record<ServiceId, string> | null = pricing
    ? {
        bazar: `${t('ডেলিভারি', 'Delivery')} ${taka(pricing.bazarDeliveryFee)}`,
        shifting: `${t('লেবার', 'Labour')} ${taka(pricing.wagePerLabourer)}${t('/জন', ' each')}`,
        medicine: `${t('ডেলিভারি', 'Delivery')} ${taka(pricing.medicineDeliveryFee)}`,
        parcel: `${t('ডেলিভারি', 'Delivery')} ${taka(pricing.parcelDeliveryFee)}`,
      }
    : null
  return (
    <div className="landing-services">
      {SERVICE_IDS.map(service => {
        const Icon = SERVICE_ICONS[service]
        return (
          <Link key={service} href={paths.service(service)} className={`landing-service svc-${service}`}>
            <span className="landing-service-art">
              <span className="landing-service-icon">
                <Icon size={28} />
              </span>
              {charge && <span className="landing-service-price">{charge[service]}</span>}
            </span>
            <span className="landing-service-body">
              <strong>{text(SERVICE_LABELS[service])}</strong>
              <span>{blurb[service]}</span>
              <span className="landing-service-link">
                {t('অর্ডার করুন', 'Order now')}
                <ArrowRight size={15} />
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function Steps() {
  const { t, digits } = useLang()
  const steps = [
    {
      icon: MousePointerClick,
      title: t('সেবা বেছে নিন', 'Choose a service'),
      body: t('বাজার, বাসা বদল, ঔষুধ বা পার্সেল — যেটা দরকার।', 'Bazar, shifting, medicine or a parcel: whatever you need.'),
    },
    { icon: PencilLine, title: t('লিস্ট বা তথ্য দিন', 'Fill in your list'), body: t('ঠিকানা, সময় আর লিস্ট লিখুন।', 'Add the address, the time and your list.') },
    {
      icon: ReceiptText,
      title: t('বিল দেখে নিশ্চিত করুন', 'Check the bill and confirm'),
      body: t('লিখতে লিখতেই পুরো বিল হিসাব হয়ে যায়। দেখে নিয়ে অর্ডার নিশ্চিত করুন।', 'The full bill is worked out as you type. Check it, then confirm.'),
    },
    { icon: BellRing, title: t('অর্ডার ট্র্যাক করুন', 'Track your order'), body: t('অর্ডারের প্রতিটি ধাপ নোটিফিকেশনে জানতে পারবেন।', 'You get a notification at every step of the order.') },
  ]
  return (
    <ol className="landing-steps">
      {steps.map(({ icon: Icon, title, body }, index) => (
        <li key={title}>
          <span className="landing-step-icon">
            <Icon size={22} />
            <span className="landing-step-no">{digits(index + 1)}</span>
          </span>
          <strong>{title}</strong>
          <p>{body}</p>
        </li>
      ))}
    </ol>
  )
}

/** The order tracker and a status notification, as the customer sees them. */
function WhyVisual() {
  const { t, text } = useLang()
  return (
    <div className="landing-why-visual" aria-hidden="true">
      <div className="why-toast">
        <span className="showcase-card-icon tone-blue">
          <BellRing size={16} />
        </span>
        <span>
          <strong>{t('অর্ডার আপডেট', 'Order update')}</strong>
          <small>{text(ORDER_STATUS_LABELS.BOOKED)}</small>
        </span>
      </div>
      <OrderTrackerCard current={2} />
      <BillPreviewCard />
    </div>
  )
}

/** What sets the service apart. Every row describes something the app already does. */
function Benefits() {
  const { t } = useLang()
  const items = [
    {
      tone: 'tone-blue',
      icon: ReceiptText,
      title: t('অর্ডারের আগেই পুরো বিল', 'The full bill up front'),
      body: t('সেবা ও ডেলিভারি খরচসহ পুরো হিসাব অর্ডার নিশ্চিত করার আগেই দেখতে পাবেন।', 'See every charge, including service and delivery, before you confirm.'),
    },
    {
      tone: 'tone-green',
      icon: BellRing,
      title: t('প্রতিটি ধাপে আপডেট', 'Updates at every step'),
      body: t('অর্ডারের অবস্থা বদলালেই সাথে সাথে নোটিফিকেশন পাবেন।', 'You are notified as soon as your order’s status changes.'),
    },
    {
      tone: 'tone-orange',
      icon: Headset,
      title: t('কল বা চ্যাটে সাপোর্ট', 'Support by call or chat'),
      body: t('যেকোনো প্রশ্নে এক ট্যাপে আমাদের কল করুন বা WhatsApp-এ লিখুন।', 'Call us or message us on WhatsApp in one tap.'),
    },
    {
      tone: 'tone-violet',
      icon: LayoutGrid,
      title: t('এক অ্যাকাউন্টে চার সেবা', 'Four services, one account'),
      body: t('বাজার, বাসা বদল, ঔষুধ আর পার্সেল — একবার সাইন আপ করেই সব।', 'Bazar, shifting, medicine and parcels, all with one sign-up.'),
    },
  ]
  return (
    <ul className="landing-why">
      {items.map(({ tone, icon: Icon, title, body }) => (
        <li key={tone} className={tone}>
          <span className="landing-why-icon">
            <Icon size={21} />
          </span>
          <span>
            <strong>{title}</strong>
            <p>{body}</p>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Live charges from the admin panel's Catalog, the same numbers the bill uses. */
function PricingCards() {
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
          <article key={service} className={`landing-price-card svc-${service}`}>
            <header>
              <span className="landing-price-icon">
                <Icon size={19} />
              </span>
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

/** Call and WhatsApp, from the support numbers in the admin panel's Catalog. */
function SupportCard() {
  const { t } = useLang()
  const support = useCatalog().data?.support
  return (
    <div id="contact" className="landing-support">
      <span className="landing-support-icon">
        <Headset size={22} />
      </span>
      <strong>{t('আরো প্রশ্ন আছে?', 'Still have questions?')}</strong>
      <p>{t('আমাদের সাপোর্ট টিম কল বা WhatsApp-এ সাহায্য করবে।', 'Our support team will help by phone or on WhatsApp.')}</p>
      {support && (
        <div className="landing-support-actions">
          <a className="primary-button" href={`tel:${support.phone}`}>
            <Phone size={16} />
            {t('কল করুন', 'Call us')}
          </a>
          <a className="secondary-button" href={support.whatsapp} target="_blank" rel="noopener noreferrer">
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
        'অ্যাকাউন্ট খুলে সেবা বেছে নিন, ফর্মে তথ্য দিন, তারপর বিল দেখে “অর্ডার নিশ্চিত করুন” চাপুন।',
        'Create an account, pick a service and fill in the form. Then check the bill and tap “Confirm order”.',
      ),
    ],
    [
      t('বিল কীভাবে হিসাব হয়?', 'How is the bill worked out?'),
      t(
        'বিলে আমাদের সেবা ও ডেলিভারি খরচ যোগ হয়, যা খরচ অংশে দেওয়া আছে। বাজার ও ঔষুধের দাম আলাদা।',
        'The bill adds our service and delivery charges, listed under Pricing. Goods and medicine are paid at their price.',
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
        `অর্ডার “${ORDER_STATUS_LABELS.PENDING.bn}” থাকা পর্যন্ত, অর্থাৎ বুক হওয়ার আগে, অর্ডারের পাতা থেকেই বাতিল করতে পারবেন।`,
        `Yes, while it is still “${ORDER_STATUS_LABELS.PENDING.en}”, before it is booked. Cancel it from the order’s page.`,
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
    <div className="landing-faq">
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

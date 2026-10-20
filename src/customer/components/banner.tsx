'use client'

import { photo, type PhotoName, type Pricing, SERVICE_IDS, SERVICE_LABELS, type ServiceId } from '@/shared'
import { ArrowRight, BadgePercent, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { SERVICE_ICONS } from '@/customer/features/orders'
import { useLang } from '@/customer/lib/i18n'
import { usePaths } from '@/customer/lib/paths'
import { useCatalog, useOffers } from '@/customer/lib/queries'

/**
 * A photo from public/images (PHOTOS in brand.ts) at the size the screen needs. `alt` stays empty
 * when the photo only sits behind text that already says what it is about.
 */
export function Photo({ name, sizes, alt = '', priority = false, className }: { name: PhotoName; sizes: string; alt?: string; priority?: boolean; className?: string }) {
  const { src, srcSet } = photo(name)
  return (
    <img
      className={className}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
    />
  )
}

/** One line about each service: the landing page cards, the service banners and the home slider. */
export function useServiceBlurbs(): Record<ServiceId, string> {
  const { t } = useLang()
  return {
    bazar: t('বাজারের লিস্ট লিখে দিন, আমরা বাজার করে বাসায় পৌঁছে দেব।', 'Write your list; we do the shopping and bring it home.'),
    shifting: t('গাড়ী, লেবার আর ফ্লোর বেছে নিন, খরচ আগেই জেনে নিন।', 'Pick a vehicle, labourers and floors, and see the cost first.'),
    medicine: t('প্রেসক্রিপশন আপলোড করুন, ঔষুধ পৌঁছে যাবে আপনার ঠিকানায়।', 'Upload your prescription and we deliver the medicine.'),
    parcel: t('পণ্য এক ঠিকানা থেকে নিয়ে আরেক ঠিকানায় পৌঁছে দিই।', 'We collect a parcel from one address and deliver it to another.'),
  }
}

/** Each service's main charge from the live catalog, or null until it loads. */
export function useServiceCharges(pricing: Pricing | undefined): Record<ServiceId, string> | null {
  const { t, taka } = useLang()
  if (!pricing) return null
  return {
    bazar: `${t('ডেলিভারি', 'Delivery')} ${taka(pricing.bazarDeliveryFee)}`,
    shifting: `${t('লেবার', 'Labour')} ${taka(pricing.wagePerLabourer)}${t('/জন', ' each')}`,
    medicine: `${t('ডেলিভারি', 'Delivery')} ${taka(pricing.medicineDeliveryFee)}`,
    parcel: `${t('ডেলিভারি', 'Delivery')} ${taka(pricing.parcelDeliveryFee)}`,
  }
}

/** The banner at the top of a service form: the service's photo, name, what it does and its charge. */
export function ServiceBanner({ id }: { id: ServiceId }) {
  const { text } = useLang()
  const blurbs = useServiceBlurbs()
  const charges = useServiceCharges(useCatalog().data?.pricing)
  const Icon = SERVICE_ICONS[id]
  return (
    <figure className={`photo-banner svc-${id}`}>
      <Photo name={id} sizes="(min-width: 1024px) 1100px, 100vw" priority />
      <figcaption className="photo-banner-copy">
        <span className="photo-banner-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <strong>{text(SERVICE_LABELS[id])}</strong>
        <span className="photo-banner-sub">{blurbs[id]}</span>
        {charges && <span className="photo-banner-chip">{charges[id]}</span>}
      </figcaption>
    </figure>
  )
}

type Slide = {
  key: string
  offer: boolean
  tone: string
  image: { src: string; srcSet?: string }
  eyebrow: string
  title: string
  subtitle: string
  href?: string
  cta?: string
}

const SLIDE_INTERVAL_MS = 5000

/**
 * The home screen's banner: running offers first, then the four services. Swipe or use the arrows and
 * dots; it moves on by itself every few seconds, except while the pointer or focus is on it, the tab
 * is hidden, or the visitor asked for reduced motion.
 */
export function PromoSlider({ current }: { current: ServiceId }) {
  const { t, text, digits } = useLang()
  const paths = usePaths()
  const blurbs = useServiceBlurbs()
  const charges = useServiceCharges(useCatalog().data?.pricing)
  const offers = useOffers().data ?? []
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const slides: Slide[] = [
    ...offers.map(offer => ({
      key: `offer-${offer.id}`,
      offer: true,
      tone: offer.service ? `svc-${offer.service}` : 'tone-orange',
      image: offer.imageUrl ? { src: offer.imageUrl } : photo(offer.service ?? 'hero'),
      eyebrow: t('আজকের অফার', "Today's offer"),
      title: text(offer.title),
      subtitle: offer.body ? text(offer.body) : '',
      href: paths.offers,
      cta: t('অফার দেখুন', 'See the offer'),
    })),
    ...SERVICE_IDS.map(service => ({
      key: service,
      offer: false,
      tone: `svc-${service}`,
      image: photo(service),
      eyebrow: charges?.[service] ?? t('আমাদের সেবা', 'Our service'),
      title: text(SERVICE_LABELS[service]),
      subtitle: blurbs[service],
      // The slide of the open screen points at the form below it instead of a link.
      href: service === current ? undefined : paths.service(service),
      cta: service === current ? undefined : t('অর্ডার করুন', 'Order now'),
    })),
  ]
  const count = slides.length

  const goTo = (index: number) => {
    const element = track.current
    if (!element) return
    const next = (index + count) % count
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollTo({ left: next * element.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
  }

  // A hidden tab stops the slider; coming back starts it again.
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  // Each slide that comes into view starts a fresh wait before the next one.
  useEffect(() => {
    if (paused || !visible || count < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => goTo(active + 1), SLIDE_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [active, paused, visible, count])

  return (
    <section
      className="promo-slider"
      aria-roledescription="carousel"
      aria-label={t('অফার ও সেবা', 'Offers and services')}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <div
        ref={track}
        className="promo-track"
        onScroll={event => {
          const element = event.currentTarget
          setActive(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)))
        }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.key}
            className={`promo-slide ${slide.tone} ${slide.offer ? 'is-offer' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${digits(index + 1)} / ${digits(count)}`}
          >
            <img src={slide.image.src} srcSet={slide.image.srcSet} sizes="(min-width: 1024px) 1100px, 100vw" alt="" loading={index ? 'lazy' : 'eager'} decoding="async" />
            <div className="promo-copy">
              <span className="promo-eyebrow">
                {slide.offer && <BadgePercent size={13} />}
                {slide.eyebrow}
              </span>
              <strong>{slide.title}</strong>
              {slide.subtitle && <span className="promo-sub">{slide.subtitle}</span>}
              {slide.href && slide.cta && (
                <Link className="promo-cta" href={slide.href} tabIndex={index === active ? 0 : -1}>
                  {slide.cta}
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="promo-controls">
          <button type="button" className="promo-arrow" aria-label={t('আগের স্লাইড', 'Previous slide')} onClick={() => goTo(active - 1)}>
            <ChevronLeft size={18} />
          </button>
          <div className="promo-dots">
            {slides.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                className={index === active ? 'active' : ''}
                aria-label={t(`স্লাইড ${digits(index + 1)}`, `Slide ${index + 1}`)}
                aria-current={index === active ? 'true' : undefined}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
          <button type="button" className="promo-arrow" aria-label={t('পরের স্লাইড', 'Next slide')} onClick={() => goTo(active + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </section>
  )
}

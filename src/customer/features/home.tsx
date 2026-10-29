'use client'

import { type CategoryPhotoName, categoryPhoto, SERVICE_IDS, SERVICE_LABELS, type ServiceId, shortArea, type Text } from '@/shared'
import { ArrowRight, ChevronDown, ChevronRight, MapPin, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { fromMyLocation } from '@/customer/components/address-field'
import { Photo, useServiceBlurbs, useServiceCharges } from '@/customer/components/banner'
import { LocationSheet } from '@/customer/components/location-sheet'
import { useAddToBazar } from '@/customer/lib/drafts'
import { useLang } from '@/customer/lib/i18n'
import { usePaths } from '@/customer/lib/paths'
import { useOffers, useSaveMyLocation, useSession } from '@/customer/lib/queries'
import { OfferCard } from './offers'
import { SERVICE_ICONS } from './orders'

/** The bazar's categories on Home, each with its photo. A tap starts a bazar list row with the category's name. */
const CATEGORIES: { key: CategoryPhotoName; name: Text; tone: string }[] = [
  { key: 'fish', name: { bn: 'মাছ', en: 'Fish' }, tone: 'tone-blue' },
  { key: 'meat', name: { bn: 'মাংস', en: 'Meat' }, tone: 'tone-coral' },
  { key: 'vegetables', name: { bn: 'সবজি', en: 'Vegetables' }, tone: 'tone-green' },
  { key: 'rice', name: { bn: 'চাল-ডাল', en: 'Rice & lentils' }, tone: 'tone-orange' },
  { key: 'daily', name: { bn: 'দৈনন্দিন পণ্য', en: 'Daily needs' }, tone: 'tone-violet' },
]

/** A category's photo; the label beside it already names it, so the alt text stays empty. */
function CategoryImage({ name, sizes }: { name: CategoryPhotoName; sizes: string }) {
  const { src, srcSet } = categoryPhoto(name)
  return <img src={src} srcSet={srcSet} sizes={sizes} alt="" loading="lazy" decoding="async" />
}

const TILE_SIZES = '(min-width: 1024px) 16vw, (min-width: 801px) 120px, 33vw'

/**
 * Home, where a signed-in customer lands: their location, a search that writes the bazar list, the
 * fresh market banner, the bazar's categories, the four services and আজকের অফার. There is no product
 * catalog: categories and searches become bazar list rows, which staff price as usual.
 */
export function HomeScreen() {
  const { t, text } = useLang()
  const paths = usePaths()
  const router = useRouter()
  const blurbs = useServiceBlurbs()
  const addToBazar = useAddToBazar()
  const offers = useOffers().data ?? []

  const openBazar = (item?: string) => {
    if (item) addToBazar(item)
    router.push(paths.service('bazar'))
  }

  return (
    <div className="home-screen">
      <LocationRow />
      <HomeSearch onAdd={openBazar} />

      <section className="home-hero svc-bazar">
        <Photo name="bazar" sizes="(min-width: 1024px) 1100px, 100vw" priority />
        <div className="home-hero-copy">
          <h2>{t('তাজা বাজার সরাসরি আপনার বাসায়', 'Fresh groceries, straight to your door')}</h2>
          <p>{blurbs.bazar}</p>
          <Link className="promo-cta" href={paths.service('bazar')}>
            {t('এখনই অর্ডার করুন', 'Order now')}
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-categories">
        <div className="home-section-head">
          <h2 id="home-categories">{t('কাঁচা বাজার', 'Fresh market')}</h2>
        </div>
        <div className="home-categories">
          {CATEGORIES.map(category => (
            <button key={category.key} type="button" className={`home-category ${category.tone}`} onClick={() => openBazar(text(category.name))}>
              <CategoryImage name={category.key} sizes={TILE_SIZES} />
              <span>{text(category.name)}</span>
            </button>
          ))}
          <button type="button" className="home-category tone-neutral" onClick={() => openBazar()}>
            <CategoryImage name="more" sizes={TILE_SIZES} />
            <span>{t('আরও', 'More')}</span>
          </button>
        </div>
      </section>

      <HomeServices />

      {offers.length > 0 && (
        <section className="home-section" aria-labelledby="home-offers">
          <div className="home-section-head">
            <h2 id="home-offers">{t('আজকের বিশেষ অফার', "Today's special offers")}</h2>
            <Link className="home-see-all" href={paths.offers}>
              {t('সব দেখুন', 'See all')}
              <ChevronRight size={15} />
            </Link>
          </div>
          <div className="home-offers">
            {offers.map(offer => (
              <OfferCard key={offer.id} offer={offer} paths={paths} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** The delivery location (আমার লোকেশন) at the top; a tap changes it on the map, as in Profile. */
function LocationRow() {
  const { t } = useLang()
  const { user } = useSession()
  const saveLocation = useSaveMyLocation()
  const [open, setOpen] = useState(false)
  const location = user.location
  return (
    <>
      <button type="button" className="home-location" onClick={() => setOpen(true)}>
        <MapPin size={18} aria-hidden="true" />
        <span>
          <small>{t('ডেলিভারি লোকেশন', 'Delivery location')}</small>
          <strong>{location ? shortArea(location.address) : t('ম্যাপে লোকেশন দিন', 'Set your location')}</strong>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <LocationSheet
          title={t('আমার লোকেশন', 'My location')}
          initial={fromMyLocation(location)}
          submitLabel={t('সেভ করুন', 'Save')}
          onSubmit={saveLocation}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/**
 * "কী খুঁজছেন?": suggests the services and categories that match, and always offers to put the
 * words on the bazar list (Enter does that too).
 */
function HomeSearch({ onAdd }: { onAdd: (item: string) => void }) {
  const { t, text } = useLang()
  const paths = usePaths()
  const listId = useId()
  const [query, setQuery] = useState('')
  const words = query.trim()
  const needle = words.toLocaleLowerCase()
  const matches = (label: Text) => !!needle && (label.bn.includes(words) || label.en.toLocaleLowerCase().includes(needle))
  const services = SERVICE_IDS.filter(service => matches(SERVICE_LABELS[service]))
  const categories = CATEGORIES.filter(category => matches(category.name))

  return (
    <form
      className="home-search"
      role="search"
      onSubmit={event => {
        event.preventDefault()
        if (words) onAdd(words)
      }}
    >
      <label className="home-search-box">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('কী খুঁজছেন? (মাছ, সবজি, মাংস...)', 'What do you need? (fish, vegetables, meat...)')}
          aria-label={t('খুঁজুন', 'Search')}
          aria-controls={words ? listId : undefined}
          enterKeyHint="go"
        />
      </label>
      {words && (
        <ul className="home-suggestions" id={listId}>
          {services.map(service => {
            const Icon = SERVICE_ICONS[service]
            return (
              <li key={service}>
                <Link className={`svc-${service}`} href={paths.service(service)}>
                  <Icon size={17} aria-hidden="true" />
                  {text(SERVICE_LABELS[service])}
                </Link>
              </li>
            )
          })}
          {categories.map(category => (
            <li key={category.key}>
              <button type="button" className={category.tone} onClick={() => onAdd(text(category.name))}>
                <CategoryImage name={category.key} sizes="28px" />
                {text(category.name)}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="svc-bazar" onClick={() => onAdd(words)}>
              <Plus size={17} aria-hidden="true" />
              {t(`বাজারের লিস্টে যোগ করুন: “${words}”`, `Add “${words}” to the bazar list`)}
            </button>
          </li>
        </ul>
      )}
    </form>
  )
}

/** আমাদের সেবা: the four services with their live charges (the bottom nav no longer lists them). */
function HomeServices() {
  const { t, text } = useLang()
  const paths = usePaths()
  const { catalog } = useSession()
  const charges = useServiceCharges(catalog.pricing)
  return (
    <section className="home-section" aria-labelledby="home-services">
      <div className="home-section-head">
        <h2 id="home-services">{t('আমাদের সেবা', 'Our services')}</h2>
      </div>
      <div className="home-services">
        {SERVICE_IDS.map((service: ServiceId) => (
          <Link key={service} className={`home-service svc-${service}`} href={paths.service(service)}>
            <Photo name={service} sizes="64px" className="home-service-photo" />
            <strong>{text(SERVICE_LABELS[service])}</strong>
            {charges && <small>{charges[service]}</small>}
          </Link>
        ))}
      </div>
    </section>
  )
}

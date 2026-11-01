'use client'

import { type HomeBannerDto, type HomeBannerTarget, type HomeCategoryDto, SERVICE_IDS, SERVICE_LABELS, shortArea, type Text } from '@/shared'
import { ChevronDown, ChevronRight, MapPin, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { fromMyLocation } from '@/customer/components/address-field'
import { Carousel, type Slide, useServiceCharges } from '@/customer/components/banner'
import { LocationSheet } from '@/customer/components/location-sheet'
import { useAddToBazar } from '@/customer/lib/drafts'
import { useLang } from '@/customer/lib/i18n'
import { usePaths } from '@/customer/lib/paths'
import { useHomeContent, useOffers, useSaveMyLocation, useSession } from '@/customer/lib/queries'
import { OfferCard } from './offers'
import { SERVICE_ICONS } from './orders'

/**
 * Home, where a signed-in customer lands: their location, a search that writes the bazar list, then
 * what staff set on /admin/home: the banners, the bazar's categories, the service pictures and each
 * section's heading and visibility. আজকের অফার comes from the Offers page. There is no product catalog:
 * categories and searches become bazar list rows, which staff price as usual. If the content can't
 * load, the location, the search and the services still work.
 */
export function HomeScreen() {
  const { text } = useLang()
  const paths = usePaths()
  const router = useRouter()
  const addToBazar = useAddToBazar()
  const home = useHomeContent().data
  const offers = useOffers().data ?? []
  const categories = home?.categories ?? []

  const openBazar = (item?: string) => {
    if (item) addToBazar(item)
    router.push(paths.service('bazar'))
  }

  return (
    <div className="home-screen">
      <LocationRow />
      <HomeSearch categories={categories} onAdd={openBazar} />

      {!!home?.banners.length && <HomeBanners banners={home.banners} />}

      {!!categories.length && home?.sections.categories.visible && (
        <section className="home-section" aria-labelledby="home-categories">
          <div className="home-section-head">
            <h2 id="home-categories">{text(home.sections.categories.heading)}</h2>
          </div>
          <div className="home-categories">
            {categories.map(category => (
              <button key={category.id} type="button" className={`home-category tone-${category.tone}`} onClick={() => openBazar(category.addsItem ? text(category.name) : undefined)}>
                <CategoryImage category={category} />
                <span>{text(category.name)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {home?.sections.services.visible !== false && <HomeServices heading={home?.sections.services.heading} images={home?.serviceImages} />}

      {offers.length > 0 && home?.sections.offers.visible && <HomeOffers heading={home.sections.offers.heading} />}
    </div>
  )
}

/** A category's picture; the label below it already names it, so the alt text stays empty. */
function CategoryImage({ category }: { category: HomeCategoryDto }) {
  return category.imageUrl ? <img src={category.imageUrl} alt="" loading="lazy" decoding="async" /> : <span className="home-category-blank" aria-hidden="true" />
}

/** Staff's banners: one stays still, two or more slide. */
function HomeBanners({ banners }: { banners: HomeBannerDto[] }) {
  const { t, text } = useLang()
  const paths = usePaths()
  const link = (target: HomeBannerTarget) => (target === 'offers' ? paths.offers : paths.service(target))
  const slides: Slide[] = banners.map(banner => ({
    key: banner.id,
    offer: false,
    tone: banner.target && banner.target !== 'offers' ? `svc-${banner.target}` : banner.target === 'offers' ? 'tone-orange' : 'svc-bazar',
    image: banner.imageUrl ? { src: banner.imageUrl } : null,
    title: text(banner.title),
    subtitle: banner.body ? text(banner.body) : '',
    href: banner.target ? link(banner.target) : undefined,
    cta: banner.target ? (banner.cta ? text(banner.cta) : t('এখনই অর্ডার করুন', 'Order now')) : undefined,
  }))
  return <Carousel slides={slides} label={t('ব্যানার', 'Banners')} className="home-banners" />
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
function HomeSearch({ categories, onAdd }: { categories: HomeCategoryDto[]; onAdd: (item?: string) => void }) {
  const { t, text } = useLang()
  const paths = usePaths()
  const listId = useId()
  const [query, setQuery] = useState('')
  const words = query.trim()
  const needle = words.toLocaleLowerCase()
  const matches = (label: Text) => !!needle && (label.bn.includes(words) || label.en.toLocaleLowerCase().includes(needle))
  const services = SERVICE_IDS.filter(service => matches(SERVICE_LABELS[service]))
  const found = categories.filter(category => matches(category.name))

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
          {found.map(category => (
            <li key={category.id}>
              <button type="button" className={`tone-${category.tone}`} onClick={() => onAdd(category.addsItem ? text(category.name) : undefined)}>
                <CategoryImage category={category} />
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

/** The four services with their live charges (the bottom nav no longer lists them), so it shows before the content has loaded too. */
function HomeServices({ heading, images }: { heading?: Text | undefined; images?: Record<(typeof SERVICE_IDS)[number], string> | undefined }) {
  const { t, text } = useLang()
  const paths = usePaths()
  const { catalog } = useSession()
  const charges = useServiceCharges(catalog.pricing)
  return (
    <section className="home-section" aria-labelledby="home-services">
      <div className="home-section-head">
        <h2 id="home-services">{heading ? text(heading) : t('আমাদের সেবা', 'Our services')}</h2>
      </div>
      <div className="home-services">
        {SERVICE_IDS.map(service => {
          const Icon = SERVICE_ICONS[service]
          return (
            <Link key={service} className={`home-service svc-${service}`} href={paths.service(service)}>
              {images ? (
                <img className="home-service-photo" src={images[service]} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="home-service-photo home-service-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
              )}
              <strong>{text(SERVICE_LABELS[service])}</strong>
              {charges && <small>{charges[service]}</small>}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function HomeOffers({ heading }: { heading: Text }) {
  const { t, text } = useLang()
  const paths = usePaths()
  const offers = useOffers().data ?? []
  return (
    <section className="home-section" aria-labelledby="home-offers">
      <div className="home-section-head">
        <h2 id="home-offers">{text(heading)}</h2>
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
  )
}

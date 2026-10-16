'use client'

import { type OfferDto, SERVICE_LABELS } from '@/shared'
import { ArrowRight, BadgePercent, CalendarDays } from 'lucide-react'
import Link from 'next/link'

import { FormError, LoadingNote, PageCard } from '@/customer/components/ui'
import { useLang } from '@/customer/lib/i18n'
import { type Paths, usePaths } from '@/customer/lib/paths'
import { errorCode, useOffers } from '@/customer/lib/queries'
import { SERVICE_ICONS } from './orders'

/** আজকের অফার: the offers staff are running today, newest first. */
export function OffersScreen() {
  const { t } = useLang()
  const paths = usePaths()
  const offers = useOffers()
  const items = offers.data ?? []
  return (
    <PageCard icon={BadgePercent} title={t('আজকের অফার', "Today's offers")} subtitle={t('আমাদের চলমান অফারগুলো এক জায়গায়।', 'Our running offers, all in one place.')}>
      {offers.isPending && <LoadingNote />}
      {offers.isError && <FormError code={errorCode(offers.error)} />}
      {offers.isSuccess && !items.length && (
        <p className="empty-note">{t('আজ কোনো অফার নেই। নতুন অফার এলে নোটিফিকেশন পাবেন।', 'No offers today. You will be notified when a new one starts.')}</p>
      )}
      {items.length > 0 && (
        <div className="offer-grid">
          {items.map(offer => (
            <OfferCard key={offer.id} offer={offer} paths={paths} />
          ))}
        </div>
      )}
    </PageCard>
  )
}

/**
 * One offer: its picture (or the service's colour and icon), title, text, last day, and an
 * "Order now" button when it belongs to a service. The landing page shows the same cards.
 */
export function OfferCard({ offer, paths }: { offer: OfferDto; paths: Paths }) {
  const { t, text, formatDate } = useLang()
  const Icon = offer.service ? SERVICE_ICONS[offer.service] : BadgePercent
  const ends = formatDate(offer.endsOn)
  return (
    <article className={`offer-card ${offer.service ? `svc-${offer.service}` : 'tone-orange'}`}>
      <div className="offer-media">
        {offer.imageUrl ? (
          // The title below says what the picture shows.
          <img src={offer.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="offer-placeholder" aria-hidden="true">
            <Icon size={40} />
          </span>
        )}
        {offer.service && <span className="offer-service">{text(SERVICE_LABELS[offer.service])}</span>}
      </div>
      <div className="offer-body">
        <h3>{text(offer.title)}</h3>
        {offer.body && <p>{text(offer.body)}</p>}
        <small className="offer-dates">
          <CalendarDays size={13} />
          {offer.startsOn === offer.endsOn ? t(`শুধু ${ends}`, `${ends} only`) : t(`${ends} পর্যন্ত`, `Until ${ends}`)}
        </small>
        {offer.service && (
          <Link className="primary-button offer-cta" href={paths.service(offer.service)}>
            {t('অর্ডার করুন', 'Order now')}
            <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </article>
  )
}

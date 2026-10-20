'use client'

import { describeDeliveryHours, SERVICE_IDS, SERVICE_LABELS, type ServiceId } from '@/shared'
import { Clock } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'

import { SERVICE_ICONS } from '@/customer/features/orders'
import { useLang } from '@/customer/lib/i18n'
import { type Paths } from '@/customer/lib/paths'
import { useCatalog } from '@/customer/lib/queries'
import { Photo, useServiceBlurbs } from './banner'

/**
 * The landing hero's service switcher: one tab per service, and a panel with the service's photo,
 * what it does, its charges and delivery hours from the live catalog, and a link to order it.
 * It only changes when the visitor picks a tab (arrow keys, Home and End move between tabs).
 */
export function ServiceSwitcher({ paths }: { paths: Paths }) {
  const { t, text, taka } = useLang()
  const catalog = useCatalog().data
  const blurbs = useServiceBlurbs()
  const [active, setActive] = useState<ServiceId>('bazar')
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({})

  const pick = (service: ServiceId) => {
    setActive(service)
    tabs.current[service]?.focus()
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = SERVICE_IDS.indexOf(active)
    const last = SERVICE_IDS.length - 1
    const next = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: last }[event.key]
    if (next === undefined) return
    event.preventDefault()
    pick(SERVICE_IDS[(next + SERVICE_IDS.length) % SERVICE_IDS.length])
  }

  const pricing = catalog?.pricing
  const cheapestVehicle = catalog?.vehicles.filter(vehicle => vehicle.isActive).sort((a, b) => a.rate - b.rate)[0]
  const charges: Record<ServiceId, [string, string][]> = pricing
    ? {
        bazar: [
          [t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), taka(pricing.bazarShoppingFee)],
          [t('ডেলিভারী খরচ', 'Delivery charge'), taka(pricing.bazarDeliveryFee)],
          [t('বাজারের দাম', 'Goods'), t('দেখে কনফার্ম করবেন', 'You confirm the price')],
        ],
        shifting: [
          ...(cheapestVehicle ? [[t('গাড়ী ভাড়া', 'Vehicle'), t(`${taka(cheapestVehicle.rate)} থেকে`, `from ${taka(cheapestVehicle.rate)}`)] as [string, string]] : []),
          [t('জনপ্রতি লেবার মজুরী', 'Per labourer'), taka(pricing.wagePerLabourer)],
          [t('প্রতি ফ্লোর (loading)', 'Per floor (loading)'), taka(pricing.loadingRatePerFloor)],
        ],
        medicine: [
          [t('ডেলিভারী চার্জ', 'Delivery charge'), taka(pricing.medicineDeliveryFee)],
          [t('ঔষুধের দাম', 'Medicine'), t('দেখে কনফার্ম করবেন', 'You confirm the price')],
        ],
        parcel: [[t('ডেলিভারী খরচ', 'Delivery charge'), taka(pricing.parcelDeliveryFee)]],
      }
    : { bazar: [], shifting: [], medicine: [], parcel: [] }
  const windows = catalog?.deliveryHours[active]
  const described = windows?.length ? describeDeliveryHours(windows) : null
  const hours = !windows ? null : described ? t(`${described.bn} পর্যন্ত`, described.en) : t('যেকোনো সময়', 'Any time')
  const Icon = SERVICE_ICONS[active]

  return (
    <div className={`lp-switcher svc-${active}`}>
      <div className="lp-switcher-tabs" role="tablist" aria-label={t('সেবা বেছে নিন', 'Choose a service')} onKeyDown={onKeyDown}>
        {SERVICE_IDS.map(service => {
          const TabIcon = SERVICE_ICONS[service]
          const selected = service === active
          return (
            <button
              key={service}
              ref={element => {
                tabs.current[service] = element
              }}
              type="button"
              role="tab"
              id={`lp-tab-${service}`}
              aria-selected={selected}
              aria-controls="lp-switcher-panel"
              tabIndex={selected ? 0 : -1}
              className={`svc-${service}`}
              onClick={() => setActive(service)}
            >
              <TabIcon size={18} />
              <span>{text(SERVICE_LABELS[service])}</span>
            </button>
          )
        })}
      </div>
      <div className="lp-switcher-panel" id="lp-switcher-panel" role="tabpanel" aria-labelledby={`lp-tab-${active}`}>
        <div className="lp-switcher-media">
          {/* Keyed so a new service's photo fades in instead of swapping in place. */}
          <Photo key={active} name={active} sizes="(min-width: 1024px) 520px, 100vw" priority={active === 'bazar'} />
          <span className="lp-switcher-icon" aria-hidden="true">
            <Icon size={22} />
          </span>
        </div>
        <div className="lp-switcher-body">
          <h2>{text(SERVICE_LABELS[active])}</h2>
          <p>{blurbs[active]}</p>
          {charges[active].length > 0 && (
            <dl className="lp-switcher-charges">
              {charges[active].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {hours && (
            <p className="lp-switcher-hours">
              <Clock size={15} />
              <span>
                {/* The shifting screens never say ডেলিভারি (owner's wording). */}
                {active === 'shifting' ? t('সময় সূচী', 'Hours') : t('ডেলিভারির সময়', 'Delivery hours')}: {hours}
              </span>
            </p>
          )}
          <Link className="lp-switcher-cta" href={paths.service(active)}>
            {t(`${text(SERVICE_LABELS[active])} অর্ডার করুন`, `Order ${text(SERVICE_LABELS[active]).toLowerCase()}`)}
          </Link>
        </div>
      </div>
    </div>
  )
}

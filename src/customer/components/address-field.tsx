'use client'

import { type CustomerLocationDto, type CustomerLocationInput, joinAddress } from '@/shared'
import { Home, LocateFixed, Map as MapIcon, MapPin } from 'lucide-react'
import { useId, useState } from 'react'

import { samePoint } from '@/customer/lib/geo'
import { useLang } from '@/customer/lib/i18n'
import { LocationSheet } from './location-sheet'

/** A picked place: the customer's own location and every order address. Null until picked. */
export type AddressValue = CustomerLocationInput | null

/** The customer's own location as an address value. */
export const fromMyLocation = (location: CustomerLocationDto | null): AddressValue =>
  location ? { address: location.address, details: location.details || undefined, lat: location.lat, lng: location.lng } : null

/** An order's address text and pin for a picked place. Nothing picked fails the form's schema. */
export const addressText = (value: AddressValue) => (value ? joinAddress(value) : '')
export const addressPin = (value: AddressValue) => (value ? { lat: value.lat, lng: value.lng } : undefined)

/**
 * An address box. Nothing is typed into it: the place is picked on the map (or is the customer's
 * own location, `myLocation`), and the map sheet adds the house, flat or road. `inline` lays it
 * out like the parcel screen's label-left rows.
 */
export function AddressField({
  label,
  value,
  onChange,
  myLocation,
  inline = false,
}: {
  label: string
  value: AddressValue
  onChange: (value: AddressValue) => void
  myLocation?: CustomerLocationDto | null
  inline?: boolean
}) {
  const { t } = useLang()
  const id = useId()
  const [sheet, setSheet] = useState<{ locate: boolean } | null>(null)
  const mine = fromMyLocation(myLocation ?? null)
  const isMine = !!mine && !!value && samePoint(value, mine) && value.address === mine.address && (value.details ?? '') === (mine.details ?? '')

  const card = (
    <button type="button" id={id} className={`address-card ${value ? '' : 'empty'}`} onClick={() => setSheet({ locate: false })}>
      <MapPin size={17} aria-hidden="true" />
      {value ? (
        <span>
          {value.details && <strong>{value.details}</strong>}
          <span>{value.address}</span>
        </span>
      ) : (
        <span>{t('ম্যাপে লোকেশন বাছুন', 'Pick the location on the map')}</span>
      )}
    </button>
  )
  const tools = (
    <div className="chip-row address-tools">
      {mine && (
        <button type="button" className={`chip ${isMine ? 'active' : ''}`} aria-pressed={isMine} title={mine.address} onClick={() => onChange(mine)}>
          <Home size={13} />
          {t('আমার লোকেশন', 'My location')}
        </button>
      )}
      <button type="button" className="chip locate" onClick={() => setSheet({ locate: true })}>
        <LocateFixed size={13} />
        {t('বর্তমান লোকেশন', 'Current location')}
      </button>
      <button type="button" className="chip" onClick={() => setSheet({ locate: false })}>
        <MapIcon size={13} />
        {value ? t('পরিবর্তন করুন', 'Change') : t('ম্যাপে বাছুন', 'Pick on map')}
      </button>
    </div>
  )

  return (
    <div className={inline ? 'field-row address-field' : 'field address-field'}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {inline ? (
        <div className="address-control">
          {card}
          {tools}
        </div>
      ) : (
        <>
          {card}
          {tools}
        </>
      )}
      {sheet && <LocationSheet title={label} initial={value} locate={sheet.locate} onSubmit={onChange} onClose={() => setSheet(null)} />}
    </div>
  )
}

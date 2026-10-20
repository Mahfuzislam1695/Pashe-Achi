'use client'

import { type CustomerLocationDto, type CustomerLocationInput, joinAddress } from '@/shared'
import { ChevronRight, MapPin } from 'lucide-react'
import { useId, useState } from 'react'

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
 * An address box. Nothing is typed into it: tapping the card opens the map sheet, where the place
 * is picked on the map (or by Current location) and the house, flat or road is added. `inline`
 * lays it out like the parcel screen's label-left rows.
 */
export function AddressField({
  label,
  value,
  onChange,
  inline = false,
}: {
  label: string
  value: AddressValue
  onChange: (value: AddressValue) => void
  inline?: boolean
}) {
  const { t } = useLang()
  const id = useId()
  const [open, setOpen] = useState(false)

  const card = (
    <button type="button" id={id} className={`address-card ${value ? '' : 'empty'}`} onClick={() => setOpen(true)}>
      <MapPin size={17} aria-hidden="true" />
      {value ? (
        <span>
          {value.details && <strong>{value.details}</strong>}
          <span>{value.address}</span>
        </span>
      ) : (
        <span>{t('ম্যাপে লোকেশন বাছুন', 'Pick the location on the map')}</span>
      )}
      <ChevronRight size={16} className="address-card-open" aria-hidden="true" />
    </button>
  )

  return (
    <div className={inline ? 'field-row address-field' : 'field address-field'}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {inline ? <div className="address-control">{card}</div> : card}
      {open && <LocationSheet title={label} initial={value} onSubmit={onChange} onClose={() => setOpen(false)} />}
    </div>
  )
}

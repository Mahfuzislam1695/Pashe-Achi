'use client'

import { type GeoPoint, MAX_SAVED_LOCATIONS } from '@/shared'
import { LocateFixed, Map as MapIcon, MapPin, X } from 'lucide-react'
import { useId, useState } from 'react'

import { samePoint } from '@/customer/lib/geo'
import { useLang } from '@/customer/lib/i18n'
import { useLocations, useSaveLocation } from '@/customer/lib/queries'
import { LocationSheet } from './location-sheet'

/** An address as the order forms keep it: the text the customer sees, and the map pin if they set one. */
export interface AddressValue {
  text: string
  pin: GeoPoint | null
}

/**
 * An order form's address box, with one-tap chips under it: the saved locations (default first),
 * Current location and Pick on map. `inline` lays it out like the parcel screen's label-left rows.
 */
export function AddressField({ label, value, onChange, placeholder, inline = false }: { label: string; value: AddressValue; onChange: (value: AddressValue) => void; placeholder: string; inline?: boolean }) {
  const { t } = useLang()
  const id = useId()
  const locations = useLocations()
  const saveLocation = useSaveLocation()
  const [sheet, setSheet] = useState<{ locate: boolean } | null>(null)
  const saved = locations.data ?? []

  const input = (
    <input
      id={id}
      value={value.text}
      // Clearing the text drops the pin too; editing it (adding a flat number) keeps the pin.
      onChange={event => onChange({ text: event.target.value, pin: event.target.value.trim() ? value.pin : null })}
      placeholder={placeholder}
      autoComplete="street-address"
    />
  )
  const tools = (
    <div className="chip-row address-tools">
      {value.pin && (
        <span className="pin-badge">
          <MapPin size={13} />
          {t('ম্যাপে পিন করা', 'Pinned on map')}
          <button type="button" aria-label={t('পিন সরান', 'Remove pin')} onClick={() => onChange({ ...value, pin: null })}>
            <X size={13} />
          </button>
        </span>
      )}
      {saved.map(location => {
        const active = value.text === location.address && samePoint(value.pin, location)
        return (
          <button
            type="button"
            key={location.id}
            className={`chip ${active ? 'active' : ''}`}
            aria-pressed={active}
            title={location.address}
            onClick={() => onChange({ text: location.address, pin: { lat: location.lat, lng: location.lng } })}
          >
            <MapPin size={13} />
            {location.label}
          </button>
        )
      })}
      <button type="button" className="chip locate" onClick={() => setSheet({ locate: true })}>
        <LocateFixed size={13} />
        {t('বর্তমান লোকেশন', 'Current location')}
      </button>
      <button type="button" className="chip" onClick={() => setSheet({ locate: false })}>
        <MapIcon size={13} />
        {value.pin ? t('পিন ঠিক করুন', 'Adjust pin') : t('ম্যাপে বাছুন', 'Pick on map')}
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
          {input}
          {tools}
        </div>
      ) : (
        <>
          {input}
          {tools}
        </>
      )}
      {sheet && (
        <LocationSheet
          purpose="pick"
          title={label}
          initial={{ address: value.text, pin: value.pin }}
          locate={sheet.locate}
          canSave={saved.length < MAX_SAVED_LOCATIONS}
          onSubmit={async picked => {
            if (picked.save) await saveLocation.mutateAsync({ label: picked.label, address: picked.address, ...picked.pin })
            onChange({ text: picked.address, pin: picked.pin })
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}

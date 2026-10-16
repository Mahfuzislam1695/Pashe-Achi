'use client'

import { FORM_ERROR_PRIORITY, type GeoPoint, LOCATION_LABEL_PRESETS, type MessageCode, savedLocationSchema, validateForm } from '@/shared'
import { Check, LocateFixed, MapPin, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { api } from '@/customer/lib/api'
import { getCurrentPosition } from '@/customer/lib/geo'
import { useLang } from '@/customer/lib/i18n'
import { useMode } from '@/customer/lib/paths'
import { errorCode } from '@/customer/lib/queries'
import type { MapTarget } from './map-picker'
import { Field, FormError } from './ui'

const MapPicker = dynamic(() => import('./map-picker').then(module => module.MapPicker), { ssr: false, loading: () => <div className="map-canvas map-loading" /> })

/** Wait this long after the map stops before looking up the address, so dragging doesn't send a lookup per frame. */
const LOOKUP_DELAY_MS = 600
const PRIORITY = FORM_ERROR_PRIORITY.location

export interface LocationSheetValue {
  label: string
  address: string
  pin: GeoPoint
  /** Also save it to আমার লোকেশন. */
  save: boolean
}

interface LocationSheetProps {
  title: string
  /** 'save' (Profile): the name and address are required and it is always saved. 'pick' (an order form): saving is optional. */
  purpose: 'save' | 'pick'
  initial?: { label?: string; address?: string; pin?: GeoPoint | null }
  /** Ask for the device's position as soon as the sheet opens. */
  locate?: boolean
  /** False once the customer has saved the most locations allowed: "Save to my locations" is hidden. */
  canSave?: boolean
  /** Saves or applies the value. A rejected promise keeps the sheet open and shows the error. */
  onSubmit: (value: LocationSheetValue) => Promise<unknown> | void
  onClose: () => void
}

/**
 * The map sheet: drag the map under the pin (or tap Current location), check the address that
 * OpenStreetMap suggests, and save or use it. Full screen in the app's phone column; a centred
 * dialog on the web from 1024px. Render it only while open.
 */
export function LocationSheet({ title, purpose, initial, locate = false, canSave = true, onSubmit, onClose }: LocationSheetProps) {
  const { t, text, lang } = useLang()
  const mode = useMode()
  const titleId = useId()
  const addressId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [pin, setPin] = useState<GeoPoint | null>(initial?.pin ?? null)
  const [target, setTarget] = useState<MapTarget | null>(null)
  const [address, setAddress] = useState(initial?.address ?? '')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [label, setLabel] = useState(initial?.label ?? '')
  const [save, setSave] = useState(purpose === 'save')
  const [locating, setLocating] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<MessageCode | null>(null)

  // The address text is filled from the map only while it is empty or still the last suggestion:
  // whatever the customer typed is never overwritten (they get a "Use" link instead).
  const addressRef = useRef(address)
  const autoAddressRef = useRef<string | null>(null)
  const skipFirstLookup = useRef(!!initial?.pin && !!initial.address)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const editAddress = (value: string) => {
    addressRef.current = value
    setAddress(value)
    setError(null)
  }

  const findMe = async () => {
    setLocating(true)
    setError(null)
    try {
      const point = await getCurrentPosition()
      setPin(point)
      setTarget({ point, seq: Date.now() })
    } catch {
      setError('location.unavailable')
    } finally {
      setLocating(false)
    }
  }

  // Opening: focus the dialog (and ask for the position if `locate`), Escape closes it, the page
  // behind doesn't scroll, and focus goes back to the button that opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    if (locate) void findMe()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [])

  useEffect(() => {
    if (!pin) return
    if (skipFirstLookup.current) {
      skipFirstLookup.current = false
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLookingUp(true)
      try {
        const { address: found } = await api.geo.reverse(pin, lang, controller.signal)
        const current = addressRef.current
        if (!found || found === current) return setSuggestion(null)
        if (!current.trim() || current === autoAddressRef.current) {
          autoAddressRef.current = found
          editAddress(found)
          setSuggestion(null)
        } else {
          setSuggestion(found)
        }
      } catch {
        // Aborted (the pin moved again) or the lookup failed: the customer types the address.
      } finally {
        if (!controller.signal.aborted) setLookingUp(false)
      }
    }, LOOKUP_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [pin, lang])

  const submit = async () => {
    if (!pin) return setError('location.pin')
    if (save) {
      const check = validateForm(savedLocationSchema, { label, address, ...pin }, PRIORITY)
      if (!check.success) return setError(check.code)
    } else if (!address.trim()) {
      return setError('location.address')
    }
    setPending(true)
    try {
      await onSubmit({ label: label.trim(), address: address.trim(), pin, save })
      onClose()
    } catch (failure) {
      setError(errorCode(failure, PRIORITY))
    } finally {
      setPending(false)
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className={`sheet-layer mode-${mode}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <header className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="sheet-close" aria-label={t('বন্ধ করুন', 'Close')} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="sheet-body">
          <div className="map-frame">
            <MapPicker
              start={pin}
              target={target}
              onMove={center => {
                setPin(center)
                setError(null)
              }}
              label={t('ম্যাপ: পিনের নিচের জায়গাটি আপনার লোকেশন', 'Map: the place under the pin is your location')}
            />
            <span className="map-pin" aria-hidden="true">
              <MapPin size={36} strokeWidth={2.2} />
            </span>
            <button type="button" className="map-locate" onClick={findMe} disabled={locating} aria-busy={locating}>
              <LocateFixed size={16} />
              {locating ? t('খোঁজা হচ্ছে…', 'Finding you…') : t('বর্তমান লোকেশন', 'Current location')}
            </button>
          </div>
          <p className="map-hint">{t('ম্যাপ সরিয়ে পিনটি ঠিক জায়গায় বসান।', 'Drag the map to put the pin on the exact place.')}</p>

          <div className="sheet-fields">
            <div className="field">
              <label htmlFor={addressId} className="field-label">
                {t('ঠিকানা', 'Address')}
              </label>
              <input
                id={addressId}
                value={address}
                onChange={event => editAddress(event.target.value)}
                placeholder={t('বাসা, রোড, এলাকা', 'House, road, area')}
                autoComplete="street-address"
              />
              <p className="map-status" aria-live="polite">
                {lookingUp
                  ? t('ম্যাপ থেকে ঠিকানা খোঁজা হচ্ছে…', 'Looking up the address…')
                  : suggestion && (
                      <>
                        {t('ম্যাপের ঠিকানা:', 'From the map:')} <span>{suggestion}</span>{' '}
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            autoAddressRef.current = suggestion
                            editAddress(suggestion)
                            setSuggestion(null)
                          }}
                        >
                          {t('বসান', 'Use')}
                        </button>
                      </>
                    )}
              </p>
            </div>

            {purpose === 'pick' && canSave && (
              <label className="check-label save-toggle">
                <input type="checkbox" checked={save} onChange={event => setSave(event.target.checked)} />
                {t('আমার লোকেশনে সেভ করুন', 'Save to my locations')}
              </label>
            )}

            {save && (
              <div className="label-picker">
                <Field label={t('লোকেশনের নাম', 'Location name')}>
                  <input value={label} onChange={event => setLabel(event.target.value)} placeholder={t('যেমন: বাসা', 'e.g. Home')} maxLength={40} />
                </Field>
                <div className="chip-row">
                  {LOCATION_LABEL_PRESETS.map(preset => (
                    <button type="button" key={preset.en} className={`chip ${label === text(preset) ? 'active' : ''}`} aria-pressed={label === text(preset)} onClick={() => setLabel(text(preset))}>
                      {text(preset)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <FormError code={error} />
          </div>
        </div>

        <footer className="sheet-foot">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('বাতিল', 'Cancel')}
          </button>
          <button type="button" className="primary-button" onClick={submit} disabled={pending} aria-busy={pending}>
            <Check size={17} />
            {pending ? t('অপেক্ষা করুন…', 'Please wait…') : purpose === 'save' ? t('সেভ করুন', 'Save') : t('এই ঠিকানা ব্যবহার করুন', 'Use this address')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

'use client'

import { type CustomerLocationInput, customerLocationSchema, FORM_ERROR_PRIORITY, type GeoPoint, type MessageCode, validateForm } from '@/shared'
import { Check, LocateFixed, MapPin, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { api } from '@/customer/lib/api'
import { getCurrentPosition } from '@/customer/lib/geo'
import { useLang } from '@/customer/lib/i18n'
import { errorCode } from '@/customer/lib/queries'
import type { MapTarget } from './map-picker'
import { FormError } from './ui'

const MapPicker = dynamic(() => import('./map-picker').then(module => module.MapPicker), { ssr: false, loading: () => <div className="map-canvas map-loading" /> })

/** Wait this long after the map stops before looking up the address, so dragging doesn't send a lookup per frame. */
const LOOKUP_DELAY_MS = 600
/** A device position rougher than this (metres) asks the customer to check the pin. */
const ROUGH_ACCURACY_M = 100
const PRIORITY = FORM_ERROR_PRIORITY.location

/** Where the address text stands: from the map, being looked up, or typed because the map found nothing. */
type Lookup = 'found' | 'looking' | 'failed'

interface LocationSheetProps {
  title: string
  initial?: CustomerLocationInput | null
  /** Ask for the device's position as soon as the sheet opens. On by default when there is no starting place. */
  locate?: boolean
  submitLabel?: string
  /** Applies or saves the location. A rejected promise keeps the sheet open and shows the error. */
  onSubmit: (value: CustomerLocationInput) => Promise<unknown> | void
  onClose: () => void
}

/**
 * The map sheet: drag the map under the pin (or tap Current location). With no starting place it
 * goes to the device's position on its own. The address comes from the map; the customer adds
 * only the house, flat or road. If the map finds no address for the pin, they name the area
 * themselves, but the pin is still required. Full screen in the app's phone column; a centred
 * dialog on the web from 1024px. Render it only while open.
 */
export function LocationSheet({ title, initial, locate = !initial, submitLabel, onSubmit, onClose }: LocationSheetProps) {
  const { t, lang, digits } = useLang()
  const titleId = useId()
  const areaId = useId()
  const detailsId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const startPin = initial ? { lat: initial.lat, lng: initial.lng } : null
  const [pin, setPin] = useState<GeoPoint | null>(startPin)
  const [target, setTarget] = useState<MapTarget | null>(null)
  const [address, setAddress] = useState(initial?.address ?? '')
  const [lookup, setLookup] = useState<Lookup>('found')
  const [details, setDetails] = useState(initial?.details ?? '')
  const [locating, setLocating] = useState(false)
  /** How far off (metres) the device said its position may be, until the customer drags the map. */
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<MessageCode | null>(null)

  // The starting pin already has its address; look up only once the pin moves.
  const skipFirstLookup = useRef(!!initial)
  // Set once the customer drags the map, so a position that arrives later doesn't move it away.
  const handMoved = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  /** `auto` is the lookup on opening: it gives way to the customer's own dragging. A tap on Current location always moves the map. */
  const findMe = async (auto = false) => {
    setLocating(true)
    setError(null)
    try {
      const position = await getCurrentPosition()
      if (auto && handMoved.current) return
      setPin(position.point)
      setTarget({ point: position.point, seq: Date.now() })
      setAccuracy(position.accuracy)
    } catch {
      if (!(auto && handMoved.current)) setError('location.unavailable')
    } finally {
      setLocating(false)
    }
  }

  /** "৮০০ মিটার" / "800 m", or "১.৫ কিমি" / "1.5 km" from a kilometre: rounded, since the device only estimates it. */
  const offBy = (metres: number) => {
    const rounded = Math.round(metres / 10) * 10
    if (rounded < 1000) return t(`${digits(rounded)} মিটার`, `${rounded} m`)
    const km = Math.round(metres / 100) / 10
    return t(`${digits(km)} কিমি`, `${km} km`)
  }

  // Opening: focus the dialog (and ask for the position if `locate`), Escape closes it, the page
  // behind doesn't scroll, and focus goes back to the button that opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    if (locate) void findMe(true)
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

  // A new pin gets the map's address for it; the old address never stays on a moved pin.
  useEffect(() => {
    if (!pin) return
    if (skipFirstLookup.current) {
      skipFirstLookup.current = false
      return
    }
    setLookup('looking')
    setAddress('')
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const { address: found } = await api.geo.reverse(pin, lang, controller.signal)
        if (controller.signal.aborted) return
        setAddress(found ?? '')
        setLookup(found ? 'found' : 'failed')
      } catch {
        // Aborted means the pin moved again; anything else means the customer names the area.
        if (!controller.signal.aborted) setLookup('failed')
      }
    }, LOOKUP_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [pin, lang])

  const submit = async () => {
    if (!pin) return setError('location.pin')
    if (lookup === 'looking') return
    if (!address.trim()) return setError(lookup === 'failed' ? 'location.address' : 'location.pin')
    const check = validateForm(customerLocationSchema, { address, details: details || undefined, ...pin }, PRIORITY)
    if (!check.success) return setError(check.code)
    setPending(true)
    try {
      await onSubmit(check.data)
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
      className="sheet-layer mode-web"
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
              start={startPin}
              target={target}
              onMove={center => {
                setPin(center)
                setError(null)
              }}
              onDragStart={() => {
                handMoved.current = true
                setAccuracy(null)
              }}
              label={t('ম্যাপ: পিনের নিচের জায়গাটি আপনার লোকেশন', 'Map: the place under the pin is your location')}
            />
            <span className="map-pin" aria-hidden="true">
              <MapPin size={36} strokeWidth={2.2} />
            </span>
            <button type="button" className="map-locate" onClick={() => findMe()} disabled={locating} aria-busy={locating}>
              <LocateFixed size={16} />
              {locating ? t('খোঁজা হচ্ছে…', 'Finding you…') : t('বর্তমান লোকেশন', 'Current location')}
            </button>
          </div>
          <p className="map-hint">
            {accuracy !== null && accuracy > ROUGH_ACCURACY_M
              ? t(
                  `আপনার লোকেশন প্রায় ${offBy(accuracy)} এদিক-ওদিক হতে পারে। ম্যাপ সরিয়ে পিনটি ঠিক জায়গায় বসান।`,
                  `Your location may be off by about ${offBy(accuracy)}. Drag the map to put the pin on the exact place.`,
                )
              : t('ম্যাপ সরিয়ে পিনটি ঠিক জায়গায় বসান।', 'Drag the map to put the pin on the exact place.')}
          </p>

          <div className="sheet-fields">
            <div className="field">
              {lookup === 'failed' ? (
                <>
                  <label htmlFor={areaId} className="field-label">
                    {t('এলাকা', 'Area')}
                  </label>
                  <input
                    id={areaId}
                    value={address}
                    onChange={event => {
                      setAddress(event.target.value)
                      setError(null)
                    }}
                    placeholder={t('যেমন: মিরপুর ১০, ঢাকা', 'e.g. Mirpur 10, Dhaka')}
                    maxLength={300}
                  />
                  <p className="map-status">{t('ম্যাপে এই জায়গার ঠিকানা পাওয়া যায়নি, এলাকার নাম লিখুন।', "The map has no address for this place. Enter the area's name.")}</p>
                </>
              ) : (
                <>
                  <span className="field-label">{t('ম্যাপের ঠিকানা', 'Address from the map')}</span>
                  <p className={`map-address ${address ? '' : 'empty'}`} aria-live="polite">
                    <MapPin size={15} aria-hidden="true" />
                    {lookup === 'looking'
                      ? t('ম্যাপ থেকে ঠিকানা খোঁজা হচ্ছে…', 'Looking up the address…')
                      : address ||
                        (locating && !pin
                          ? t('আপনার বর্তমান লোকেশন খোঁজা হচ্ছে…', 'Finding your current location…')
                          : t('ম্যাপ সরিয়ে বা বর্তমান লোকেশন চেপে জায়গাটি বাছুন।', 'Move the map or tap Current location to pick the place.'))}
                  </p>
                </>
              )}
            </div>
            <div className="field">
              <label htmlFor={detailsId} className="field-label">
                {t('বাসা/ফ্ল্যাট, রোড (ঐচ্ছিক)', 'House, flat, road (optional)')}
              </label>
              <input
                id={detailsId}
                value={details}
                onChange={event => {
                  setDetails(event.target.value)
                  setError(null)
                }}
                placeholder={t('যেমন: বাসা ১২, রোড ৫, ৩য় তলা', 'e.g. House 12, Road 5, 3rd floor')}
                maxLength={120}
                autoComplete="address-line2"
              />
            </div>
            <FormError code={error} />
          </div>
        </div>

        <footer className="sheet-foot">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('বাতিল', 'Cancel')}
          </button>
          <button type="button" className="primary-button" onClick={submit} disabled={pending || lookup === 'looking' || (locating && !pin)} aria-busy={pending}>
            <Check size={17} />
            {pending ? t('অপেক্ষা করুন…', 'Please wait…') : (submitLabel ?? t('এই লোকেশন ব্যবহার করুন', 'Use this location'))}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

'use client'

import { changePasswordSchema, FORM_ERROR_PRIORITY, mapLink, MAX_SAVED_LOCATIONS, type MessageCode, type SavedLocationDto, updateProfileSchema, validateForm } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, Check, ExternalLink, KeyRound, MapPin, Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'

import { LocationSheet } from '@/customer/components/location-sheet'
import { Field, FormError, LoadingNote, PageCard } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useLang } from '@/customer/lib/i18n'
import { usePaths } from '@/customer/lib/paths'
import { errorCode, queryKeys, useLocations, useSaveLocation, useSession } from '@/customer/lib/queries'

const PRIORITY = FORM_ERROR_PRIORITY.profile

export function ProfileScreen() {
  const { t, lang } = useLang()
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState({ name: user.name, mobile: user.mobile, location: user.location })
  const [error, setError] = useState<MessageCode | null>(null)
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: api.me.update,
    onSuccess: updated => {
      queryClient.setQueryData(queryKeys.me, updated)
      setSaved(true)
    },
    onError: failure => setError(errorCode(failure, PRIORITY)),
  })

  const edit = (key: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft({ ...draft, [key]: e.target.value })
    setSaved(false)
    setError(null)
  }
  const submit = () => {
    const check = validateForm(updateProfileSchema, { ...draft, lang }, PRIORITY)
    if (!check.success) return setError(check.code)
    save.mutate(check.data)
  }

  return (
    <PageCard icon={UserRound} title={t('প্রোফাইল', 'My profile')} subtitle={t('আপনার নাম, মোবাইল ও লোকেশন।', 'Your name, mobile and location.')}>
      <div className="profile-card">
        <div className="profile-avatar">{user.name[0]}</div>
        <div>
          <h3>{user.name}</h3>
          <p>{user.mobile}</p>
        </div>
        <span className="points-badge">
          <Award size={16} />
          {t('point', 'Points')}: {user.points}
        </span>
      </div>
      <div className="profile-fields">
        <Field label={t('নাম', 'Name')}>
          <input value={draft.name} onChange={edit('name')} autoComplete="name" />
        </Field>
        <Field label={t('মোবাইল নম্বর', 'Mobile number')}>
          <input type="tel" inputMode="tel" value={draft.mobile} onChange={edit('mobile')} autoComplete="tel" />
        </Field>
        <Field label={t('লোকেশন', 'Location')}>
          <input value={draft.location} onChange={edit('location')} placeholder={t('যেমন: মিরপুর ১০, ঢাকা', 'e.g. Mirpur 10, Dhaka')} />
        </Field>
      </div>
      {saved && <p className="form-success">{t('প্রোফাইল সেভ হয়েছে।', 'Profile saved.')}</p>}
      <div className="confirm">
        <FormError code={error} />
        <button type="button" className="primary-button" onClick={submit} disabled={save.isPending}>
          <Check size={17} />
          {t('প্রোফাইল সেভ করুন', 'Save profile')}
        </button>
      </div>
      <SavedLocations />
      <ChangePassword />
    </PageCard>
  )
}

/** আমার লোকেশন: places saved on the map, offered as one-tap chips in every order form. */
function SavedLocations() {
  const { t, digits } = useLang()
  const queryClient = useQueryClient()
  const locations = useLocations()
  const save = useSaveLocation()
  const [sheet, setSheet] = useState<{ location?: SavedLocationDto } | null>(null)
  const [error, setError] = useState<MessageCode | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.locations })
  const makeDefault = useMutation({ mutationFn: (id: string) => api.me.locations.update(id, { isDefault: true }), onSuccess: refresh, onError: failure => setError(errorCode(failure)) })
  const remove = useMutation({ mutationFn: api.me.locations.remove, onSuccess: refresh, onError: failure => setError(errorCode(failure)) })
  const items = locations.data ?? []
  const full = items.length >= MAX_SAVED_LOCATIONS
  const busy = makeDefault.isPending || remove.isPending

  return (
    <section className="detail-section section-gap">
      <h3 className="section-title">{t('আমার লোকেশন', 'My locations')}</h3>
      <p className="section-note">
        {t('বাসা, অফিস বা যেকোনো জায়গা ম্যাপে সেভ করুন; অর্ডারের সময় এক ট্যাপে ঠিকানা বসবে।', 'Save home, office or any place on the map, then add it to an order in one tap.')}
      </p>
      {locations.isPending && <LoadingNote />}
      {locations.isError && <FormError code={errorCode(locations.error)} />}
      {locations.isSuccess && !items.length && <p className="empty-note">{t('এখনো কোনো লোকেশন সেভ করা হয়নি।', 'No saved locations yet.')}</p>}
      {items.length > 0 && (
        <ul className="saved-locations">
          {items.map(location => (
            <li key={location.id} className={`saved-location ${location.isDefault ? 'default' : ''}`}>
              <span className="saved-location-icon" aria-hidden="true">
                <MapPin size={17} />
              </span>
              <div className="saved-location-text">
                <strong>
                  {location.label}
                  {location.isDefault && <span className="default-badge">{t('ডিফল্ট', 'Default')}</span>}
                </strong>
                <p>{location.address}</p>
              </div>
              <div className="saved-location-actions">
                <button type="button" className="link-button" onClick={() => setSheet({ location })}>
                  <Pencil size={13} />
                  {t('এডিট', 'Edit')}
                </button>
                {!location.isDefault && (
                  <button type="button" className="link-button" disabled={busy} onClick={() => makeDefault.mutate(location.id)}>
                    <Star size={13} />
                    {t('ডিফল্ট করুন', 'Make default')}
                  </button>
                )}
                <a className="link-button" href={mapLink(location)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={13} />
                  {t('ম্যাপে দেখুন', 'Open map')}
                </a>
                <button
                  type="button"
                  className="link-button danger-link"
                  disabled={busy}
                  onClick={() => {
                    setError(null)
                    if (window.confirm(t(`"${location.label}" মুছে ফেলবেন?`, `Delete "${location.label}"?`))) remove.mutate(location.id)
                  }}
                >
                  <Trash2 size={13} />
                  {t('মুছুন', 'Delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormError code={error} />
      <div className="confirm">
        <button
          type="button"
          className="secondary-button"
          disabled={full || !locations.isSuccess}
          onClick={() => {
            setError(null)
            setSheet({})
          }}
        >
          <Plus size={16} />
          {t('নতুন লোকেশন যোগ করুন', 'Add a location')}
        </button>
        {full && <p className="section-note">{t(`সর্বোচ্চ ${digits(MAX_SAVED_LOCATIONS)}টি লোকেশন সেভ করা যায়।`, `You can save up to ${MAX_SAVED_LOCATIONS} locations.`)}</p>}
      </div>
      {sheet && (
        <LocationSheet
          purpose="save"
          title={sheet.location ? t('লোকেশন এডিট', 'Edit location') : t('নতুন লোকেশন', 'New location')}
          initial={sheet.location ? { label: sheet.location.label, address: sheet.location.address, pin: { lat: sheet.location.lat, lng: sheet.location.lng } } : undefined}
          locate={!sheet.location}
          onSubmit={value => save.mutateAsync({ id: sheet.location?.id, label: value.label, address: value.address, ...value.pin })}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  )
}

function ChangePassword() {
  const paths = usePaths()
  const { t } = useLang()
  const [draft, setDraft] = useState({ currentPassword: '', newPassword: '' })
  const [error, setError] = useState<MessageCode | null>(null)
  const change = useMutation({
    mutationFn: api.me.changePassword,
    // Changing the password ends every session, this one included.
    onSuccess: () => window.location.assign(paths.login),
    onError: failure => setError(errorCode(failure)),
  })
  const submit = () => {
    const check = validateForm(changePasswordSchema, draft, ['password.wrong', 'password.short'])
    if (!check.success) return setError(check.code)
    change.mutate(check.data)
  }

  return (
    <section className="detail-section section-gap">
      <div className="profile-fields">
        <Field label={t('বর্তমান পাসওয়ার্ড', 'Current password')}>
          <input type="password" autoComplete="current-password" value={draft.currentPassword} onChange={e => setDraft({ ...draft, currentPassword: e.target.value })} />
        </Field>
        <Field label={t('নতুন পাসওয়ার্ড', 'New password')}>
          <input type="password" autoComplete="new-password" value={draft.newPassword} onChange={e => setDraft({ ...draft, newPassword: e.target.value })} />
        </Field>
      </div>
      <div className="confirm">
        <FormError code={error} />
        <button type="button" className="secondary-button" onClick={submit} disabled={change.isPending}>
          <KeyRound size={16} />
          {t('পাসওয়ার্ড বদলান', 'Change password')}
        </button>
      </div>
    </section>
  )
}

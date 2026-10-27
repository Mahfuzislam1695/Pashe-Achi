'use client'

import { changePasswordSchema, FORM_ERROR_PRIORITY, mapLink, type MessageCode, normalizeMobile, updateProfileSchema, validateForm } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, Check, ExternalLink, KeyRound, LocateFixed, Map as MapIcon, MapPin, Trash2, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { fromMyLocation } from '@/customer/components/address-field'
import { LocationSheet } from '@/customer/components/location-sheet'
import { Field, FormError, PageCard } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useLang } from '@/customer/lib/i18n'
import { usePaths } from '@/customer/lib/paths'
import { forgetCustomerPush } from '@/customer/lib/push'
import { errorCode, queryKeys, useSession } from '@/customer/lib/queries'

const PRIORITY = FORM_ERROR_PRIORITY.profile

export function ProfileScreen() {
  const { t, lang } = useLang()
  const { user, catalog } = useSession()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState({ name: user.name, mobile: user.mobile })
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
      </div>
      {saved && <p className="form-success">{t('প্রোফাইল সেভ হয়েছে।', 'Profile saved.')}</p>}
      <div className="confirm">
        <FormError code={error} />
        <button type="button" className="primary-button" onClick={submit} disabled={save.isPending}>
          <Check size={17} />
          {t('প্রোফাইল সেভ করুন', 'Save profile')}
        </button>
      </div>
      <MyLocation />
      {/* Customers have a password only while the super admin asks for one. */}
      {catalog.customerAuth.password && <ChangePassword />}
      <DeleteAccount />
    </PageCard>
  )
}

/** আমার লোকেশন: the customer's one location, picked on the map. Changing it replaces the old one. */
function MyLocation() {
  const { t } = useLang()
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [sheet, setSheet] = useState<{ locate: boolean } | null>(null)
  const [saved, setSaved] = useState(false)
  const location = user.location
  const initial = fromMyLocation(location)

  return (
    <section className="detail-section section-gap">
      <h3 className="section-title">{t('আমার লোকেশন', 'My location')}</h3>
      <p className="section-note">
        {t('অর্ডারের সময় এই লোকেশন আগে থেকেই বসানো থাকবে।', 'Your orders start with this location.')}
      </p>
      {location ? (
        <div className="my-location">
          <span className="my-location-icon" aria-hidden="true">
            <MapPin size={17} />
          </span>
          <div className="my-location-text">
            {location.details && <strong>{location.details}</strong>}
            <p>{location.address}</p>
          </div>
          <a className="link-button" href={mapLink(location)} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} />
            {t('ম্যাপে দেখুন', 'Open map')}
          </a>
        </div>
      ) : (
        <p className="empty-note">{t('ম্যাপে আপনার লোকেশন দিন, তাহলে অর্ডারে ঠিকানা আগে থেকেই বসবে।', 'Set your location on the map so your orders start with it.')}</p>
      )}
      {saved && <p className="form-success">{t('লোকেশন সেভ হয়েছে।', 'Location saved.')}</p>}
      <div className="confirm my-location-actions">
        <button type="button" className="secondary-button" onClick={() => setSheet({ locate: !location })}>
          <MapIcon size={16} />
          {location ? t('ম্যাপে পরিবর্তন করুন', 'Change on map') : t('ম্যাপে লোকেশন দিন', 'Set on map')}
        </button>
        <button type="button" className="secondary-button" onClick={() => setSheet({ locate: true })}>
          <LocateFixed size={16} />
          {t('বর্তমান লোকেশন', 'Current location')}
        </button>
      </div>
      {sheet && (
        <LocationSheet
          title={t('আমার লোকেশন', 'My location')}
          initial={initial}
          locate={sheet.locate}
          submitLabel={t('সেভ করুন', 'Save')}
          onSubmit={async value => {
            setSaved(false)
            const updated = await api.me.setLocation(value)
            queryClient.setQueryData(queryKeys.me, updated)
            setSaved(true)
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  )
}

/**
 * Deleting the account (a Google Play and App Store rule; the app has the same button, and
 * /account-deletion explains it). The customer types their mobile number to confirm.
 */
function DeleteAccount() {
  const paths = usePaths()
  const { t } = useLang()
  const { user } = useSession()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<MessageCode | null>(null)
  const remove = useMutation({
    mutationFn: async () => {
      // While the session still works: this browser stops getting notifications.
      await forgetCustomerPush()
      await api.me.delete()
    },
    onSuccess: () => window.location.assign(paths.entry),
    onError: failure => setError(errorCode(failure)),
  })
  const confirmed = normalizeMobile(typed) === user.mobile

  return (
    <section id="delete-account" className="detail-section section-gap">
      <h3 className="section-title">{t('অ্যাকাউন্ট মুছে ফেলুন', 'Delete your account')}</h3>
      <p className="section-note">
        {t(
          'নাম, মোবাইল নম্বর, লোকেশন, নোটিফিকেশন আর প্রেসক্রিপশন মুছে যাবে, আর সব ডিভাইস থেকে লগআউট হবেন। আগের অর্ডার শুধু বিক্রির হিসাব হিসেবে থাকবে, আপনার পরিচয় ছাড়া। এটি আর ফেরানো যায় না।',
          'Your name, mobile number, location, notifications and prescriptions are deleted, and you are signed out everywhere. Past orders stay only as sales records, without anything that identifies you. This can’t be undone.',
        )}{' '}
        <Link className="link-button" href={paths.accountDeletion}>
          {t('বিস্তারিত', 'Details')}
        </Link>
      </p>
      {open ? (
        <div className="profile-fields">
          <Field label={t(`নিশ্চিত করতে আপনার মোবাইল নম্বর (${user.mobile}) লিখুন`, `Type your mobile number (${user.mobile}) to confirm`)}>
            <input
              type="tel"
              inputMode="tel"
              value={typed}
              onChange={e => {
                setTyped(e.target.value)
                setError(null)
              }}
              placeholder="01XXXXXXXXX"
              autoComplete="off"
            />
          </Field>
        </div>
      ) : null}
      <div className="confirm my-location-actions">
        <FormError code={error} />
        {open ? (
          <>
            <button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={remove.isPending}>
              <X size={16} />
              {t('থাক', 'Keep it')}
            </button>
            <button type="button" className="secondary-button danger-button" onClick={() => remove.mutate()} disabled={!confirmed || remove.isPending}>
              <Trash2 size={16} />
              {remove.isPending ? t('অপেক্ষা করুন…', 'Please wait…') : t('চিরতরে মুছে ফেলুন', 'Delete for good')}
            </button>
          </>
        ) : (
          <button type="button" className="secondary-button danger-button" onClick={() => setOpen(true)}>
            <Trash2 size={16} />
            {t('অ্যাকাউন্ট মুছে ফেলুন', 'Delete account')}
          </button>
        )}
      </div>
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

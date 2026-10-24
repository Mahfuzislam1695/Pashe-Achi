'use client'

import { APP_LOGO, APP_LOGO_HERO, APP_NAME, APP_TAGLINE, FORM_ERROR_PRIORITY, type MessageCode, photo, staffLoginSchema, validateForm } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { DeveloperCredit } from '@/admin/components/developer-credit'
import { Button, ErrorNote, Field, Input, LangSwitch } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys } from '@/admin/lib/queries'
import { errorCode } from '@/admin/lib/utils'

const safeNext = () => {
  const next = new URLSearchParams(window.location.search).get('next')
  return next && /^\/admin(\/|\?|$)/.test(next) && !next.startsWith('/admin/login') ? next : '/admin'
}

export default function LoginPage() {
  const { t } = useLang()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ mobile: '', password: '' })
  const [error, setError] = useState<MessageCode | null>(null)

  const login = useMutation({
    mutationFn: () => {
      const check = validateForm(staffLoginSchema, form, FORM_ERROR_PRIORITY.login)
      if (!check.success) throw check.code
      return api.auth.login(check.data)
    },
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.me, result.user)
      router.replace(safeNext())
    },
    onError: failure => setError(errorCode(failure, FORM_ERROR_PRIORITY.login)),
  })

  const city = photo('city')
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Wide screens: the aerial Dhaka photo under a navy wash, with the logo and tagline. */}
      <aside className="relative isolate hidden flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex">
        <img src={city.src} srcSet={city.srcSet} sizes="55vw" alt="" className="absolute inset-0 -z-20 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-navy/95 via-navy/80 to-brand-700/60" />
        <div className="absolute inset-y-0 right-0 -z-10 w-1.5 bg-linear-to-b from-teal via-sky to-brand-600" />
        <div className="flex items-center gap-3">
          <img src={APP_LOGO} alt="" className="size-14 object-contain drop-shadow-md" />
          <div className="leading-tight">
            <strong className="block text-lg font-bold text-white">{APP_NAME.en}</strong>
            <span className="text-sm font-medium text-teal">{t('অ্যাডমিন প্যানেল', 'Admin panel')}</span>
          </div>
        </div>
        <div className="max-w-md">
          <img src={APP_LOGO_HERO} alt="" className="mb-6 size-40 object-contain drop-shadow-xl" />
          <h2 className="text-4xl leading-tight font-bold text-white">{t(APP_TAGLINE.bn, APP_TAGLINE.en)}</h2>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            {t('অর্ডার, দাম, গ্রাহক আর অফার — সব এক জায়গা থেকে সামলান।', 'Orders, prices, customers and offers, all handled from one place.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <small className="text-white/60">
            © {new Date().getFullYear()} {APP_NAME.en}
          </small>
          <DeveloperCredit tone="dark" />
        </div>
      </aside>
      <div className="grid place-items-center bg-[radial-gradient(circle_at_85%_10%,var(--color-teal-soft)_0,transparent_40%),linear-gradient(160deg,var(--color-brand-50),var(--color-canvas))] p-4">
        <div className="grid w-full max-w-sm justify-items-center gap-5">
          <form
            noValidate
            className="grid w-full gap-4 rounded-2xl border border-line bg-surface p-6 shadow-raised sm:p-7"
            onSubmit={event => {
              event.preventDefault()
              setError(null)
              login.mutate()
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src={APP_LOGO} alt="" className="size-12 object-contain drop-shadow-sm" />
                <div className="leading-tight">
                  <strong className="block font-bold text-navy">{APP_NAME.en}</strong>
                  <span className="text-xs font-medium text-brand-600">{t('অ্যাডমিন প্যানেল', 'Admin panel')}</span>
                </div>
              </div>
              <LangSwitch />
            </div>
            <h1 className="mt-1 text-xl font-bold text-navy">{t('লগইন', 'Sign in')}</h1>
            <Field label={t('মোবাইল নম্বর', 'Mobile number')}>
              <Input type="tel" inputMode="tel" autoComplete="username" placeholder="01XXXXXXXXX" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} />
            </Field>
            <Field label={t('পাসওয়ার্ড', 'Password')}>
              <Input type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </Field>
            <ErrorNote code={error} />
            <Button type="submit" loading={login.isPending}>
              <LogIn className="size-4" />
              {t('লগইন', 'Sign in')}
            </Button>
          </form>
          {/* Wide screens show the credit in the photo panel. */}
          <DeveloperCredit className="lg:hidden" />
        </div>
      </div>
    </main>
  )
}

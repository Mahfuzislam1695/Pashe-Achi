'use client'

import { APP_LOGO, APP_NAME, FORM_ERROR_PRIORITY, loginSchema, type MessageCode, validateForm } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
      const check = validateForm(loginSchema, form, FORM_ERROR_PRIORITY.login)
      if (!check.success) throw check.code
      return api.auth.login(check.data)
    },
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.me, result.user)
      router.replace(safeNext())
    },
    onError: failure => setError(errorCode(failure, FORM_ERROR_PRIORITY.login)),
  })

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_85%_10%,var(--color-brand-100)_0,transparent_40%),linear-gradient(160deg,var(--color-brand-50),var(--color-canvas))] p-4">
      <form
        noValidate
        className="grid w-full max-w-sm gap-4 rounded-2xl border border-line bg-surface p-6 shadow-raised sm:p-7"
        onSubmit={event => {
          event.preventDefault()
          setError(null)
          login.mutate()
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={APP_LOGO} alt="" className="size-11 rounded-full bg-white object-cover shadow-xs ring-1 ring-line" />
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
    </main>
  )
}

'use client'

import {
  APP_NAME,
  APP_TAGLINE,
  APP_WELCOME,
  FORM_ERROR_PRIORITY,
  loginSchema,
  type MessageCode,
  SERVICE_IDS,
  SERVICE_LABELS,
  signupSchema,
  validateForm,
} from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LockKeyhole, LogIn, MapPin, Phone, UserPlus, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ContactDock, Field, FormError, LangToggle, Logo } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { HOME_PATH } from '@/customer/lib/constants'
import { useLang } from '@/customer/lib/i18n'
import { errorCode, queryKeys } from '@/customer/lib/queries'
import { SERVICE_ICONS } from './orders'

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-form">
          <div className="mobile-auth-logo">
            <Logo />
          </div>
          {children}
        </div>
      </section>
      <ContactDock />
    </main>
  )
}

/** The entry screen: language, sign up and login in one row, then the four services. */
export function WelcomeScreen() {
  const { t, lang, setLang, text } = useLang()
  return (
    <AuthShell>
      <div className="welcome">
        <p className="eyebrow">{APP_WELCOME[lang]}</p>
        <h2>{APP_TAGLINE[lang]}</h2>
        <p className="auth-subtitle">{t('কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান।', 'Fresh market, house shifting, emergency medicine and parcel delivery.')}</p>
        <div className="welcome-actions">
          <LangToggle lang={lang} onChange={setLang} />
          <Link className="primary-button" href="/signup">
            <UserPlus size={16} />
            {t('সাইন আপ', 'Sign up')}
          </Link>
          <Link className="secondary-button" href="/login">
            <LogIn size={16} />
            {t('লগইন', 'Login')}
          </Link>
        </div>
        <div className="welcome-services">
          {SERVICE_IDS.map(service => {
            const Icon = SERVICE_ICONS[service]
            return (
              <div key={service}>
                <Icon size={20} />
                <span>{text(SERVICE_LABELS[service])}</span>
              </div>
            )
          })}
        </div>
      </div>
    </AuthShell>
  )
}

/** Only same-site paths are allowed as a post-login destination. */
const safeNext = () => {
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') && next !== '/login' && next !== '/signup' ? next : HOME_PATH
}

export function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const { t, lang, setLang } = useLang()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isSignup = mode === 'signup'
  const [form, setForm] = useState({ name: '', mobile: '', location: '', password: '' })
  const [error, setError] = useState<MessageCode | null>(null)
  const priority = isSignup ? FORM_ERROR_PRIORITY.signup : FORM_ERROR_PRIORITY.login

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (isSignup) {
        const check = validateForm(signupSchema, { ...form, location: form.location || undefined, lang }, priority)
        if (!check.success) throw check.code
        return api.auth.signup(check.data)
      }
      const check = validateForm(loginSchema, { mobile: form.mobile, password: form.password }, priority)
      if (!check.success) throw check.code
      return api.auth.login(check.data)
    },
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.me, result.user)
      router.replace(safeNext())
    },
    onError: failure => setError(typeof failure === 'string' ? (failure as MessageCode) : errorCode(failure, priority)),
  })

  const bind = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm({ ...form, [key]: e.target.value })
      setError(null)
    },
  })

  return (
    <AuthShell>
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault()
          submitMutation.mutate()
        }}
      >
        <div className="auth-top">
          <Link className="link-button back" href="/">
            <ArrowLeft size={15} />
            {t('ফিরে যান', 'Back')}
          </Link>
          <LangToggle compact lang={lang} onChange={setLang} />
        </div>
        <h2>{isSignup ? t('সাইন আপ', 'Sign up') : t('লগইন', 'Login')}</h2>
        <p className="auth-subtitle">
          {isSignup ? t('নতুন অ্যাকাউন্ট খুলুন, সব সেবা এক জায়গায় পান।', 'Create an account to use every service.') : t('আপনার মোবাইল নম্বর দিয়ে লগইন করুন।', 'Log in with your mobile number.')}
        </p>
        {isSignup && (
          <Field label={t('নাম', 'Name')}>
            <div className="input-wrap">
              <UserRound size={17} />
              <input {...bind('name')} placeholder={t('আপনার নাম', 'Your name')} autoComplete="name" />
            </div>
          </Field>
        )}
        <Field label={t('মোবাইল নম্বর', 'Mobile number')}>
          <div className="input-wrap">
            <Phone size={17} />
            <input type="tel" inputMode="tel" {...bind('mobile')} placeholder="01XXXXXXXXX" autoComplete="tel" />
          </div>
        </Field>
        {isSignup && (
          <Field label={t('লোকেশন', 'Location')}>
            <div className="input-wrap">
              <MapPin size={17} />
              <input {...bind('location')} placeholder={t('যেমন: মিরপুর ১০, ঢাকা', 'e.g. Mirpur 10, Dhaka')} />
            </div>
          </Field>
        )}
        <Field label={t('পাসওয়ার্ড', 'Password')}>
          <div className="input-wrap">
            <LockKeyhole size={17} />
            <input type="password" {...bind('password')} placeholder={t('পাসওয়ার্ড দিন', 'Enter password')} autoComplete={isSignup ? 'new-password' : 'current-password'} />
          </div>
        </Field>
        <FormError code={error} />
        <button type="submit" className="primary-button wide" disabled={submitMutation.isPending}>
          {isSignup ? <UserPlus size={17} /> : <LogIn size={17} />}
          {isSignup ? t('সাইন আপ', 'Sign up') : t('লগইন', 'Login')}
        </button>
        <p className="switch-auth">
          {isSignup ? t('আগে থেকেই অ্যাকাউন্ট আছে?', 'Already have an account?') : t('নতুন গ্রাহক?', `New to ${APP_NAME.en}?`)}{' '}
          <Link className="link-button" href={isSignup ? '/login' : '/signup'}>
            {isSignup ? t('লগইন', 'Login') : t('সাইন আপ', 'Sign up')}
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

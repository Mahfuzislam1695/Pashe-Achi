'use client'

import {
  APP_LOGO_LARGE,
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
import { useLang } from '@/customer/lib/i18n'
import { appPaths, type Mode, type Paths, pathsFor } from '@/customer/lib/paths'
import { errorCode, queryKeys } from '@/customer/lib/queries'
import { SERVICE_ICONS } from './orders'

/**
 * The signed-out frame. The app version (/app, /app/login, /app/signup) keeps the phone design at
 * every width; the web version (/login, /signup) puts a brand panel beside the form on a wide screen.
 */
function AuthShell({ version, children }: { version: Mode; children: React.ReactNode }) {
  return (
    <main className={`auth-shell mode-${version}`}>
      {version === 'web' && <BrandPanel />}
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

function BrandPanel() {
  const { t, lang, text } = useLang()
  return (
    <aside className="auth-visual">
      <Link href={pathsFor('web').entry} className="auth-visual-brand">
        <Logo />
      </Link>
      <div className="auth-message">
        <img className="auth-visual-logo" src={APP_LOGO_LARGE} alt="" />
        <p className="eyebrow">{APP_WELCOME[lang]}</p>
        <h1>{APP_TAGLINE[lang]}</h1>
        <p>{t('কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান — এক জায়গায়।', 'Fresh market, house shifting, emergency medicine and parcel delivery, in one place.')}</p>
        <ul className="auth-visual-services">
          {SERVICE_IDS.map(service => {
            const Icon = SERVICE_ICONS[service]
            return (
              <li key={service}>
                <Icon size={18} />
                <span>{text(SERVICE_LABELS[service])}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <small className="auth-visual-foot">© {new Date().getFullYear()} {APP_NAME[lang]}</small>
    </aside>
  )
}

/** The app version's entry screen (/app): language, sign up and login in one row, then the four services. */
export function WelcomeScreen() {
  const { t, lang, setLang, text } = useLang()
  return (
    <AuthShell version="app">
      <div className="welcome">
        <img className="welcome-logo" src={APP_LOGO_LARGE} alt={APP_NAME[lang]} />
        <p className="eyebrow">{APP_WELCOME[lang]}</p>
        <h2>{APP_TAGLINE[lang]}</h2>
        <p className="auth-subtitle">{t('কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান।', 'Fresh market, house shifting, emergency medicine and parcel delivery.')}</p>
        <div className="welcome-actions">
          <LangToggle lang={lang} onChange={setLang} />
          <Link className="primary-button" href={appPaths.signup}>
            <UserPlus size={16} />
            {t('সাইন আপ', 'Sign up')}
          </Link>
          <Link className="secondary-button" href={appPaths.login}>
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

/** Only same-site paths are allowed as a post-login destination; otherwise the version's home screen. */
const safeNext = (paths: Paths) => {
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') && next !== paths.login && next !== paths.signup ? next : paths.home
}

export function AuthScreen({ mode, version }: { mode: 'login' | 'signup'; version: Mode }) {
  const { t, lang, setLang } = useLang()
  const paths = pathsFor(version)
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
      router.replace(safeNext(paths))
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
    <AuthShell version={version}>
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault()
          submitMutation.mutate()
        }}
      >
        <div className="auth-top">
          <Link className="link-button back" href={paths.entry}>
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
          <Link className="link-button" href={isSignup ? paths.login : paths.signup}>
            {isSignup ? t('লগইন', 'Login') : t('সাইন আপ', 'Sign up')}
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

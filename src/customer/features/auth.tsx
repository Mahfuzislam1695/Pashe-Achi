'use client'

import {
  APP_LOGO,
  APP_LOGO_LARGE,
  APP_NAME,
  APP_TAGLINE,
  APP_WELCOME,
  FORM_ERROR_PRIORITY,
  loginSchema,
  type MessageCode,
  MOBILE_PATTERN,
  normalizeMobile,
  SERVICE_IDS,
  SERVICE_LABELS,
  signupSchema,
  validateForm,
} from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, Headset, LockKeyhole, LogIn, Phone, UserPlus, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { AddressField, type AddressValue } from '@/customer/components/address-field'
import { Photo } from '@/customer/components/banner'
import { DeveloperCredit } from '@/customer/components/developer-credit'
import { BillPreviewCard, OrderTrackerCard, SplitHeadline } from '@/customer/components/showcase'
import { ContactDock, Field, FormError, LangToggle, Logo } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useLang } from '@/customer/lib/i18n'
import { appPaths, type Mode, ModeProvider, type Paths, pathsFor } from '@/customer/lib/paths'
import { errorCode, queryKeys, useCatalog } from '@/customer/lib/queries'
import { SERVICE_ICONS } from './orders'

/**
 * The signed-out frame. The app version (/app, /app/login, /app/signup) keeps the phone design at
 * every width; the web version (/login, /signup) puts a brand panel beside the form on a wide screen.
 */
function AuthShell({ version, children }: { version: Mode; children: React.ReactNode }) {
  return (
    <ModeProvider mode={version}>
      <main className={`auth-shell mode-${version}`}>
        {version === 'web' && <BrandPanel />}
        <section className="auth-panel">
          {version === 'web' && <AuthHero />}
          <div className="auth-form">
            <div className="mobile-auth-logo">
              <Logo />
            </div>
            {children}
          </div>
        </section>
        <ContactDock />
      </main>
    </ModeProvider>
  )
}

/** The web version's brand panel beside the form on a wide screen. */
function BrandPanel() {
  const { t, lang, text } = useLang()
  const support = useCatalog().data?.support
  return (
    <aside className="auth-visual">
      <Photo name="welcome" className="auth-visual-photo" sizes="55vw" priority />
      <Link href={pathsFor('web').entry} className="auth-visual-brand">
        <Logo />
      </Link>
      <div className="auth-message">
        <p className="eyebrow">{APP_WELCOME[lang]}</p>
        <SplitHeadline text={APP_TAGLINE[lang]} />
        <p>{t('কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান — এক জায়গায়।', 'Fresh market, house shifting, emergency medicine and parcel delivery, in one place.')}</p>
        <ul className="auth-visual-services">
          {SERVICE_IDS.map(service => {
            const Icon = SERVICE_ICONS[service]
            return (
              <li key={service} className={`svc-${service}`}>
                <Icon size={18} />
                <span>{text(SERVICE_LABELS[service])}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="auth-visual-cards">
        <OrderTrackerCard />
        <BillPreviewCard />
      </div>
      <div className="auth-visual-foot">
        {support && (
          <a href={`tel:${support.phone}`}>
            <Phone size={14} />
            {support.phone}
          </a>
        )}
        <small>
          © {new Date().getFullYear()} {APP_NAME[lang]}
        </small>
        <DeveloperCredit tone="dark" />
      </div>
    </aside>
  )
}

/** The web version's header band on phones and tablets, where the brand panel is hidden. */
function AuthHero() {
  const { lang, text } = useLang()
  return (
    <div className="auth-hero">
      <Photo name="welcome" className="auth-hero-photo" sizes="100vw" />
      <Link href={pathsFor('web').entry} className="auth-hero-brand">
        <img src={APP_LOGO_LARGE} alt="" />
        <span>
          <strong>{APP_NAME[lang]}</strong>
          <small>{APP_TAGLINE[lang]}</small>
        </span>
      </Link>
      <ul className="auth-hero-services">
        {SERVICE_IDS.map(service => {
          const Icon = SERVICE_ICONS[service]
          return (
            <li key={service} className={`svc-${service}`} title={text(SERVICE_LABELS[service])}>
              <Icon size={17} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The app version's entry screen (/app): language, sign up and login in one row, then the four services. */
export function WelcomeScreen() {
  const { t, lang, setLang, text } = useLang()
  return (
    <AuthShell version="app">
      <div className="welcome">
        <div className="welcome-banner">
          <Photo name="welcome" sizes="430px" alt={t('পুরান ঢাকায় ফলের দোকান', 'Fruit stalls in Old Dhaka')} priority />
          <img className="welcome-logo" src={APP_LOGO_LARGE} alt={APP_NAME[lang]} />
        </div>
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
              <div key={service} className={`svc-${service}`}>
                <Icon size={20} />
                <span>{text(SERVICE_LABELS[service])}</span>
              </div>
            )
          })}
        </div>
        <div className="auth-credit">
          <DeveloperCredit />
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
  const [form, setForm] = useState({ name: '', mobile: '', password: '' })
  // Picked on the map; signup needs it.
  const [location, setLocation] = useState<AddressValue>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<MessageCode | null>(null)
  const catalog = useCatalog().data
  const support = catalog?.support
  // The super admin's switch: off, the mobile number alone signs up and logs in.
  const passwordOn = catalog?.customerAuth.password ?? false
  const priority = isSignup ? FORM_ERROR_PRIORITY.signup : FORM_ERROR_PRIORITY.login

  const submitMutation = useMutation({
    mutationFn: async () => {
      const password = passwordOn ? form.password : undefined
      if (isSignup) {
        const check = validateForm(signupSchema, { ...form, password, location: location ?? undefined, lang }, priority)
        if (!check.success) throw check.code
        return api.auth.signup(check.data)
      }
      const check = validateForm(loginSchema, { mobile: form.mobile, password }, priority)
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
        {version === 'web' && <img className="auth-form-mark" src={APP_LOGO} alt="" />}
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
            <input
              type="tel"
              inputMode="numeric"
              maxLength={16}
              value={form.mobile}
              // Digits (Latin or Bangla), +, spaces and dashes only; the schema normalises +880 and the rest.
              onChange={e => {
                setForm({ ...form, mobile: e.target.value.replace(/[^0-9০-৯+\s-]/g, '') })
                setError(null)
              }}
              onBlur={() => {
                if (form.mobile.trim() && !MOBILE_PATTERN.test(normalizeMobile(form.mobile))) setError('mobile.invalid')
              }}
              aria-invalid={error === 'mobile.invalid'}
              placeholder="01XXXXXXXXX"
              autoComplete="tel"
            />
          </div>
        </Field>
        {isSignup && (
          <AddressField
            label={t('লোকেশন', 'Location')}
            value={location}
            onChange={picked => {
              setLocation(picked)
              setError(null)
            }}
          />
        )}
        {passwordOn && (
          <Field label={t('পাসওয়ার্ড', 'Password')}>
            <div className="input-wrap">
              <LockKeyhole size={17} />
              <input
                type={showPassword ? 'text' : 'password'}
                {...bind('password')}
                placeholder={t('পাসওয়ার্ড দিন', 'Enter password')}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="password-toggle"
                aria-pressed={showPassword}
                aria-label={showPassword ? t('পাসওয়ার্ড লুকান', 'Hide password') : t('পাসওয়ার্ড দেখুন', 'Show password')}
                onClick={() => setShowPassword(shown => !shown)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
        )}
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
        {version === 'web' && support && (
          <p className="auth-help">
            <Headset size={15} />
            {isSignup ? t('সাহায্য দরকার?', 'Need help?') : t('লগইনে সমস্যা?', 'Trouble logging in?')} <a href={`tel:${support.phone}`}>{t(`কল করুন ${support.phone}`, `Call ${support.phone}`)}</a>
          </p>
        )}
        {/* The web brand panel carries the credit from 1024px, so this one shows only below it (and always in the app). */}
        <div className="auth-credit">
          <DeveloperCredit />
        </div>
      </form>
    </AuthShell>
  )
}

'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Award,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  LockKeyhole,
  LogIn,
  MapPin,
  Menu,
  MessageCircle,
  PackageCheck,
  Phone,
  Pill,
  Plus,
  ShoppingBag,
  Truck,
  Upload,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'

import { APP_INITIAL, APP_NAME, APP_TAGLINE, APP_WELCOME, ORDER_PREFIX } from '@/lib/brand'

// Placeholder support line used by the Chat (WhatsApp) and Call buttons. Replace before launch.
const SUPPORT_PHONE = '+8801700000000'
const SUPPORT_WHATSAPP = 'https://wa.me/8801700000000'

// Fees and rates from the paper sketches, in taka.
const BAZAR_SHOPPING_FEE = 150
const BAZAR_DELIVERY_FEE = 80
const MEDICINE_DELIVERY_FEE = 60
const PARCEL_DELIVERY_FEE = 60
const WAGE_PER_LABOURER = 150
const LOADING_RATE_PER_FLOOR = 50
const UNLOADING_RATE_PER_FLOOR = 20
// The sketch only gives one vehicle rate (1200), so every vehicle uses it until real rates exist.
const VEHICLES = [
  { id: 'covered-van', bn: 'কাভার্ড ভ্যান', en: 'Covered van', rate: 1200 },
  { id: 'pickup', bn: 'পিকআপ ভ্যান', en: 'Pickup van', rate: 1200 },
  { id: 'truck', bn: 'ট্রাক', en: 'Truck', rate: 1200 },
] as const

type Lang = 'bn' | 'en'
type Text = { bn: string; en: string }
type ServiceId = 'bazar' | 'shifting' | 'medicine' | 'parcel'
type View = ServiceId | 'orders' | 'profile'
type User = { name: string; mobile: string; location: string; points: number }
type OrderStatus = 'pending' | 'booked' | 'completed'
type Order = { id: string; service: ServiceId; detail: Text; amount: number; date: Date; status: OrderStatus }
type NewOrder = Pick<Order, 'service' | 'detail' | 'amount'>
type ServiceProps = { user: User; onPlaceOrder: (order: NewOrder) => void }
type Row = Record<string, string>
type Column = { key: string; label: string; placeholder?: string; numeric?: boolean }

const SERVICES = [
  { id: 'bazar', icon: ShoppingBag, bn: 'কাঁচা বাজার', en: 'Fresh market' },
  { id: 'shifting', icon: Truck, bn: 'বাসা বদল', en: 'House shifting' },
  { id: 'medicine', icon: Pill, bn: 'জরুরী ঔষুধ', en: 'Emergency medicine' },
  { id: 'parcel', icon: PackageCheck, bn: 'পণ্য আদান প্রদান', en: 'Parcel delivery' },
] as const satisfies readonly { id: ServiceId; icon: typeof Truck; bn: string; en: string }[]

const ORDER_STATUS: Record<OrderStatus, Text> = {
  pending: { bn: 'অপেক্ষমাণ', en: 'Pending' },
  booked: { bn: 'বুক করা হয়েছে', en: 'Booked' },
  completed: { bn: 'সম্পন্ন', en: 'Completed' },
}

// Sample history using the totals from the sketches.
const SAMPLE_ORDERS: Order[] = [
  { id: `${ORDER_PREFIX}-1048`, service: 'bazar', detail: { bn: 'চাল, আলু, রুই মাছ', en: 'Rice, potatoes, rui fish' }, amount: 760, date: new Date(2026, 8, 28), status: 'completed' },
  { id: `${ORDER_PREFIX}-1047`, service: 'shifting', detail: { bn: 'মিরপুর ১০ → উত্তরা', en: 'Mirpur 10 → Uttara' }, amount: 1420, date: new Date(2026, 8, 26), status: 'booked' },
  { id: `${ORDER_PREFIX}-1046`, service: 'medicine', detail: { bn: 'Napa, Seclo', en: 'Napa, Seclo' }, amount: 160, date: new Date(2026, 8, 24), status: 'completed' },
]

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
const toBnDigits = (value: number) => String(value).replace(/\d/g, digit => BN_DIGITS[Number(digit)])
const toAmount = (value: string | undefined) => Math.max(0, Number(value) || 0)
const hasValue = (value: string | undefined) => !!value?.trim()
// A row is "started" once any box has text; started rows must have every box filled.
const isRowStarted = (row: Row) => Object.values(row).some(hasValue)
const isRowComplete = (row: Row, columns: Column[]) => columns.every(column => hasValue(row[column.key]))
const sameText = (text: string): Text => ({ bn: text, en: text })
const serviceById = (id: ServiceId) => SERVICES.find(service => service.id === id) ?? SERVICES[0]

const LangContext = createContext<Lang>('bn')

function useLang() {
  const lang = useContext(LangContext)
  const digits = (n: number) => (lang === 'bn' ? toBnDigits(n) : String(n))
  return {
    lang,
    t: (bn: string, en: string) => (lang === 'bn' ? bn : en),
    // Amounts keep Latin digits in both languages, as written in the sketches.
    taka: (amount: number) => (lang === 'bn' ? `${amount} টাকা` : `Tk ${amount}`),
    digits,
    rowNumber: (index: number) => (lang === 'bn' ? `${digits(index + 1)}।` : `${index + 1}.`),
  }
}

function Logo() {
  const { lang } = useLang()
  return (
    <div className="brand">
      <div className="brand-mark">{APP_INITIAL}</div>
      <div>
        <strong>{APP_NAME[lang]}</strong>
        <small>{APP_NAME[lang === 'bn' ? 'en' : 'bn']}</small>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      {children}
    </label>
  )
}

function PageCard({ icon: Icon, title, subtitle, children }: { icon: typeof Truck; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="page-card">
      <div className="card-heading">
        <div className="card-heading-icon">
          <Icon size={21} />
        </div>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function LangToggle({ lang, onChange, compact = false }: { lang: Lang; onChange: (lang: Lang) => void; compact?: boolean }) {
  return (
    <div className={`lang-toggle ${compact ? 'compact' : ''}`} role="group" aria-label="ভাষা / Language">
      <button type="button" className={lang === 'bn' ? 'active' : ''} aria-pressed={lang === 'bn'} onClick={() => onChange('bn')}>
        {compact ? 'বাং' : 'বাংলা'}
      </button>
      <button type="button" className={lang === 'en' ? 'active' : ''} aria-pressed={lang === 'en'} onClick={() => onChange('en')}>
        {compact ? 'EN' : 'English'}
      </button>
    </div>
  )
}

// Chat and Call sit at the bottom centre of every screen so customers can always reach support.
function ContactDock({ raised = false }: { raised?: boolean }) {
  const { t } = useLang()
  return (
    <div className={`contact-dock ${raised ? 'raised' : ''}`}>
      <a className="chat" href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" title={t('WhatsApp-এ চ্যাট করুন', 'Chat on WhatsApp')}>
        <MessageCircle size={17} />
        Chat
      </a>
      <a className="call" href={`tel:${SUPPORT_PHONE}`} title={t('সাপোর্টে কল করুন', 'Call support')}>
        <Phone size={16} />
        Call
      </a>
    </div>
  )
}

function CustomerInfo({ user, showPoints = true }: { user: User; showPoints?: boolean }) {
  const { t } = useLang()
  return (
    <dl className="customer-info">
      <div>
        <dt>{t('নাম', 'Name')}</dt>
        <dd>{user.name}</dd>
      </div>
      <div>
        <dt>{t('লোকেশন', 'Location')}</dt>
        <dd>{user.location || '—'}</dd>
      </div>
      <div>
        <dt>{t('মোবা', 'Mobile')}</dt>
        <dd>{user.mobile || '—'}</dd>
      </div>
      {showPoints && (
        <div>
          <dt>{t('point', 'Points')}</dt>
          <dd>{user.points}</dd>
        </div>
      )}
    </dl>
  )
}

function LineTable({ columns, template, rows, onChange, addLabel }: { columns: Column[]; template: string; rows: Row[]; onChange: (rows: Row[]) => void; addLabel: string }) {
  const { rowNumber } = useLang()
  const update = (index: number, key: string, value: string) => onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  return (
    <div className="line-table" style={{ '--cols': template } as React.CSSProperties}>
      <div className="line-head" aria-hidden="true">
        <span />
        {columns.map(column => (
          <span key={column.key}>{column.label}</span>
        ))}
      </div>
      {/* Rows are only ever appended, so the index is a stable key. */}
      {rows.map((row, index) => (
        <div className="line-row" key={index}>
          <span className="line-no">{rowNumber(index)}</span>
          {columns.map(column => (
            <input
              key={column.key}
              aria-label={`${column.label} ${rowNumber(index)}`}
              type={column.numeric ? 'number' : 'text'}
              inputMode={column.numeric ? 'decimal' : undefined}
              min={column.numeric ? 0 : undefined}
              placeholder={column.placeholder}
              value={row[column.key] ?? ''}
              onChange={e => update(index, column.key, e.target.value)}
            />
          ))}
        </div>
      ))}
      {/* A new row can only be added once every box in the last row is filled. */}
      {isRowComplete(rows[rows.length - 1], columns) && (
        <button type="button" className="add-row" onClick={() => onChange([...rows, {}])}>
          <Plus size={15} />
          {addLabel}
        </button>
      )}
    </div>
  )
}

function BillSummary({ lines, totalLabel, total }: { lines: [string, number][]; totalLabel: string; total: number }) {
  const { taka } = useLang()
  return (
    <div className="bill">
      {lines.map(([label, amount]) => (
        <div className="bill-line" key={label}>
          <span>{label}</span>
          <strong>{amount}</strong>
        </div>
      ))}
      <div className="bill-total">
        <span>{totalLabel}</span>
        <strong>{taka(total)}</strong>
      </div>
    </div>
  )
}

function ConfirmButton({ error, onConfirm }: { error: string | null; onConfirm: () => void }) {
  const { t } = useLang()
  return (
    <div className="confirm">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="primary-button wide" onClick={onConfirm}>
        <Check size={17} />
        {t('অর্ডার নিশ্চিত করুন', 'Confirm order')}
      </button>
    </div>
  )
}

function Auth({ lang, onLangChange, onComplete }: { lang: Lang; onLangChange: (lang: Lang) => void; onComplete: (user: User) => void }) {
  const { t } = useLang()
  const [step, setStep] = useState<'welcome' | 'signup' | 'login'>('welcome')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [location, setLocation] = useState('')
  const [password, setPassword] = useState('')
  const [showError, setShowError] = useState(false)
  const isSignup = step === 'signup'

  const goTo = (next: 'welcome' | 'signup' | 'login') => {
    setStep(next)
    setShowError(false)
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!mobile.trim() || !password || (isSignup && !name.trim())) {
      setShowError(true)
      return
    }
    onComplete({ name: name.trim() || 'Mahfuz', mobile: mobile.trim(), location: location.trim(), points: 0 })
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-form">
          <div className="mobile-auth-logo">
            <Logo />
          </div>
          {step === 'welcome' ? (
            <div className="welcome">
              <p className="eyebrow">{APP_WELCOME[lang]}</p>
              <h2>{APP_TAGLINE[lang]}</h2>
              <p className="auth-subtitle">{t('কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান।', 'Fresh market, house shifting, emergency medicine and parcel delivery.')}</p>
              <div className="welcome-actions">
                <LangToggle lang={lang} onChange={onLangChange} />
                <button type="button" className="primary-button" onClick={() => goTo('signup')}>
                  <UserPlus size={16} />
                  {t('সাইন আপ', 'Sign up')}
                </button>
                <button type="button" className="secondary-button" onClick={() => goTo('login')}>
                  <LogIn size={16} />
                  {t('লগইন', 'Login')}
                </button>
              </div>
              <div className="welcome-services">
                {SERVICES.map(service => (
                  <div key={service.id}>
                    <service.icon size={20} />
                    <span>{service[lang]}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="auth-top">
                <button type="button" className="link-button back" onClick={() => goTo('welcome')}>
                  <ArrowLeft size={15} />
                  {t('ফিরে যান', 'Back')}
                </button>
                <LangToggle compact lang={lang} onChange={onLangChange} />
              </div>
              <h2>{isSignup ? t('সাইন আপ', 'Sign up') : t('লগইন', 'Login')}</h2>
              <p className="auth-subtitle">
                {isSignup ? t('নতুন অ্যাকাউন্ট খুলুন, সব সেবা এক জায়গায় পান।', 'Create an account to use every service.') : t('আপনার মোবাইল নম্বর দিয়ে লগইন করুন।', 'Log in with your mobile number.')}
              </p>
              {isSignup && (
                <Field label={t('নাম', 'Name')}>
                  <div className="input-wrap">
                    <UserRound size={17} />
                    <input value={name} onChange={e => setName(e.target.value)} placeholder={t('আপনার নাম', 'Your name')} autoComplete="name" />
                  </div>
                </Field>
              )}
              <Field label={t('মোবাইল নম্বর', 'Mobile number')}>
                <div className="input-wrap">
                  <Phone size={17} />
                  <input type="tel" inputMode="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="01XXXXXXXXX" autoComplete="tel" />
                </div>
              </Field>
              {isSignup && (
                <Field label={t('লোকেশন', 'Location')}>
                  <div className="input-wrap">
                    <MapPin size={17} />
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('যেমন: মিরপুর ১০, ঢাকা', 'e.g. Mirpur 10, Dhaka')} />
                  </div>
                </Field>
              )}
              <Field label={t('পাসওয়ার্ড', 'Password')}>
                <div className="input-wrap">
                  <LockKeyhole size={17} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('পাসওয়ার্ড দিন', 'Enter password')} autoComplete={isSignup ? 'new-password' : 'current-password'} />
                </div>
              </Field>
              {showError && (
                <p className="form-error" role="alert">
                  {isSignup ? t('নাম, মোবাইল নম্বর ও পাসওয়ার্ড দিন।', 'Enter your name, mobile number and password.') : t('মোবাইল নম্বর ও পাসওয়ার্ড দিন।', 'Enter your mobile number and password.')}
                </p>
              )}
              <button type="submit" className="primary-button wide">
                {isSignup ? <UserPlus size={17} /> : <LogIn size={17} />}
                {isSignup ? t('সাইন আপ', 'Sign up') : t('লগইন', 'Login')}
              </button>
              <p className="switch-auth">
                {isSignup ? t('আগে থেকেই অ্যাকাউন্ট আছে?', 'Already have an account?') : t('নতুন গ্রাহক?', `New to ${APP_NAME.en}?`)}{' '}
                <button type="button" className="link-button" onClick={() => goTo(isSignup ? 'login' : 'signup')}>
                  {isSignup ? t('লগইন', 'Login') : t('সাইন আপ', 'Sign up')}
                </button>
              </p>
            </form>
          )}
        </div>
      </section>
      <ContactDock />
    </main>
  )
}

function Bazar({ user, onPlaceOrder }: ServiceProps) {
  const { t } = useLang()
  const [address, setAddress] = useState('')
  const [mobile, setMobile] = useState(user.mobile)
  const [rows, setRows] = useState<Row[]>([{}])
  const [showError, setShowError] = useState(false)
  const columns: Column[] = [
    { key: 'item', label: t('কাঁচা বাজারের লিস্ট লিখুন', 'Bazar list item'), placeholder: t('আলু', 'Potatoes') },
    { key: 'quantity', label: t('পরিমাণ', 'Quantity'), placeholder: t('1 কেজি', '1 kg') },
    { key: 'variety', label: t('জাত বা ধরণ', 'Variety / type'), placeholder: t('দেশি', 'Local') },
    { key: 'price', label: t('দর', 'Price'), placeholder: '৳', numeric: true },
  ]
  const bazarCost = rows.reduce((sum, row) => sum + toAmount(row.price), 0)
  const total = bazarCost + BAZAR_SHOPPING_FEE + BAZAR_DELIVERY_FEE
  const started = rows.filter(isRowStarted)
  const rowsOk = started.every(row => isRowComplete(row, columns))
  const detailsOk = hasValue(address) && hasValue(mobile) && started.length > 0
  const error = !showError
    ? null
    : !rowsOk
      ? t('প্রতিটি লাইনের সব ঘর পূরণ করুন।', 'Fill every box in each row.')
      : !detailsOk
        ? t('ঠিকানা, মোবাইল নম্বর ও অন্তত একটি বাজারের লাইন দিন।', 'Add your address, mobile number and at least one item.')
        : null

  const confirm = () => {
    if (!rowsOk || !detailsOk) {
      setShowError(true)
      return
    }
    onPlaceOrder({ service: 'bazar', detail: sameText(started.map(row => row.item.trim()).join(', ')), amount: total })
    setAddress('')
    setRows([{}])
    setShowError(false)
  }

  return (
    <PageCard icon={ShoppingBag} title={t('কাঁচা বাজার', 'Fresh market')}>
      <CustomerInfo user={user} />
      <p className="notice">
        <Clock size={16} />
        <span>{t('কাঁচা বাজার ডেলিভারির সময় সূচী: সকাল ৮ থেকে ১০ এবং সন্ধ্যা ৬ থেকে ৯ পর্যন্ত।', 'Fresh market delivery hours: 8–10 am and 6–9 pm.')}</span>
      </p>
      <div className="field-pair">
        <Field label={t('ঠিকানা', 'Address')}>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder={t('বাসা, রোড, এলাকা', 'House, road, area')} />
        </Field>
        <Field label={t('মোবা', 'Mobile')}>
          <input type="tel" inputMode="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="01XXXXXXXXX" />
        </Field>
      </div>
      <LineTable template="1.7fr .8fr .9fr .8fr" columns={columns} rows={rows} onChange={setRows} addLabel={t('আরো যোগ করতে ক্লিক করুন', 'Click to add more')} />
      <BillSummary
        lines={[
          [t('সর্বমোট বাজারের দাম', 'Total bazar cost'), bazarCost],
          [t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), BAZAR_SHOPPING_FEE],
          [t('ডেলিভারী খরচ', 'Delivery charge'), BAZAR_DELIVERY_FEE],
        ]}
        totalLabel={t('Total Bill', 'Total bill')}
        total={total}
      />
      <ConfirmButton error={error} onConfirm={confirm} />
    </PageCard>
  )
}

function StepRow({ n, label, rateLabel, rate, children }: { n: number; label: string; rateLabel: string; rate: number; children: React.ReactNode }) {
  const { digits, taka } = useLang()
  return (
    <div className="step-row">
      <span className="step-no">{digits(n)}</span>
      <Field label={label}>{children}</Field>
      <div className="field">
        <span>{rateLabel}</span>
        <div className="fixed-rate">{taka(rate)}</div>
      </div>
    </div>
  )
}

function Shifting({ user, onPlaceOrder }: ServiceProps) {
  const { t, lang } = useLang()
  const [loadingArea, setLoadingArea] = useState('')
  const [unloadingArea, setUnloadingArea] = useState('')
  const [vehicleId, setVehicleId] = useState<string>(VEHICLES[0].id)
  const [labourers, setLabourers] = useState('1')
  const [loadingFloor, setLoadingFloor] = useState('1')
  const [unloadingFloor, setUnloadingFloor] = useState('1')
  const [showError, setShowError] = useState(false)
  const vehicle = VEHICLES.find(option => option.id === vehicleId) ?? VEHICLES[0]
  const total = vehicle.rate + toAmount(labourers) * WAGE_PER_LABOURER + toAmount(loadingFloor) * LOADING_RATE_PER_FLOOR + toAmount(unloadingFloor) * UNLOADING_RATE_PER_FLOOR

  const confirm = () => {
    if (!loadingArea.trim() || !unloadingArea.trim()) {
      setShowError(true)
      return
    }
    onPlaceOrder({ service: 'shifting', detail: sameText(`${loadingArea.trim()} → ${unloadingArea.trim()}`), amount: total })
    setLoadingArea('')
    setUnloadingArea('')
    setShowError(false)
  }

  return (
    <PageCard icon={Truck} title={t('বাসা বদল', 'House shifting')}>
      <CustomerInfo user={user} showPoints={false} />
      <div className="field-pair even">
        <Field label={t('Loading Area', 'Loading area')}>
          <input value={loadingArea} onChange={e => setLoadingArea(e.target.value)} placeholder={t('যেমন: মিরপুর ১০', 'e.g. Mirpur 10')} />
        </Field>
        <Field label={t('Unloading Area', 'Unloading area')}>
          <input value={unloadingArea} onChange={e => setUnloadingArea(e.target.value)} placeholder={t('যেমন: উত্তরা', 'e.g. Uttara')} />
        </Field>
      </div>
      <div className="steps">
        <StepRow n={1} label={t('গাড়ী', 'Vehicle')} rateLabel={t('রেট', 'Rate')} rate={vehicle.rate}>
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
            {VEHICLES.map(option => (
              <option key={option.id} value={option.id}>
                {option[lang]}
              </option>
            ))}
          </select>
        </StepRow>
        <StepRow n={2} label={t('লেবার সংখ্যা', 'Number of labourers')} rateLabel={t('জনপ্রতি মজুরী', 'Wage per person')} rate={WAGE_PER_LABOURER}>
          <input type="number" min={0} inputMode="numeric" value={labourers} onChange={e => setLabourers(e.target.value)} />
        </StepRow>
        <StepRow n={3} label={t('ফ্লোর নং (loading)', 'Floor no. (loading)')} rateLabel={t('প্রতি ফ্লোর', 'Per floor')} rate={LOADING_RATE_PER_FLOOR}>
          <input type="number" min={0} inputMode="numeric" value={loadingFloor} onChange={e => setLoadingFloor(e.target.value)} />
        </StepRow>
        <StepRow n={4} label={t('ফ্লোর নং (unloading)', 'Floor no. (unloading)')} rateLabel={t('প্রতি ফ্লোর', 'Per floor')} rate={UNLOADING_RATE_PER_FLOOR}>
          <input type="number" min={0} inputMode="numeric" value={unloadingFloor} onChange={e => setUnloadingFloor(e.target.value)} />
        </StepRow>
      </div>
      <BillSummary lines={[]} totalLabel={t('Total cost', 'Total cost')} total={total} />
      <ConfirmButton error={showError ? t('Loading Area ও Unloading Area দিন।', 'Add the loading and unloading areas.') : null} onConfirm={confirm} />
    </PageCard>
  )
}

function Medicine({ user, onPlaceOrder }: ServiceProps) {
  const { t } = useLang()
  const [address, setAddress] = useState('')
  const [mobile, setMobile] = useState(user.mobile)
  const [prescription, setPrescription] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const [rows, setRows] = useState<Row[]>([{}])
  const [showError, setShowError] = useState(false)
  const columns: Column[] = [
    { key: 'name', label: t('ঔষুধের নাম লিখুন', 'Medicine name'), placeholder: 'Napa' },
    { key: 'company', label: t('কোম্পানীর নাম', 'Company'), placeholder: 'Beximco' },
    { key: 'category', label: t('ক্যাটাগরি', 'Category'), placeholder: t('জ্বর', 'Fever') },
    { key: 'price', label: t('মূল্য', 'Price'), placeholder: '৳', numeric: true },
  ]
  const medicineCost = rows.reduce((sum, row) => sum + toAmount(row.price), 0)
  const total = medicineCost + MEDICINE_DELIVERY_FEE
  const started = rows.filter(isRowStarted)
  const rowsOk = started.every(row => isRowComplete(row, columns))
  const detailsOk = hasValue(address) && hasValue(mobile) && (prescription !== '' || started.length > 0)
  const error = !showError
    ? null
    : !rowsOk
      ? t('প্রতিটি লাইনের সব ঘর পূরণ করুন।', 'Fill every box in each row.')
      : !detailsOk
        ? t('ঠিকানা, মোবাইল নম্বর এবং প্রেসক্রিপশন বা অন্তত একটি ঔষুধের লাইন দিন।', 'Add the address, mobile number, and a prescription or at least one medicine.')
        : null

  const confirm = () => {
    if (!rowsOk || !detailsOk) {
      setShowError(true)
      return
    }
    onPlaceOrder({ service: 'medicine', detail: sameText(started.map(row => row.name.trim()).join(', ') || prescription), amount: total })
    setAddress('')
    setPrescription('')
    setFileInputKey(key => key + 1)
    setRows([{}])
    setShowError(false)
  }

  return (
    <PageCard icon={Pill} title={t('ইমারজেন্সী সেবা', 'Emergency service')} subtitle={t('জরুরী ঔষুধ', 'Emergency medicine')}>
      <CustomerInfo user={user} />
      <div className="field-pair">
        <Field label={t('গ্রহীতার ঠিকানা', "Receiver's address")}>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder={t('বাসা, রোড, এলাকা', 'House, road, area')} />
        </Field>
        <Field label={t('গ্রহীতার মোবা', "Receiver's mobile")}>
          <input type="tel" inputMode="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="01XXXXXXXXX" />
        </Field>
      </div>
      <div className="invoice-upload">
        <input
          key={fileInputKey}
          id="prescription"
          type="file"
          accept="image/*,.pdf"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) setPrescription(file.name)
          }}
        />
        <label htmlFor="prescription">
          <Upload size={17} />
          <span>
            <strong>{t('* প্রেসক্রিপশন এড করুন', '* Add prescription')}</strong>
            <small>{prescription || t('ছবি বা PDF', 'Photo or PDF')}</small>
          </span>
        </label>
      </div>
      <LineTable template="1.4fr 1.1fr 1fr .8fr" columns={columns} rows={rows} onChange={setRows} addLabel={t('আরো এড করুন', 'Add more')} />
      <BillSummary
        lines={[
          [t('ঔষুধ মূল্য', 'Medicine cost'), medicineCost],
          [t('ডেলিভারী চার্জ', 'Delivery charge'), MEDICINE_DELIVERY_FEE],
        ]}
        totalLabel="Total"
        total={total}
      />
      <ConfirmButton error={error} onConfirm={confirm} />
    </PageCard>
  )
}

function Parcel({ user, onPlaceOrder }: ServiceProps) {
  const { t, taka } = useLang()
  const empty = { product: '', weight: '', pickup: '', dropoff: '', receiverMobile: '' }
  const [form, setForm] = useState(empty)
  const [showError, setShowError] = useState(false)
  const bind = (key: keyof typeof empty) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }) })

  const confirm = () => {
    if (!form.product.trim() || !form.pickup.trim() || !form.dropoff.trim() || !form.receiverMobile.trim()) {
      setShowError(true)
      return
    }
    onPlaceOrder({ service: 'parcel', detail: sameText(`${form.product.trim()} · ${form.pickup.trim()} → ${form.dropoff.trim()}`), amount: PARCEL_DELIVERY_FEE })
    setForm(empty)
    setShowError(false)
  }

  return (
    <PageCard icon={PackageCheck} title={t('পণ্য আদান প্রদান', 'Parcel delivery')}>
      <CustomerInfo user={user} />
      <div className="field-rows">
        <InlineField label={t('পণ্যের নাম', 'Product name')}>
          <input {...bind('product')} placeholder={t('যেমন: কাপড়ের ব্যাগ', 'e.g. Bag of clothes')} />
        </InlineField>
        <InlineField label={t('পণ্যের ওজন', 'Product weight')}>
          <input {...bind('weight')} placeholder={t('যেমন: ২ কেজি', 'e.g. 2 kg')} />
        </InlineField>
        <InlineField label={t('গ্রহণের ঠিকানা', 'Pickup address')}>
          <input {...bind('pickup')} placeholder={t('কোথা থেকে নেওয়া হবে', 'Where to collect it')} />
        </InlineField>
        <InlineField label={t('পৌঁছানোর ঠিকানা', 'Delivery address')}>
          <input {...bind('dropoff')} placeholder={t('কোথায় পৌঁছাতে হবে', 'Where to deliver it')} />
        </InlineField>
        <InlineField label={t('গ্রহীতার মোবা', "Receiver's mobile")}>
          <input type="tel" inputMode="tel" {...bind('receiverMobile')} placeholder="01XXXXXXXXX" />
        </InlineField>
        <div className="field-row charge">
          <span>{t('ডেলিভারী খরচ', 'Delivery charge')}</span>
          <div className="fixed-rate">{taka(PARCEL_DELIVERY_FEE)}</div>
        </div>
      </div>
      <ConfirmButton error={showError ? t('পণ্যের নাম, দুই ঠিকানা ও গ্রহীতার মোবাইল নম্বর দিন।', "Add the product name, both addresses and the receiver's mobile.") : null} onConfirm={confirm} />
    </PageCard>
  )
}

function Orders({ orders }: { orders: Order[] }) {
  const { t, lang, taka } = useLang()
  const formatDate = (date: Date) => date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <PageCard icon={ClipboardList} title={t('অর্ডার হিস্ট্রি', 'Order history')} subtitle={t('আপনার সব সেবার অর্ডার এক জায়গায়।', 'All your service orders in one place.')}>
      <div className="order-list">
        {orders.map(order => {
          const service = serviceById(order.service)
          return (
            <article className="order-card" key={order.id}>
              <div className="order-icon">
                <service.icon size={18} />
              </div>
              <div className="order-info">
                <div>
                  <strong>{service[lang]}</strong>
                  <span>{order.id}</span>
                </div>
                <p>{order.detail[lang]}</p>
                <small>{formatDate(order.date)}</small>
              </div>
              <div className="order-total">
                <strong>{taka(order.amount)}</strong>
                <span className={`status-pill ${order.status}`}>{ORDER_STATUS[order.status][lang]}</span>
              </div>
            </article>
          )
        })}
      </div>
    </PageCard>
  )
}

function Profile({ user, onSave }: { user: User; onSave: (user: User) => void }) {
  const { t } = useLang()
  const [draft, setDraft] = useState(user)
  const [saved, setSaved] = useState(false)
  const edit = (key: 'name' | 'mobile' | 'location') => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft({ ...draft, [key]: e.target.value })
    setSaved(false)
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
          <input value={draft.name} onChange={edit('name')} />
        </Field>
        <Field label={t('মোবাইল নম্বর', 'Mobile number')}>
          <input type="tel" inputMode="tel" value={draft.mobile} onChange={edit('mobile')} />
        </Field>
        <Field label={t('লোকেশন', 'Location')}>
          <input value={draft.location} onChange={edit('location')} placeholder={t('যেমন: মিরপুর ১০, ঢাকা', 'e.g. Mirpur 10, Dhaka')} />
        </Field>
      </div>
      {saved && <p className="form-success">{t('প্রোফাইল সেভ হয়েছে।', 'Profile saved.')}</p>}
      <button
        type="button"
        className="primary-button"
        onClick={() => {
          onSave({ ...draft, name: draft.name.trim() || user.name })
          setSaved(true)
        }}
      >
        <Check size={17} />
        {t('প্রোফাইল সেভ করুন', 'Save profile')}
      </button>
    </PageCard>
  )
}

export default function Page() {
  const [lang, setLang] = useState<Lang>('bn')
  const [user, setUser] = useState<User | null>(null)
  const [active, setActive] = useState<View>('bazar')
  const [menuOpen, setMenuOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>(SAMPLE_ORDERS)
  const t = (bn: string, en: string) => (lang === 'bn' ? bn : en)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  if (!user) {
    return (
      <LangContext.Provider value={lang}>
        <Auth
          lang={lang}
          onLangChange={setLang}
          onComplete={newUser => {
            setUser(newUser)
            setActive('bazar')
          }}
        />
      </LangContext.Provider>
    )
  }

  const choose = (view: View) => {
    setActive(view)
    setMenuOpen(false)
    window.scrollTo({ top: 0 })
  }
  const placeOrder = (order: NewOrder) => {
    setOrders(current => [{ ...order, id: `${ORDER_PREFIX}-${1046 + current.length}`, date: new Date(), status: 'pending' }, ...current])
    choose('orders')
  }
  const signOut = () => {
    setUser(null)
    setMenuOpen(false)
    setOrders(SAMPLE_ORDERS)
  }

  return (
    <LangContext.Provider value={lang}>
      <main className="app-shell">
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <div className="sidebar-top">
            <Logo />
            <button className="icon-button close-menu" aria-label={t('মেনু বন্ধ করুন', 'Close menu')} onClick={() => setMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="workspace">
            <div className="avatar">{user.name[0]}</div>
            <div>
              <strong>{user.name}</strong>
              <span>
                {user.mobile} · {t('point', 'Points')} {user.points}
              </span>
            </div>
            <ChevronRight size={16} />
          </div>
          <nav className="side-nav" aria-label={t('প্রধান মেনু', 'Main navigation')}>
            <p className="nav-label">{t('সেবাসমূহ', 'SERVICES')}</p>
            {SERVICES.map(service => (
              <button key={service.id} className={`nav-item ${active === service.id ? 'active' : ''}`} onClick={() => choose(service.id)}>
                <service.icon size={19} />
                <span>{service[lang]}</span>
              </button>
            ))}
            <p className="nav-label account-label">{t('অ্যাকাউন্ট', 'ACCOUNT')}</p>
            <button className={`nav-item ${active === 'orders' ? 'active' : ''}`} onClick={() => choose('orders')}>
              <ClipboardList size={19} />
              <span>{t('অর্ডার হিস্ট্রি', 'Order history')}</span>
            </button>
            <button className={`nav-item ${active === 'profile' ? 'active' : ''}`} onClick={() => choose('profile')}>
              <UserRound size={19} />
              <span>{t('প্রোফাইল', 'Profile')}</span>
            </button>
          </nav>
          <button className="logout" onClick={signOut}>
            {t('সাইন আউট', 'Sign out')}
          </button>
        </aside>
        {menuOpen && <button className="scrim" aria-label={t('মেনু বন্ধ করুন', 'Close menu')} onClick={() => setMenuOpen(false)} />}
        <section className="content">
          <header className="topbar">
            <button className="icon-button menu-trigger" aria-label={t('মেনু খুলুন', 'Open menu')} onClick={() => setMenuOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="mobile-logo">
              <Logo />
            </div>
            <div className="topbar-right">
              <LangToggle compact lang={lang} onChange={setLang} />
              <div className="top-avatar">{user.name[0]}</div>
            </div>
          </header>
          <div className="page-body">
            {/* Service screens stay mounted so their inputs survive tab switches. */}
            <div hidden={active !== 'bazar'}>
              <Bazar user={user} onPlaceOrder={placeOrder} />
            </div>
            <div hidden={active !== 'shifting'}>
              <Shifting user={user} onPlaceOrder={placeOrder} />
            </div>
            <div hidden={active !== 'medicine'}>
              <Medicine user={user} onPlaceOrder={placeOrder} />
            </div>
            <div hidden={active !== 'parcel'}>
              <Parcel user={user} onPlaceOrder={placeOrder} />
            </div>
            {active === 'orders' && <Orders orders={orders} />}
            {active === 'profile' && <Profile user={user} onSave={setUser} />}
          </div>
          <ContactDock raised />
          <nav className="bottom-nav" aria-label={t('সেবাসমূহ', 'Services')}>
            {SERVICES.map(service => (
              <button key={service.id} className={active === service.id ? 'active' : ''} aria-current={active === service.id ? 'page' : undefined} onClick={() => choose(service.id)}>
                <service.icon size={20} />
                <span>{service[lang]}</span>
              </button>
            ))}
          </nav>
        </section>
      </main>
    </LangContext.Provider>
  )
}

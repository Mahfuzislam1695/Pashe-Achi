/**
 * Demo data for `npm run db:seed:demo`: a realistic month of Pashe Achi, built the way the app itself
 * would have built it.
 * - A demo manager (01822222222) and operator (01833333333), and 8 customers, including the demo
 *   customer Rahim Uddin (01811111111) with the prototype's three orders (760, 1420 and 160 taka).
 *   Every demo password is demo1234.
 * - About 60 orders over the last 30 days across all four services and every status. Totals come
 *   from the shared calculators and the current pricing row; every step has a sensible later time,
 *   the right admin, a timeline event, a history entry and the notifications the app would send.
 * - Admin sign-ins (and two failed ones), points, a blocked customer, a profile change and an
 *   announcement, all in the history log.
 * The data is the same on every run (seeded randomness), relative to today. It is written in one
 * transaction and skipped if the demo customer already exists. The demo business "opened" 45 days
 * ago, so a super admin and the setup history created by the base seed are dated back to then.
 */
import {
  type AuditChange,
  calcBazar,
  calcMedicine,
  calcParcel,
  calcShifting,
  DEFAULT_PRICING,
  isoDateInBd,
  type OrderStatus,
  type Pricing,
  type ServiceId,
} from '@/shared'
import bcrypt from 'bcryptjs'

import type { AuditActor } from '../src/server/audit/actor'
import { type AuditEntry, toAuditRow } from '../src/server/audit/audit.mapper'
import type { Admin, Prisma, PrismaClient, Vehicle } from '../src/server/generated/prisma/client'
import { billUpdatedContent, customerCancelledContent, orderCreatedContent, statusChangedContent } from '../src/server/notifications/notification.content'
import { type NotificationContent, toNotificationRow } from '../src/server/notifications/notification.mapper'

const DEMO_PASSWORD = 'demo1234'
const DEMO_CUSTOMER_MOBILE = '01811111111'
const ORDER_DAYS = 30
const OPENED_DAYS_AGO = 45

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

// Seeded randomness, so every run builds the same month.
let seed = 20261010
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
const chance = (probability: number) => random() < probability
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!
const pickWeighted = <T extends { weight: number }>(items: readonly T[]): T => {
  let roll = random() * items.reduce((sum, item) => sum + item.weight, 0)
  for (const item of items) if ((roll -= item.weight) < 0) return item
  return items[items.length - 1]!
}
const sample = <T>(items: readonly T[], count: number) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy.slice(0, count)
}
const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step)

// Bangladesh calendar days (UTC+6, no DST).
const pad = (n: number) => String(n).padStart(2, '0')
const bdAt = (day: string, hour: number, minute = 0) => new Date(`${day}T${pad(hour)}:${pad(minute)}:00+06:00`)
const addDays = (day: string, days: number) => isoDateInBd(new Date(bdAt(day, 12).getTime() + days * DAY))
const later = (date: Date, minMinutes: number, maxMinutes: number) => new Date(date.getTime() + int(minMinutes, maxMinutes) * MINUTE)
const maxDate = (...dates: Date[]) => new Date(Math.max(...dates.map(date => date.getTime())))

// Browsers and addresses. IPs are from the documentation ranges (RFC 5737), never real ones.
const DEVICES = {
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  androidChromeOld: 'Mozilla/5.0 (Linux; Android 11; Redmi Note 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:130.0) Gecko/20100101 Firefox/130.0',
}

interface Device {
  userAgent: string
  ip: string
}

const STAFF = [
  { name: 'Nusrat Jahan', mobile: '01822222222', role: 'MANAGER' as const, device: { userAgent: DEVICES.androidChrome, ip: '198.51.100.21' } },
  { name: 'Sabbir Ahmed', mobile: '01833333333', role: 'OPERATOR' as const, device: { userAgent: DEVICES.windowsChrome, ip: '198.51.100.35' } },
]
const SUPER_ADMIN_DEVICE: Device = { userAgent: DEVICES.windowsChrome, ip: '192.0.2.10' }

const CUSTOMERS = [
  { name: 'Rahim Uddin', mobile: DEMO_CUSTOMER_MOBILE, area: 'মিরপুর ১০', joined: 40, weight: 0, lang: 'bn' as const, device: { userAgent: DEVICES.androidChrome, ip: '203.0.113.11' } },
  { name: 'ফাতেমা বেগম', mobile: '01711000002', area: 'ধানমন্ডি ২৭', joined: 39, weight: 3, lang: 'bn' as const, device: { userAgent: DEVICES.androidChromeOld, ip: '203.0.113.12' } },
  { name: 'Kamal Hossain', mobile: '01911000003', area: 'উত্তরা সেক্টর ৭', joined: 37, weight: 2, lang: 'bn' as const, device: { userAgent: DEVICES.iphoneSafari, ip: '203.0.113.13' } },
  { name: 'আয়েশা সিদ্দিকা', mobile: '01511000004', area: 'মোহাম্মদপুর', joined: 36, weight: 2, lang: 'bn' as const, device: { userAgent: DEVICES.androidChrome, ip: '203.0.113.14' } },
  { name: 'Tanvir Rahman', mobile: '01611000005', area: 'বনানী', joined: 35, weight: 1, lang: 'en' as const, device: { userAgent: DEVICES.iphoneSafari, ip: '203.0.113.15' } },
  { name: 'নাসরিন আক্তার', mobile: '01311000006', area: 'বাড্ডা', joined: 34, weight: 2, lang: 'bn' as const, device: { userAgent: DEVICES.androidChromeOld, ip: '203.0.113.16' } },
  { name: 'Jahid Hasan', mobile: '01411000007', area: 'বসুন্ধরা আ/এ', joined: 33, weight: 1, lang: 'bn' as const, device: { userAgent: DEVICES.androidChrome, ip: '203.0.113.17' } },
  { name: 'Sumaiya Islam', mobile: '01711000008', area: 'মতিঝিল', joined: 32, weight: 1, lang: 'en' as const, device: { userAgent: DEVICES.macFirefox, ip: '203.0.113.18' } },
]
/** Jahid is blocked by the manager this many days ago, and orders nothing after that. */
const BLOCKED_DAYS_AGO = 12

const AREAS = ['মিরপুর ১০', 'মিরপুর ২', 'ধানমন্ডি ২৭', 'উত্তরা সেক্টর ৭', 'মোহাম্মদপুর', 'বনানী', 'গুলশান ১', 'বাড্ডা', 'বসুন্ধরা আ/এ', 'মতিঝিল', 'শ্যামলী', 'খিলগাঁও', 'রামপুরা', 'মালিবাগ']

const BAZAR_ITEMS = [
  { name: 'চাল', quantities: ['5 কেজি', '10 কেজি'], varieties: ['মিনিকেট', 'নাজিরশাইল', 'আটাশ'], price: [350, 800] },
  { name: 'ডাল', quantities: ['1 কেজি', '2 কেজি'], varieties: ['মসুর', 'মুগ'], price: [120, 280] },
  { name: 'আলু', quantities: ['2 কেজি', '3 কেজি'], varieties: ['দেশি', 'ডায়মন্ড'], price: [60, 120] },
  { name: 'পেঁয়াজ', quantities: ['1 কেজি', '2 কেজি'], varieties: ['দেশি', 'ভারতীয়'], price: [70, 180] },
  { name: 'রুই মাছ', quantities: ['1 কেজি', '1.5 কেজি'], varieties: [], price: [320, 520] },
  { name: 'মুরগি', quantities: ['1টি', '2টি'], varieties: ['ব্রয়লার', 'সোনালি', 'দেশি'], price: [220, 700] },
  { name: 'ডিম', quantities: ['1 ডজন', '2 ডজন'], varieties: ['ফার্ম', 'দেশি'], price: [140, 320] },
  { name: 'সয়াবিন তেল', quantities: ['1 লিটার', '2 লিটার'], varieties: ['বোতল'], price: [170, 340] },
  { name: 'টমেটো', quantities: ['1 কেজি'], varieties: [], price: [60, 120] },
  { name: 'কাঁচা মরিচ', quantities: ['250 গ্রাম'], varieties: [], price: [30, 60] },
  { name: 'লাউ', quantities: ['1টি'], varieties: [], price: [50, 80] },
  { name: 'দুধ', quantities: ['1 লিটার', '2 লিটার'], varieties: ['গরুর'], price: [90, 180] },
]

const MEDICINES = [
  { name: 'Napa', company: 'Beximco', category: 'জ্বর', price: 12 },
  { name: 'Napa Extra', company: 'Beximco', category: 'মাথাব্যথা', price: 25 },
  { name: 'Seclo 20', company: 'Square', category: 'গ্যাস্ট্রিক', price: 70 },
  { name: 'Maxpro 20', company: 'Renata', category: 'গ্যাস্ট্রিক', price: 80 },
  { name: 'Fexo 120', company: 'Square', category: 'এলার্জি', price: 90 },
  { name: 'Alatrol', company: 'Square', category: 'এলার্জি', price: 30 },
  { name: 'Ace Plus', company: 'Square', category: 'জ্বর', price: 25 },
  { name: 'Monas 10', company: 'ACME', category: 'অ্যাজমা', price: 150 },
  { name: 'Calbo-D', company: 'Square', category: 'ক্যালসিয়াম', price: 110 },
]

const PARCEL_PRODUCTS = ['ডকুমেন্ট', 'জামাকাপড়', 'মোবাইল চার্জার', 'বই', 'মিষ্টির প্যাকেট', 'ল্যাপটপ ব্যাগ', 'ওষুধের প্যাকেট']
const PARCEL_WEIGHTS = ['500 গ্রাম', '1 কেজি', '2 কেজি', null]
const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '15:00', '17:00', '18:00', '20:00']

const ORDER_NOTES = ['দারোয়ানকে দিলেই হবে', 'আসার আগে ফোন দেবেন', 'বাসা চারতলায়, লিফট আছে']
const STATUS_NOTES: Partial<Record<OrderStatus, string[]>> = {
  BOOKED: ['রাইডার ৩০ মিনিটে পৌঁছাবে', 'সময়মতো পৌঁছে যাবে', 'গাড়ী ঠিক করা হয়েছে'],
  IN_PROGRESS: ['রাইডার পথে আছে', 'বাজার করা হচ্ছে'],
}
const CANCEL_NOTES = ['গ্রাহক ফোন ধরেননি', 'এই এলাকায় আজ সেবা দেওয়া যাচ্ছে না', 'গ্রাহক নিজে বাতিল করতে বলেছেন']
const BILL_NOTES = ['বাজারে দাম বেশি ছিল', 'দোকানের রসিদ অনুযায়ী দাম বসানো হয়েছে', 'মাছের দাম বেড়েছে']

type DemoCustomer = (typeof CUSTOMERS)[number] & { id: string; actor: AuditActor; location: string }

interface PlannedItem {
  name: string
  quantity: string
  variety?: string
  company?: string
  category?: string
  price: number | null
  /** After the bill correction (same as price when there is none). */
  finalPrice: number | null
}

interface Step {
  to: OrderStatus
  at: Date
  by: AuditActor
  note?: string
}

interface PlannedOrder {
  customer: DemoCustomer
  service: ServiceId
  placedAt: Date
  scheduledDate: string
  scheduledTime: string
  address: string | null
  note: string | null
  items: PlannedItem[]
  shifting?: { loadingArea: string; unloadingArea: string; vehicle: Vehicle; labourers: number; loadingFloor: number; unloadingFloor: number }
  parcel?: { product: string; weight: string | null; pickupAddress: string; dropoffAddress: string; receiverMobile: string }
  steps: Step[]
  bill?: { at: Date; by: AuditActor; note: string }
}

const actorFor = (row: { id: string; name: string; role?: Admin['role'] }, device: Device): AuditActor => ({
  type: row.role ? 'ADMIN' : 'CUSTOMER',
  id: row.id,
  name: row.name,
  role: row.role,
  ...device,
})

const homeAddress = (area: string) => `বাসা ${int(2, 98)}, রোড ${int(1, 18)}, ${area}`

function billFor(plan: PlannedOrder, pricing: Pricing, price: (item: PlannedItem) => number | null) {
  switch (plan.service) {
    case 'bazar':
      return calcBazar(pricing, plan.items.map(price))
    case 'medicine':
      return calcMedicine(pricing, plan.items.map(price))
    case 'shifting':
      return calcShifting(pricing, { vehicleRate: plan.shifting!.vehicle.rate, ...plan.shifting! })
    case 'parcel':
      return calcParcel(pricing)
  }
}

const summaryOf = (plan: PlannedOrder) => {
  const text =
    plan.service === 'shifting'
      ? `${plan.shifting!.loadingArea} → ${plan.shifting!.unloadingArea}`
      : plan.service === 'parcel'
        ? `${plan.parcel!.product} · ${plan.parcel!.pickupAddress} → ${plan.parcel!.dropoffAddress}`
        : plan.items.map(item => item.name).join(', ')
  return text.length > 300 ? `${text.slice(0, 299)}…` : text
}

const bdHour = (date: Date) => Number(date.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Dhaka' }))

/** What was ordered: lines, addresses, the shifting or parcel details. `priced` false leaves some bazar prices for staff to fill in. */
function planContent(customer: DemoCustomer, service: ServiceId, placedAt: Date, schedule: { date: string; time: string }, vehicles: Vehicle[], priced = true): PlannedOrder {
  const plan: PlannedOrder = {
    customer,
    service,
    placedAt,
    scheduledDate: schedule.date,
    scheduledTime: schedule.time,
    address: null,
    note: chance(0.2) ? pick(ORDER_NOTES) : null,
    items: [],
    steps: [],
  }
  if (service === 'bazar') {
    plan.address = homeAddress(customer.area)
    plan.items = sample(BAZAR_ITEMS, int(2, 5)).map(item => {
      const price = roundTo(int(item.price[0]!, item.price[1]!), 10)
      return {
        name: item.name,
        quantity: pick(item.quantities),
        variety: item.varieties.length && chance(0.7) ? pick(item.varieties) : undefined,
        price: !priced && chance(0.6) ? null : price,
        finalPrice: price,
      }
    })
  } else if (service === 'medicine') {
    plan.address = homeAddress(customer.area)
    plan.items = sample(MEDICINES, int(1, 3)).map(medicine => {
      const strips = int(1, 3)
      return { ...medicine, quantity: `${strips} পাতা`, price: medicine.price * strips, finalPrice: medicine.price * strips }
    })
  } else if (service === 'shifting') {
    plan.shifting = {
      loadingArea: customer.area,
      unloadingArea: pick(AREAS.filter(area => area !== customer.area)),
      vehicle: pick(vehicles),
      labourers: int(1, 4),
      loadingFloor: int(0, 6),
      unloadingFloor: int(0, 6),
    }
  } else {
    plan.parcel = {
      product: pick(PARCEL_PRODUCTS),
      weight: pick(PARCEL_WEIGHTS),
      pickupAddress: homeAddress(customer.area),
      dropoffAddress: homeAddress(pick(AREAS.filter(area => area !== customer.area))),
      receiverMobile: `017${String(int(10_000_000, 99_999_999))}`,
    }
  }
  return plan
}

/** A delivery slot at least two hours after `placedAt`: the same day when there is one (and a coin says so), else the next day. */
function scheduleAfter(placedAt: Date) {
  const day = isoDateInBd(placedAt)
  const sameDaySlots = TIME_SLOTS.filter(slot => Number(slot.slice(0, 2)) >= bdHour(placedAt) + 2)
  return sameDaySlots.length > 0 && chance(0.55) ? { date: day, time: pick(sameDaySlots) } : { date: addDays(day, 1), time: pick(TIME_SLOTS) }
}

const randomService = () =>
  pickWeighted<{ service: ServiceId; weight: number }>([
    { service: 'bazar', weight: 40 },
    { service: 'medicine', weight: 25 },
    { service: 'parcel', weight: 20 },
    { service: 'shifting', weight: 15 },
  ]).service

const CANCELLATIONS = ['customer_cancel', 'cancel_pending', 'cancel_booked'] as const

/**
 * A random order on `day`, or null if that time hasn't come yet today. `sequence` counts the older
 * orders: every sixth one is cancelled, taking turns between the three ways an order gets cancelled.
 */
function planRandomOrder(
  customer: DemoCustomer,
  day: string,
  daysAgo: number,
  sequence: number,
  now: Date,
  vehicles: Vehicle[],
  staff: { operator: AuditActor; manager: AuditActor },
): PlannedOrder | null {
  const opens = bdAt(day, 8, 0)
  const closes = new Date(Math.min(bdAt(day, 22, 0).getTime(), now.getTime() - 20 * MINUTE))
  if (closes <= opens) return null
  const placedAt = new Date(opens.getTime() + Math.floor(random() * (closes.getTime() - opens.getTime())))
  const service = randomService()
  const plan = planContent(customer, service, placedAt, scheduleAfter(placedAt), vehicles, !chance(0.3))

  // How far it got: older orders are finished (or cancelled); yesterday's and today's are still moving.
  const handler = chance(0.7) ? staff.operator : staff.manager
  const roll = random()
  const outcome =
    daysAgo >= 2
      ? sequence % 6 === 5
        ? CANCELLATIONS[Math.floor(sequence / 6) % CANCELLATIONS.length]!
        : 'COMPLETED'
      : daysAgo === 1
        ? roll < 0.6
          ? 'COMPLETED'
          : roll < 0.85
            ? 'IN_PROGRESS'
            : 'BOOKED'
        : roll < 0.5
          ? 'PENDING'
          : 'BOOKED'

  const booked = later(placedAt, 5, 45)
  const scheduledAt = bdAt(plan.scheduledDate, Number(plan.scheduledTime.slice(0, 2)), Number(plan.scheduledTime.slice(3)))
  const started = maxDate(later(booked, 20, 90), new Date(scheduledAt.getTime() - int(0, 45) * MINUTE))
  const finished = service === 'shifting' ? later(started, 120, 300) : later(started, 30, 120)
  const bookedNote = chance(0.35) ? pick(STATUS_NOTES.BOOKED!) : undefined

  if (outcome === 'customer_cancel') plan.steps = [{ to: 'CANCELLED', at: later(placedAt, 3, 30), by: customer.actor }]
  else if (outcome === 'cancel_pending') plan.steps = [{ to: 'CANCELLED', at: later(placedAt, 10, 60), by: handler, note: pick(CANCEL_NOTES) }]
  else if (outcome === 'cancel_booked') {
    plan.steps = [
      { to: 'BOOKED', at: booked, by: handler, note: bookedNote },
      { to: 'CANCELLED', at: later(booked, 30, 180), by: handler, note: pick(CANCEL_NOTES) },
    ]
  } else if (outcome !== 'PENDING') {
    plan.steps.push({ to: 'BOOKED', at: booked, by: handler, note: bookedNote })
    const skipInProgress = outcome === 'COMPLETED' && chance(0.15)
    if (outcome !== 'BOOKED' && !skipInProgress) plan.steps.push({ to: 'IN_PROGRESS', at: started, by: handler, note: chance(0.2) ? pick(STATUS_NOTES.IN_PROGRESS!) : undefined })
    if (outcome === 'COMPLETED') plan.steps.push({ to: 'COMPLETED', at: finished, by: handler })
  }
  // Nothing happens in the future: the order stops at the last step that has already happened.
  const cutoff = now.getTime() - 2 * MINUTE
  const firstFuture = plan.steps.findIndex(step => step.at.getTime() > cutoff)
  if (firstFuture >= 0) plan.steps = plan.steps.slice(0, firstFuture)

  // Bazar lines bought without a price get their real price once booked, and sometimes a price was wrong.
  const bookedStep = plan.steps.find(step => step.to === 'BOOKED')
  const cancelled = plan.steps.some(step => step.to === 'CANCELLED')
  const needsPrices = plan.items.some(item => item.price === null)
  if (bookedStep && !cancelled && (service === 'bazar' || service === 'medicine') && (needsPrices || chance(0.15))) {
    if (!needsPrices) {
      const item = pick(plan.items)
      item.finalPrice = roundTo((item.price ?? 0) * (1 + int(10, 30) / 100), 5)
    }
    const next = plan.steps[plan.steps.indexOf(bookedStep) + 1]
    const at = later(bookedStep.at, 10, 40)
    if ((!next || at < next.at) && at.getTime() <= cutoff) plan.bill = { at, by: bookedStep.by, note: pick(BILL_NOTES) }
  }
  if (!plan.bill) for (const item of plan.items) item.finalPrice = item.price
  return plan
}

/** Orders happening right now, whatever the time of day: one being shopped for, one booked, one just placed. */
function liveOrders(pickCustomer: () => DemoCustomer, now: Date, vehicles: Vehicle[], staff: { operator: AuditActor; manager: AuditActor }): PlannedOrder[] {
  const ago = (minutes: number) => new Date(now.getTime() - minutes * MINUTE)
  const soon = new Date(now.getTime() + 30 * MINUTE)

  const shopping = planContent(pickCustomer(), 'bazar', ago(170), { date: isoDateInBd(soon), time: `${pad(bdHour(soon))}:00` }, vehicles)
  shopping.steps = [
    { to: 'BOOKED', at: ago(158), by: staff.operator, note: 'রাইডার ৩০ মিনিটে পৌঁছাবে' },
    { to: 'IN_PROGRESS', at: ago(50), by: staff.operator, note: 'বাজার করা হচ্ছে' },
  ]
  const booked = planContent(pickCustomer(), 'parcel', ago(95), scheduleAfter(ago(95)), vehicles)
  booked.steps = [{ to: 'BOOKED', at: ago(81), by: staff.manager }]
  const placed = planContent(pickCustomer(), randomService(), ago(12), scheduleAfter(ago(12)), vehicles)
  return [shopping, booked, placed]
}

/** The three orders of the original prototype, for the demo customer: 760, 1420 and 160 taka with the sketch prices. */
function prototypeOrders(rahim: DemoCustomer, now: Date, today: string, vehicles: Vehicle[], staff: { operator: AuditActor; manager: AuditActor }): PlannedOrder[] {
  const threeDaysAgo = addDays(today, -3)
  const yesterday = addDays(today, -1)
  const bazarPlaced = bdAt(threeDaysAgo, 8, 40)
  const shiftingPlaced = bdAt(yesterday, 19, 15)
  const medicinePlaced = new Date(now.getTime() - 25 * MINUTE)
  const lateToday = bdHour(now) >= 19
  const address = 'বাসা ১২, রোড ৩, মিরপুর ১০'
  const priced = (name: string, quantity: string, price: number, extra: Partial<PlannedItem> = {}): PlannedItem => ({ name, quantity, price, finalPrice: price, ...extra })
  const vehicle = vehicles.find(row => row.slug === 'covered-van') ?? vehicles[0]!

  return [
    {
      customer: rahim,
      service: 'bazar',
      placedAt: bazarPlaced,
      scheduledDate: threeDaysAgo,
      scheduledTime: '10:00',
      address,
      note: null,
      items: [priced('চাল', '5 কেজি', 350, { variety: 'মিনিকেট' }), priced('আলু', '2 কেজি', 80, { variety: 'দেশি' }), priced('রুই মাছ', '1 কেজি', 100)],
      steps: [
        { to: 'BOOKED', at: bdAt(threeDaysAgo, 8, 52), by: staff.operator, note: 'রাইডার ৩০ মিনিটে পৌঁছাবে' },
        { to: 'IN_PROGRESS', at: bdAt(threeDaysAgo, 9, 25), by: staff.operator },
        { to: 'COMPLETED', at: bdAt(threeDaysAgo, 10, 35), by: staff.operator },
      ],
    },
    {
      customer: rahim,
      service: 'shifting',
      placedAt: shiftingPlaced,
      scheduledDate: addDays(today, 1),
      scheduledTime: '10:00',
      address: null,
      note: null,
      items: [],
      shifting: { loadingArea: 'মিরপুর ১০', unloadingArea: 'উত্তরা', vehicle: { ...vehicle, rate: 1200 }, labourers: 1, loadingFloor: 1, unloadingFloor: 1 },
      steps: [{ to: 'BOOKED', at: bdAt(yesterday, 19, 40), by: staff.manager, note: 'গাড়ী ঠিক করা হয়েছে' }],
    },
    {
      customer: rahim,
      service: 'medicine',
      placedAt: medicinePlaced,
      scheduledDate: lateToday ? addDays(today, 1) : today,
      scheduledTime: '20:00',
      address,
      note: null,
      items: [
        priced('Napa', '1 পাতা', 12, { company: 'Beximco', category: 'জ্বর' }),
        priced('Seclo', '1 পাতা', 88, { company: 'Square', category: 'গ্যাস্ট্রিক' }),
      ],
      steps: [],
    },
  ]
}

export async function seedDemo(prisma: PrismaClient) {
  if (await prisma.user.findUnique({ where: { mobile: DEMO_CUSTOMER_MOBILE } })) {
    console.log('✔ demo data already exists (demo customer 01811111111)')
    return
  }
  const taken = await prisma.user.findMany({ where: { mobile: { in: CUSTOMERS.map(customer => customer.mobile) } }, select: { mobile: true } })
  if (taken.length) {
    console.warn(`! skipped the demo data: these customer numbers are already used: ${taken.map(row => row.mobile).join(', ')}`)
    return
  }
  const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
  if (!vehicles.length) throw new Error('No active vehicles: run `npm run db:seed` first')
  const pricingRow = await prisma.pricing.findUnique({ where: { id: 1 } })
  const { id: _, updatedAt: __, ...pricing }: Pricing & { id?: number; updatedAt?: Date } = pricingRow ?? DEFAULT_PRICING
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  const now = new Date()
  const today = isoDateInBd(now)
  const dayAgo = (days: number) => addDays(today, -days)
  const opened = bdAt(dayAgo(OPENED_DAYS_AGO), 9, 0)

  const summary = await prisma.$transaction(
    async tx => {
      const audit: AuditEntry[] = []
      const notifications: Prisma.NotificationCreateManyInput[] = []
      // Staff have read everything before today; customers everything older than two days.
      const notify = (to: { userId: string } | { adminId: string }, content: NotificationContent, at: Date) => {
        const read = 'adminId' in to ? isoDateInBd(at) !== today : now.getTime() - at.getTime() > 2 * DAY
        const readAt = read ? new Date(Math.min(later(at, 5, 180).getTime(), now.getTime())) : null
        notifications.push({ ...toNotificationRow(content), ...to, createdAt: at, readAt })
      }

      // The business opened 45 days ago: date the super admin and the base seed's setup history from then.
      const superAdminRow = await tx.admin.findFirst({ where: { role: 'SUPER_ADMIN', isActive: true }, orderBy: { createdAt: 'asc' } })
      if (superAdminRow && superAdminRow.createdAt > opened) await tx.admin.update({ where: { id: superAdminRow.id }, data: { createdAt: opened } })
      await tx.auditLog.updateMany({ where: { actorType: 'SYSTEM', createdAt: { gt: opened } }, data: { createdAt: opened } })
      const superAdmin = superAdminRow ? actorFor(superAdminRow, SUPER_ADMIN_DEVICE) : null

      // Staff, added by the super admin.
      const staffActors = new Map<string, AuditActor>()
      const admins: Admin[] = superAdminRow ? [superAdminRow] : []
      for (const [index, spec] of STAFF.entries()) {
        let admin = await tx.admin.findUnique({ where: { mobile: spec.mobile } })
        if (!admin) {
          const at = later(opened, 20 + index * 15, 20 + index * 15)
          admin = await tx.admin.create({ data: { name: spec.name, mobile: spec.mobile, role: spec.role, passwordHash, createdAt: at } })
          audit.push({
            action: 'STAFF_CREATED',
            actor: superAdmin ?? { type: 'SYSTEM', id: null, name: 'System' },
            entity: { type: 'STAFF', id: admin.id, label: admin.name },
            changes: [
              { field: 'name', from: null, to: admin.name },
              { field: 'mobile', from: null, to: admin.mobile },
              { field: 'role', from: null, to: admin.role },
            ],
            at,
          })
        }
        if (admin.isActive) admins.push(admin)
        staffActors.set(spec.mobile, actorFor(admin, spec.device))
      }
      const [managerSpec, operatorSpec] = STAFF
      const staff = { manager: staffActors.get(managerSpec!.mobile)!, operator: staffActors.get(operatorSpec!.mobile)! }

      // Customers sign up.
      const customers: DemoCustomer[] = []
      for (const spec of CUSTOMERS) {
        const joinedAt = bdAt(dayAgo(spec.joined), int(10, 21), int(0, 59))
        const location = `${spec.area}, ঢাকা`
        const user = await tx.user.create({ data: { name: spec.name, mobile: spec.mobile, location, lang: spec.lang, passwordHash, createdAt: joinedAt } })
        const customer: DemoCustomer = { ...spec, id: user.id, location, actor: actorFor(user, spec.device) }
        customers.push(customer)
        audit.push({ action: 'CUSTOMER_SIGNED_UP', actor: customer.actor, entity: { type: 'CUSTOMER', id: user.id, label: user.name }, at: joinedAt })
      }
      const byMobile = (mobile: string) => customers.find(customer => customer.mobile === mobile)!

      // A month of orders, placed in time order so the order numbers rise with the dates.
      const regulars = (daysAgo: number) => customers.filter(customer => customer.weight > 0 && (customer.mobile !== '01411000007' || daysAgo > BLOCKED_DAYS_AGO))
      const plans = [
        ...prototypeOrders(byMobile(DEMO_CUSTOMER_MOBILE), now, today, vehicles, staff),
        ...liveOrders(() => pickWeighted(regulars(0)), now, vehicles, staff),
      ]
      let olderOrders = 0
      for (let daysAgo = ORDER_DAYS - 1; daysAgo >= 0; daysAgo--) {
        for (let n = int(1, 3); n > 0; n--) {
          const plan = planRandomOrder(pickWeighted(regulars(daysAgo)), dayAgo(daysAgo), daysAgo, daysAgo >= 2 ? olderOrders++ : 0, now, vehicles, staff)
          if (plan) plans.push(plan)
        }
      }
      plans.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime())

      for (const plan of plans) {
        const placed = billFor(plan, pricing, item => item.price)
        const final = plan.bill ? billFor(plan, pricing, item => item.finalPrice) : placed
        const status = plan.steps.at(-1)?.to ?? 'PENDING'
        const lastAt = maxDate(plan.placedAt, ...plan.steps.map(step => step.at), ...(plan.bill ? [plan.bill.at] : []))
        let from: OrderStatus = 'PENDING'
        const events = [
          { to: 'PENDING' as OrderStatus, from: null as OrderStatus | null, actor: 'CUSTOMER' as const, createdAt: plan.placedAt },
          ...plan.steps.map(step => {
            const event = { from, to: step.to, note: step.note ?? null, actor: step.by.type, adminId: step.by.type === 'ADMIN' ? step.by.id : null, createdAt: step.at }
            from = step.to
            return event
          }),
        ]
        const order = await tx.order.create({
          data: {
            userId: plan.customer.id,
            service: plan.service,
            status,
            summary: summaryOf(plan),
            contactMobile: plan.customer.mobile,
            address: plan.address,
            note: plan.note,
            scheduledDate: new Date(`${plan.scheduledDate}T00:00:00.000Z`),
            scheduledTime: plan.scheduledTime,
            ...final,
            createdAt: plan.placedAt,
            updatedAt: lastAt,
            items: {
              create: plan.items.map((item, index) => ({
                position: index + 1,
                name: item.name,
                quantity: item.quantity,
                variety: item.variety ?? null,
                company: item.company ?? null,
                category: item.category ?? null,
                price: item.finalPrice,
              })),
            },
            ...(plan.shifting
              ? {
                  shifting: {
                    create: {
                      loadingArea: plan.shifting.loadingArea,
                      unloadingArea: plan.shifting.unloadingArea,
                      vehicleId: plan.shifting.vehicle.id,
                      vehicleNameBn: plan.shifting.vehicle.nameBn,
                      vehicleNameEn: plan.shifting.vehicle.nameEn,
                      vehicleRate: plan.shifting.vehicle.rate,
                      labourers: plan.shifting.labourers,
                      wagePerLabourer: pricing.wagePerLabourer,
                      loadingFloor: plan.shifting.loadingFloor,
                      loadingRatePerFloor: pricing.loadingRatePerFloor,
                      unloadingFloor: plan.shifting.unloadingFloor,
                      unloadingRatePerFloor: pricing.unloadingRatePerFloor,
                    },
                  },
                }
              : {}),
            ...(plan.parcel ? { parcel: { create: plan.parcel } } : {}),
            events: { create: events },
          },
          select: { id: true, number: true },
        })

        const code = `PA-${order.number}`
        const entity = { type: 'ORDER' as const, id: order.id, label: code }
        const ref = { id: order.id, number: order.number, service: plan.service, user: { name: plan.customer.name } }

        audit.push({ action: 'ORDER_CREATED', actor: plan.customer.actor, entity, meta: { service: plan.service, total: placed.total }, at: plan.placedAt })
        for (const admin of admins) notify({ adminId: admin.id }, orderCreatedContent({ ...ref, total: placed.total }), plan.placedAt)

        let previous: OrderStatus = 'PENDING'
        for (const step of plan.steps) {
          audit.push({ action: 'ORDER_STATUS_CHANGED', actor: step.by, entity, changes: [{ field: 'status', from: previous, to: step.to }], note: step.note, at: step.at })
          if (step.by.type === 'CUSTOMER') {
            for (const admin of admins) notify({ adminId: admin.id }, customerCancelledContent({ ...ref, total: final.total }, step.to), step.at)
          } else {
            notify({ userId: plan.customer.id }, statusChangedContent({ ...ref, total: final.total }, step.to, step.note ?? null), step.at)
          }
          previous = step.to
        }

        if (plan.bill) {
          const changes: AuditChange[] = plan.items
            .filter(item => item.price !== item.finalPrice)
            .map(item => ({ field: 'item.price', label: item.name, from: item.price, to: item.finalPrice }))
          if (final.total !== placed.total) changes.push({ field: 'total', from: placed.total, to: final.total })
          audit.push({ action: 'ORDER_BILL_UPDATED', actor: plan.bill.by, entity, changes, note: plan.bill.note, at: plan.bill.at })
          notify({ userId: plan.customer.id }, billUpdatedContent({ ...ref, total: final.total }), plan.bill.at)
        }
      }

      // Customer accounts: points, a profile change and a block.
      const setPoints = async (mobile: string, steps: { daysAgo: number; to: number }[]) => {
        const customer = byMobile(mobile)
        let points = 0
        for (const step of steps) {
          audit.push({
            action: 'CUSTOMER_POINTS_CHANGED',
            actor: staff.manager,
            entity: { type: 'CUSTOMER', id: customer.id, label: customer.name },
            changes: [{ field: 'points', from: points, to: step.to }],
            at: bdAt(dayAgo(step.daysAgo), 15, int(0, 59)),
          })
          points = step.to
        }
        await tx.user.update({ where: { id: customer.id }, data: { points } })
      }
      await setPoints('01711000002', [
        { daysAgo: 20, to: 120 },
        { daysAgo: 3, to: 150 },
      ])
      await setPoints('01911000003', [{ daysAgo: 8, to: 50 }])

      const ayesha = byMobile('01511000004')
      const newLocation = 'মোহাম্মদপুর, তাজমহল রোড, ঢাকা'
      await tx.user.update({ where: { id: ayesha.id }, data: { location: newLocation } })
      audit.push({
        action: 'CUSTOMER_PROFILE_UPDATED',
        actor: ayesha.actor,
        entity: { type: 'CUSTOMER', id: ayesha.id, label: ayesha.name },
        changes: [{ field: 'location', from: ayesha.location, to: newLocation }],
        at: bdAt(dayAgo(15), 21, 12),
      })

      const jahid = byMobile('01411000007')
      await tx.user.update({ where: { id: jahid.id }, data: { isBlocked: true } })
      audit.push({
        action: 'CUSTOMER_BLOCKED',
        actor: staff.manager,
        entity: { type: 'CUSTOMER', id: jahid.id, label: jahid.name },
        changes: [{ field: 'isBlocked', from: false, to: true }],
        at: bdAt(dayAgo(BLOCKED_DAYS_AGO), 16, 20),
      })

      // An announcement to every customer who wasn't blocked at the time.
      const announcedAt = bdAt(dayAgo(10), 11, 0)
      const announcement: NotificationContent = {
        type: 'ANNOUNCEMENT',
        title: { bn: 'নতুন সেবা সময়', en: 'New service hours' },
        body: { bn: 'এখন থেকে কাঁচা বাজার ও জরুরী ঔষুধ ডেলিভারি রাত ১১টা পর্যন্ত চালু থাকবে।', en: 'Fresh market and emergency medicine deliveries now run until 11 pm.' },
      }
      const recipients = customers.filter(customer => customer.id !== jahid.id)
      for (const customer of recipients) notify({ userId: customer.id }, announcement, announcedAt)
      audit.push({
        action: 'ANNOUNCEMENT_SENT',
        actor: staff.manager,
        entity: { type: 'ANNOUNCEMENT', label: announcement.title.en },
        note: announcement.body.en,
        meta: { titleBn: announcement.title.bn, bodyBn: announcement.body.bn, audience: 'all', sent: recipients.length },
        at: announcedAt,
      })

      // Six days ago the operator typed a wrong password, and the super admin reset it.
      const passwordResetDay = dayAgo(6)
      if (superAdmin) {
        const entity = { type: 'STAFF' as const, id: staff.operator.id, label: staff.operator.name }
        const operatorDevice = { userAgent: staff.operator.userAgent, ip: staff.operator.ip }
        audit.push({
          action: 'ADMIN_SIGN_IN_FAILED',
          // As in the API: without the right password, only the mobile number typed is known.
          actor: { type: 'ADMIN', id: null, name: operatorSpec!.mobile, ...operatorDevice },
          entity,
          meta: { reason: 'wrong_password' },
          at: bdAt(passwordResetDay, 7, 31),
        })
        audit.push({ action: 'STAFF_PASSWORD_RESET', actor: superAdmin, entity, at: bdAt(passwordResetDay, 7, 36) })
      }

      // Staff sign in before their first action of the day and sign out after their last.
      const activity = new Map<string, { first: Date; last: Date }>()
      for (const entry of audit) {
        if (entry.actor.type !== 'ADMIN' || !entry.actor.id || !entry.at) continue
        const key = `${entry.actor.id}|${isoDateInBd(entry.at)}`
        const seen = activity.get(key)
        if (!seen) activity.set(key, { first: entry.at, last: entry.at })
        else {
          if (entry.at < seen.first) seen.first = entry.at
          if (entry.at > seen.last) seen.last = entry.at
        }
      }
      const staffOnDuty = [
        { actor: staff.operator, every: 1 },
        { actor: staff.manager, every: 0.75 },
        ...(superAdmin ? [{ actor: superAdmin, every: 0.2 }] : []),
      ]
      for (let daysAgo = ORDER_DAYS - 1; daysAgo >= 0; daysAgo--) {
        const day = dayAgo(daysAgo)
        for (const { actor, every } of staffOnDuty) {
          const seen = activity.get(`${actor.id}|${day}`)
          if (!seen && !chance(every)) continue
          const entity = { type: 'STAFF' as const, id: actor.id, label: actor.name }
          // After the password reset, on that day.
          const earliest = day === passwordResetDay && actor === staff.operator ? bdAt(day, 7, 38) : bdAt(day, 0, 0)
          const signIn = seen
            ? maxDate(earliest, new Date(Math.min(bdAt(day, 7, int(40, 58)).getTime(), seen.first.getTime() - int(5, 15) * MINUTE)))
            : bdAt(day, int(9, 11), int(0, 59))
          if (signIn > now) continue
          audit.push({ action: 'ADMIN_SIGNED_IN', actor, entity, at: signIn })

          const signOut = seen ? later(maxDate(seen.last, bdAt(day, 22, 30)), 5, 25) : later(signIn, 60, 180)
          if (signOut <= now && isoDateInBd(signOut) === day) audit.push({ action: 'ADMIN_SIGNED_OUT', actor, entity, at: signOut })
        }
      }
      // Someone tried a number that has no account.
      const unknownMobile = '01700000099'
      const probeAt = bdAt(dayAgo(9), 23, 41)
      audit.push({
        action: 'ADMIN_SIGN_IN_FAILED',
        actor: { type: 'ADMIN', id: null, name: unknownMobile, userAgent: DEVICES.macFirefox, ip: '198.51.100.77' },
        entity: { type: 'STAFF', label: unknownMobile },
        meta: { reason: 'unknown_mobile' },
        at: probeAt,
      })

      await tx.auditLog.createMany({ data: audit.map(toAuditRow) })
      await tx.notification.createMany({ data: notifications })
      return { orders: plans.length, audit: audit.length, notifications: notifications.length }
    },
    { timeout: 120_000, maxWait: 10_000 },
  )

  console.log(
    `✔ demo data: ${CUSTOMERS.length} customers, ${STAFF.length} staff, ${summary.orders} orders, ${summary.audit} history entries, ${summary.notifications} notifications`,
  )
  console.log(`  demo customer ${DEMO_CUSTOMER_MOBILE}, manager ${STAFF[0]!.mobile}, operator ${STAFF[1]!.mobile} (password ${DEMO_PASSWORD})`)
}

/**
 * Idempotent seed: `npm run db:seed`. Creates what the app needs to run, and never overwrites values
 * an admin has since changed:
 * - the pricing row, the vehicles and the support line (defaults from the paper sketches)
 * - the first super admin from SEED_ADMIN_* in .env
 * `npm run db:seed:demo` (or SEED_DEMO=true) also adds a demo customer (01811111111 / demo1234) with three orders.
 */
import 'dotenv/config'

import { DEFAULT_PRICING, DEFAULT_VEHICLES, isoDateInBd, MOBILE_PATTERN, normalizeMobile } from '@/shared'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

import { PrismaClient } from '../src/server/generated/prisma/client'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function seedCatalog() {
  await prisma.pricing.upsert({ where: { id: 1 }, create: { id: 1, ...DEFAULT_PRICING }, update: {} })
  for (const [index, vehicle] of DEFAULT_VEHICLES.entries()) {
    await prisma.vehicle.upsert({ where: { slug: vehicle.slug }, create: { ...vehicle, sortOrder: index }, update: {} })
  }
  for (const [key, value] of [
    ['support.phone', '+8801700000000'],
    ['support.whatsapp', 'https://wa.me/8801700000000'],
  ] as const) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} })
  }
  console.log('✔ pricing, vehicles and support line')
}

async function seedSuperAdmin() {
  const mobile = normalizeMobile(process.env.SEED_ADMIN_MOBILE ?? '')
  const password = process.env.SEED_ADMIN_PASSWORD ?? ''
  if (!MOBILE_PATTERN.test(mobile) || password.length < 6) {
    console.warn('! SEED_ADMIN_MOBILE / SEED_ADMIN_PASSWORD missing or invalid; skipped the super admin')
    return
  }
  const existing = await prisma.admin.findUnique({ where: { mobile } })
  if (existing) {
    console.log(`✔ admin ${mobile} already exists`)
    return
  }
  await prisma.admin.create({
    data: { name: process.env.SEED_ADMIN_NAME || 'Super Admin', mobile, role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(password, 12) },
  })
  console.log(`✔ super admin ${mobile}`)
}

async function seedDemo() {
  const mobile = '01811111111'
  if (await prisma.user.findUnique({ where: { mobile } })) {
    console.log('✔ demo customer already exists')
    return
  }
  const user = await prisma.user.create({
    data: { name: 'Rahim Uddin', mobile, location: 'মিরপুর ১০, ঢাকা', passwordHash: await bcrypt.hash('demo1234', 12) },
  })
  const scheduledDate = new Date(`${isoDateInBd()}T00:00:00.000Z`)
  const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { slug: 'covered-van' } })

  // The sample history from the original prototype: 760, 1420 and 160 taka.
  await prisma.order.create({
    data: {
      userId: user.id,
      service: 'bazar',
      status: 'COMPLETED',
      summary: 'চাল, আলু, রুই মাছ',
      contactMobile: mobile,
      address: 'বাসা ১২, রোড ৩, মিরপুর ১০',
      scheduledDate,
      scheduledTime: '09:00',
      itemsTotal: 530,
      serviceFee: DEFAULT_PRICING.bazarShoppingFee,
      deliveryFee: DEFAULT_PRICING.bazarDeliveryFee,
      total: 760,
      items: {
        create: [
          { position: 1, name: 'চাল', quantity: '5 কেজি', variety: 'মিনিকেট', price: 350 },
          { position: 2, name: 'আলু', quantity: '2 কেজি', variety: 'দেশি', price: 80 },
          { position: 3, name: 'রুই মাছ', quantity: '1 কেজি', price: 100 },
        ],
      },
      events: { create: [{ to: 'PENDING', actor: 'CUSTOMER' }, { from: 'PENDING', to: 'COMPLETED', actor: 'SYSTEM' }] },
    },
  })
  await prisma.order.create({
    data: {
      userId: user.id,
      service: 'shifting',
      status: 'BOOKED',
      summary: 'মিরপুর ১০ → উত্তরা',
      contactMobile: mobile,
      scheduledDate,
      scheduledTime: '10:00',
      itemsTotal: 1200,
      serviceFee: 220,
      deliveryFee: 0,
      total: 1420,
      shifting: {
        create: {
          loadingArea: 'মিরপুর ১০',
          unloadingArea: 'উত্তরা',
          vehicleId: vehicle.id,
          vehicleNameBn: vehicle.nameBn,
          vehicleNameEn: vehicle.nameEn,
          vehicleRate: 1200,
          labourers: 1,
          wagePerLabourer: DEFAULT_PRICING.wagePerLabourer,
          loadingFloor: 1,
          loadingRatePerFloor: DEFAULT_PRICING.loadingRatePerFloor,
          unloadingFloor: 1,
          unloadingRatePerFloor: DEFAULT_PRICING.unloadingRatePerFloor,
        },
      },
      events: { create: [{ to: 'PENDING', actor: 'CUSTOMER' }, { from: 'PENDING', to: 'BOOKED', actor: 'SYSTEM' }] },
    },
  })
  await prisma.order.create({
    data: {
      userId: user.id,
      service: 'medicine',
      status: 'PENDING',
      summary: 'Napa, Seclo',
      contactMobile: mobile,
      address: 'বাসা ১২, রোড ৩, মিরপুর ১০',
      scheduledDate,
      scheduledTime: '20:00',
      itemsTotal: 100,
      serviceFee: 0,
      deliveryFee: DEFAULT_PRICING.medicineDeliveryFee,
      total: 160,
      items: {
        create: [
          { position: 1, name: 'Napa', quantity: '1 পাতা', company: 'Beximco', category: 'জ্বর', price: 12 },
          { position: 2, name: 'Seclo', quantity: '1 পাতা', company: 'Square', category: 'গ্যাস্ট্রিক', price: 88 },
        ],
      },
      events: { create: [{ to: 'PENDING', actor: 'CUSTOMER' }] },
    },
  })
  console.log('✔ demo customer 01811111111 / demo1234 with three orders')
}

async function main() {
  await seedCatalog()
  await seedSuperAdmin()
  if (process.argv.includes('--demo') || process.env.SEED_DEMO === 'true') await seedDemo()
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

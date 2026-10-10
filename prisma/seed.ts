/**
 * Idempotent seed: `npm run db:seed`. Creates what the app needs to run, and never overwrites values
 * an admin has since changed:
 * - the pricing row, the vehicles and the support line (defaults from the paper sketches)
 * - the first super admin from SEED_ADMIN_* in .env
 * Everything it creates is also written to the history log, as done by the system.
 *
 * `npm run db:seed:demo` (or SEED_DEMO=true) also adds a realistic month of demo data: see seed-demo.ts.
 */
import 'dotenv/config'

import { type AuditChange, DEFAULT_PRICING, DEFAULT_VEHICLES, MOBILE_PATTERN, normalizeMobile } from '@/shared'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

import type { AuditActor } from '../src/server/audit/actor'
import { type AuditEntry, toAuditRow } from '../src/server/audit/audit.mapper'
import { PrismaClient } from '../src/server/generated/prisma/client'
import { seedDemo } from './seed-demo'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

const SYSTEM: AuditActor = { type: 'SYSTEM', id: null, name: 'System' }
const DEFAULT_SUPPORT = { phone: '+8801700000000', whatsapp: 'https://wa.me/8801700000000' }

/** "Created with these values": every field from null. */
const created = (values: Record<string, string | number | boolean>): AuditChange[] => Object.entries(values).map(([field, to]) => ({ field, from: null, to }))

const log = (entry: AuditEntry) => prisma.auditLog.create({ data: toAuditRow(entry) })

async function seedCatalog() {
  if (!(await prisma.pricing.findUnique({ where: { id: 1 } }))) {
    await prisma.$transaction([
      prisma.pricing.create({ data: { id: 1, ...DEFAULT_PRICING } }),
      log({ action: 'PRICING_UPDATED', actor: SYSTEM, entity: { type: 'PRICING' }, changes: created({ ...DEFAULT_PRICING }) }),
    ])
  }

  for (const [index, vehicle] of DEFAULT_VEHICLES.entries()) {
    if (await prisma.vehicle.findUnique({ where: { slug: vehicle.slug } })) continue
    await prisma.$transaction(async tx => {
      const row = await tx.vehicle.create({ data: { ...vehicle, sortOrder: index } })
      await tx.auditLog.create({
        data: toAuditRow({
          action: 'VEHICLE_CREATED',
          actor: SYSTEM,
          entity: { type: 'VEHICLE', id: row.id, label: row.nameEn },
          changes: created({ nameBn: row.nameBn, nameEn: row.nameEn, rate: row.rate, isActive: row.isActive, sortOrder: row.sortOrder }),
        }),
      })
    })
  }

  const missing = (
    await Promise.all(
      (['phone', 'whatsapp'] as const).map(async field => ((await prisma.setting.findUnique({ where: { key: `support.${field}` } })) ? null : field)),
    )
  ).filter(field => field !== null)
  if (missing.length) {
    await prisma.$transaction([
      ...missing.map(field => prisma.setting.create({ data: { key: `support.${field}`, value: DEFAULT_SUPPORT[field] } })),
      log({ action: 'SUPPORT_UPDATED', actor: SYSTEM, entity: { type: 'SUPPORT' }, changes: created(Object.fromEntries(missing.map(field => [field, DEFAULT_SUPPORT[field]]))) }),
    ])
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
  if (await prisma.admin.findUnique({ where: { mobile } })) {
    console.log(`✔ admin ${mobile} already exists`)
    return
  }
  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.$transaction(async tx => {
    const admin = await tx.admin.create({ data: { name: process.env.SEED_ADMIN_NAME || 'Super Admin', mobile, role: 'SUPER_ADMIN', passwordHash } })
    await tx.auditLog.create({
      data: toAuditRow({
        action: 'STAFF_CREATED',
        actor: SYSTEM,
        entity: { type: 'STAFF', id: admin.id, label: admin.name },
        changes: created({ name: admin.name, mobile: admin.mobile, role: admin.role }),
      }),
    })
  })
  console.log(`✔ super admin ${mobile}`)
}

async function main() {
  await seedCatalog()
  await seedSuperAdmin()
  if (process.argv.includes('--demo') || process.env.SEED_DEMO === 'true') await seedDemo(prisma)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

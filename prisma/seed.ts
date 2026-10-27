/**
 * Idempotent seed: `npm run db:seed`. Creates what the app needs to run, and never overwrites values
 * an admin has since changed:
 * - the pricing row, the vehicles, the support line and the delivery hours (defaults from the paper sketches)
 * - the built-in roles (Super admin, Manager, Operator, Customer support, Pricing desk, Dispatcher, Marketing,
 *   Accounts, Staff admin), if missing
 * - the first super admin from SEED_ADMIN_* in .env
 * Everything it creates is also written to the history log, as done by the system.
 *
 * `npm run db:seed:demo` (or SEED_DEMO=true) also adds a realistic month of demo data: see seed-demo.ts.
 */
import 'dotenv/config'

import {
  type AuditChange,
  BUILT_IN_ROLES,
  DEFAULT_DELIVERY_HOURS,
  DEFAULT_PRICING,
  DEFAULT_VEHICLES,
  formatDeliveryWindows,
  MOBILE_PATTERN,
  normalizeMobile,
  SERVICE_IDS,
} from '@/shared'
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

  const missingHours = (
    await Promise.all(SERVICE_IDS.map(async service => ((await prisma.setting.findUnique({ where: { key: `delivery.${service}` } })) ? null : service)))
  ).filter(service => service !== null)
  if (missingHours.length) {
    const values = missingHours.map(service => [service, formatDeliveryWindows(DEFAULT_DELIVERY_HOURS[service])] as const)
    await prisma.$transaction([
      ...values.map(([service, value]) => prisma.setting.create({ data: { key: `delivery.${service}`, value } })),
      log({ action: 'DELIVERY_HOURS_UPDATED', actor: SYSTEM, entity: { type: 'DELIVERY_HOURS' }, changes: created(Object.fromEntries(values.filter(([, value]) => value).map(([service, value]) => [`${service}Hours`, value]))) }),
    ])
  }
  console.log('✔ pricing, vehicles, support line and delivery hours')
}

/** The built-in roles, by their fixed ids. An existing role is left as it is (its permissions may have been edited). */
/**
 * Creates each missing built-in role, and gives a built-in role without descriptions its own.
 * Names and permissions an admin has edited stay as they are; a deleted preset comes back on the next seed.
 */
async function seedRoles() {
  const added: string[] = []
  for (const { permissions, ...role } of BUILT_IN_ROLES) {
    const existing = await prisma.role.findUnique({ where: { id: role.id } })
    const descriptions = { descriptionBn: role.descriptionBn, descriptionEn: role.descriptionEn }
    if (existing) {
      if (existing.descriptionBn === null && existing.descriptionEn === null) {
        await prisma.$transaction([
          prisma.role.update({ where: { id: role.id }, data: descriptions }),
          log({ action: 'ROLE_UPDATED', actor: SYSTEM, entity: { type: 'ROLE', id: role.id, label: existing.nameEn }, changes: created(descriptions) }),
        ])
      }
      continue
    }
    // A role made in the panel may already use the name (English names are unique).
    if (await prisma.role.findUnique({ where: { nameEn: role.nameEn } })) {
      console.warn(`! a role named "${role.nameEn}" already exists; skipped the built-in one`)
      continue
    }
    await prisma.$transaction([
      prisma.role.create({ data: { ...role, permissions: [...permissions] } }),
      log({
        action: 'ROLE_CREATED',
        actor: SYSTEM,
        entity: { type: 'ROLE', id: role.id, label: role.nameEn },
        changes: [...created({ nameBn: role.nameBn, nameEn: role.nameEn, ...descriptions }), ...permissions.map(to => ({ field: 'permission.added', from: null, to }))],
      }),
    ])
    added.push(role.nameEn)
  }
  console.log(`✔ roles${added.length ? ` (added ${added.join(', ')})` : ''}`)
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
    const role = BUILT_IN_ROLES[0]
    const admin = await tx.admin.create({ data: { name: process.env.SEED_ADMIN_NAME || 'Super Admin', mobile, roleId: role.id, passwordHash } })
    await tx.auditLog.create({
      data: toAuditRow({
        action: 'STAFF_CREATED',
        actor: SYSTEM,
        entity: { type: 'STAFF', id: admin.id, label: admin.name },
        changes: created({ name: admin.name, mobile: admin.mobile, role: role.nameEn }),
      }),
    })
  })
  console.log(`✔ super admin ${mobile}`)
}

async function main() {
  await seedCatalog()
  await seedRoles()
  await seedSuperAdmin()
  if (process.argv.includes('--demo') || process.env.SEED_DEMO === 'true') await seedDemo(prisma)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

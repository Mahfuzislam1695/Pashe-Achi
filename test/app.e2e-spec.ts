import { createHash } from 'node:crypto'
import type { AddressInfo } from 'node:net'

import { Test } from '@nestjs/testing'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { API_PREFIX, BUILT_IN_ROLES, DEFAULT_DELIVERY_HOURS, DEFAULT_PRICING, DEFAULT_VEHICLES, isoDateInBd, type OrderDetail, SOCKET_EVENTS, SOCKET_NAMESPACE } from '@/shared'
import bcrypt from 'bcryptjs'
import { io, type Socket } from 'socket.io-client'
import request from 'supertest'

import { AppModule } from '../src/server/app.module'
import { configureApp } from '../src/server/bootstrap'
import { ENV, type Env } from '../src/server/config/env'
import { PUSH_SENDER, type PushOptions, type PushSender } from '../src/server/notifications/push.service'
import type { PushPayload } from '../src/server/notifications/web-push.channel'
import { PrismaService } from '../src/server/prisma/prisma.service'

const ADMIN = { mobile: '01700000000', password: 'admin12345' }
/** The built-in roles' ids, by the names the fixed roles had before roles became editable. */
const ROLE_ID = { SUPER_ADMIN: 'role_super_admin', MANAGER: 'role_manager', OPERATOR: 'role_operator' } as const
/** The role names history entries carry. */
const ROLE_NAME = Object.fromEntries(Object.entries(ROLE_ID).map(([key, id]) => {
  const role = BUILT_IN_ROLES.find(entry => entry.id === id)!
  return [key, { bn: role.nameBn, en: role.nameEn }]
})) as Record<keyof typeof ROLE_ID, { bn: string; en: string }>
const schedule = { date: isoDateInBd(), time: '10:00' }
/** Every address is picked on the map, so orders and signups carry a pin. */
const PIN = { lat: 23.807, lng: 90.3687 }
const api = (path: string) => `/${API_PREFIX}${path}`

/** Polls until `check` returns something truthy (notifications and pushes are sent after the response). */
async function waitFor<T>(check: () => T | null | undefined | false | Promise<T | null | undefined | false>, timeout = 3000): Promise<T> {
  const end = Date.now() + timeout
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > end) throw new Error('waitFor: timed out')
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

/** Web Push without the network: records what would be sent; endpoints in `gone` answer 410 like a dropped browser. */
const pushes: { endpoint: string; payload: PushPayload; options: PushOptions }[] = []
const gone = new Set<string>()
const recordPush: PushSender = async (target, payload, options) => {
  if (gone.has(target.endpoint)) throw Object.assign(new Error('Gone'), { statusCode: 410 })
  pushes.push({ endpoint: target.endpoint, payload: JSON.parse(payload) as PushPayload, options })
}

describe('Pashe Achi API (e2e)', () => {
  let app: NestExpressApplication
  let prisma: PrismaService
  let baseUrl: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PUSH_SENDER).useValue(recordPush).compile()
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })
    configureApp(app, app.get<Env>(ENV))
    await app.listen(0)
    baseUrl = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`
    prisma = app.get(PrismaService)

    // A clean, seeded database for every run.
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(table => `"${table.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`)
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Order_number_seq" RESTART WITH 1001`)
    await prisma.pricing.create({ data: { id: 1, ...DEFAULT_PRICING } })
    await prisma.vehicle.createMany({ data: DEFAULT_VEHICLES.map((vehicle, index) => ({ ...vehicle, sortOrder: index })) })
    // The truncate removed the roles the migration created.
    for (const role of BUILT_IN_ROLES) await prisma.role.create({ data: { ...role, permissions: [...role.permissions] } })
    await prisma.admin.create({ data: { name: 'Admin', mobile: ADMIN.mobile, roleId: ROLE_ID.SUPER_ADMIN, passwordHash: await bcrypt.hash(ADMIN.password, 4) } })
    // These tests sign customers in with a password; 'passwordless customer sign-in' turns it off.
    await prisma.setting.create({ data: { key: 'auth.customerPassword', value: 'on' } })
  })

  afterAll(async () => {
    await app?.close()
  })

  const signup = async (mobile: string, name = 'করিম') => {
    const agent = request.agent(app.getHttpServer())
    const response = await agent.post(api('/auth/signup')).send({ name, mobile, password: 'secret12', location: { address: 'উত্তরা, ঢাকা', ...PIN } }).expect(201)
    return { agent, body: response.body as { user: { id: string }; tokens: { accessToken: string; refreshToken: string } } }
  }
  const adminAgent = async () => {
    const agent = request.agent(app.getHttpServer())
    await agent.post(api('/admin/auth/login')).send(ADMIN).expect(200)
    return agent
  }

  describe('auth', () => {
    it('signs up, normalises the mobile and logs in with httpOnly cookies', async () => {
      const agent = request.agent(app.getHttpServer())
      const location = { address: 'মিরপুর ১০, ঢাকা', details: 'বাসা ১২', ...PIN }
      const response = await agent.post(api('/auth/signup')).send({ name: 'রহিম', mobile: '+880 1712-000001', password: 'secret12', location }).expect(201)
      expect(response.body.user).toMatchObject({ name: 'রহিম', mobile: '01712000001', points: 0, location })
      const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? [])
      expect(cookies.some(cookie => cookie.startsWith('pa_at=') && /HttpOnly/i.test(cookie))).toBe(true)
      expect(cookies.some(cookie => cookie.startsWith('pa_rt=') && /SameSite=Lax/i.test(cookie))).toBe(true)
      await agent.get(api('/auth/me')).expect(200).expect(res => expect(res.body.mobile).toBe('01712000001'))
    })

    it('keeps customers signed in for life, but ends admin sessions after REFRESH_TOKEN_TTL_DAYS', async () => {
      const { body } = await signup('01712000006')
      const refreshed = await request(app.getHttpServer()).post(api('/auth/refresh')).send({ refreshToken: body.tokens.refreshToken }).expect(200)
      const cookies = ([] as string[]).concat(refreshed.headers['set-cookie'] ?? [])
      expect(cookies.some(cookie => cookie.startsWith('pa_rt=') && cookie.includes(`Max-Age=${400 * 24 * 60 * 60}`))).toBe(true)
      const customerRows = await prisma.refreshToken.findMany({ where: { userId: body.user.id } })
      expect(customerRows).toHaveLength(2)
      expect(customerRows.every(row => row.expiresAt === null)).toBe(true)

      const login = await request(app.getHttpServer()).post(api('/admin/auth/login')).send(ADMIN).expect(200)
      const tokenHash = createHash('sha256').update(login.body.tokens.refreshToken).digest('hex')
      const adminRow = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash } })
      expect(adminRow.adminId).not.toBeNull()
      expect(adminRow.expiresAt?.getTime()).toBeGreaterThan(Date.now())
      await prisma.refreshToken.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } })
      await request(app.getHttpServer()).post(api('/admin/auth/refresh')).send({ refreshToken: login.body.tokens.refreshToken }).expect(401)
    })

    it('rejects a duplicate mobile, a wrong password and an empty form with message codes', async () => {
      await signup('01712000002')
      await request(app.getHttpServer()).post(api('/auth/signup')).send({ name: 'x', mobile: '01712000002', password: 'secret12', location: { address: 'উত্তরা', ...PIN } }).expect(409).expect(res => expect(res.body.code).toBe('mobile.taken'))
      await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01712000002', password: 'nope-nope' }).expect(401).expect(res => expect(res.body.code).toBe('auth.invalid'))
      const empty = await request(app.getHttpServer()).post(api('/auth/login')).send({}).expect(400)
      expect(empty.body).toMatchObject({ code: 'auth.login', message: { bn: 'মোবাইল নম্বর দিন।' } })
      await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01712000002' }).expect(400).expect(res => expect(res.body.code).toBe('password.required'))
    })

    describe('passwordless customer sign-in (the super admin switch)', () => {
      const setPassword = async (agent: Awaited<ReturnType<typeof adminAgent>>, password: boolean) =>
        agent.put(api('/admin/catalog/customer-auth')).send({ password }).expect(200)

      it('lets only the super admin change it, and logs the change', async () => {
        const admin = await adminAgent()
        await admin.post(api('/admin/staff')).send({ name: 'Mou', mobile: '01912000040', password: 'manager1', roleId: ROLE_ID.MANAGER }).expect(201)
        const manager = request.agent(app.getHttpServer())
        await manager.post(api('/admin/auth/login')).send({ mobile: '01912000040', password: 'manager1' }).expect(200)
        await manager.put(api('/admin/catalog/customer-auth')).send({ password: false }).expect(403)

        await setPassword(admin, false)
        await request(app.getHttpServer()).get(api('/catalog')).expect(200).expect(res => expect(res.body.customerAuth).toEqual({ password: false }))
        const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: 'CUSTOMER_AUTH_UPDATED' } })
        expect(entry.entityType).toBe('CUSTOMER_AUTH')
        await setPassword(admin, true)
      })

      it('signs up and logs in with the mobile number alone while it is off', async () => {
        const { agent: existing } = await signup('01712000077')
        const admin = await adminAgent()
        await setPassword(admin, false)
        try {
          const created = await request(app.getHttpServer()).post(api('/auth/signup')).send({ name: 'সুমি', mobile: '01812000051', location: { address: 'উত্তরা, ঢাকা', ...PIN } }).expect(201)
          expect(created.body.user.mobile).toBe('01812000051')
          await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01812000051' }).expect(200)
          // Accounts that set their own password log in by number too.
          await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01712000077' }).expect(200)
          await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01812000099' }).expect(401).expect(res => expect(res.body.code).toBe('auth.no_account'))
          await request(app.getHttpServer()).post(api('/admin/auth/login')).send({ mobile: ADMIN.mobile }).expect(400).expect(res => expect(res.body.code).toBe('password.required'))
          await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01212000051' }).expect(400).expect(res => expect(res.body.code).toBe('mobile.invalid'))
        } finally {
          await setPassword(admin, true)
        }
        // Switched back on: the number-only account's password is its mobile number, and the old one still works.
        await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01812000051' }).expect(400).expect(res => expect(res.body.code).toBe('password.required'))
        await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01812000051', password: '01812000051' }).expect(200)
        await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01712000077', password: 'secret12' }).expect(200)
        await existing.get(api('/auth/me')).expect(200)
      })
    })

    it('needs a location picked on the map to sign up', async () => {
      const form = { name: 'রহিম', mobile: '01712000007', password: 'secret12' }
      await request(app.getHttpServer()).post(api('/auth/signup')).send(form).expect(400).expect(res => expect(res.body.code).toBe('location.required'))
      await request(app.getHttpServer())
        .post(api('/auth/signup'))
        .send({ ...form, location: { address: 'মিরপুর' } })
        .expect(400)
      expect(await prisma.user.count({ where: { mobile: form.mobile } })).toBe(0)
    })

    it('accepts a Bearer token instead of cookies (mobile apps)', async () => {
      const { body } = await signup('01712000003')
      await request(app.getHttpServer()).get(api('/auth/me')).set('Authorization', `Bearer ${body.tokens.accessToken}`).expect(200)
      await request(app.getHttpServer()).get(api('/auth/me')).expect(401)
    })

    it('rotates refresh tokens and revokes the family when an old one is replayed later', async () => {
      const { body } = await signup('01712000004')
      const first = await request(app.getHttpServer()).post(api('/auth/refresh')).send({ refreshToken: body.tokens.refreshToken }).expect(200)
      await request(app.getHttpServer()).post(api('/auth/refresh')).send({ refreshToken: body.tokens.refreshToken }).expect(401)
      // Pretend the replay happened long after rotation: now it counts as theft and kills the family.
      await prisma.refreshToken.updateMany({ where: { userId: body.user.id, replacedBy: { not: null } }, data: { revokedAt: new Date(Date.now() - 60_000) } })
      await request(app.getHttpServer()).post(api('/auth/refresh')).send({ refreshToken: body.tokens.refreshToken }).expect(401)
      await request(app.getHttpServer()).post(api('/auth/refresh')).send({ refreshToken: first.body.tokens.refreshToken }).expect(401)
    })

    it('logs out by revoking the refresh token', async () => {
      const { agent, body } = await signup('01712000005')
      await agent.post(api('/auth/logout')).send({}).expect(204)
      await request(app.getHttpServer()).post(api('/auth/refresh')).send({ refreshToken: body.tokens.refreshToken }).expect(401)
    })
  })

  describe('orders', () => {
    it('computes every total on the server, ignoring anything the client sends', async () => {
      const { agent } = await signup('01712000010')
      const vehicle = await prisma.vehicle.findFirstOrThrow()
      const bazar = await agent
        .post(api('/orders/bazar'))
        .send({ address: 'বাসা ১', addressPin: PIN, contactMobile: '01712000010', schedule, total: 1, items: [{ name: 'চাল', quantity: '5 কেজি', price: 450 }, { name: 'আলু', quantity: '1 কেজি', price: 80 }] })
        .expect(201)
      // Customers never price a bazar order: the prices sent are dropped and staff quote it later.
      expect(bazar.body).toMatchObject({ code: 'PA-1001', total: 230, itemsTotal: 0, serviceFee: 150, deliveryFee: 80, status: 'PENDING', canConfirm: false })
      expect(bazar.body.items.map((item: { price: number | null }) => item.price)).toEqual([null, null])
      const shifting = await agent
        .post(api('/orders/shifting'))
        .send({ loadingArea: 'মিরপুর', unloadingArea: 'উত্তরা', loadingPin: PIN, unloadingPin: PIN, schedule, vehicleId: vehicle.id, labourers: 1, loadingFloor: 1, unloadingFloor: 1, vehicleRate: 1 })
        .expect(201)
      // The vehicle rent comes later, from staff, by distance: the bill is labour and floors.
      expect(shifting.body).toMatchObject({ total: 220, itemsTotal: 0, serviceFee: 220, status: 'PENDING', shifting: { vehicleRate: null } })
      const parcel = await agent
        .post(api('/orders/parcel'))
        .send({ product: 'ব্যাগ', pickupAddress: 'A', dropoffAddress: 'B', pickupPin: PIN, dropoffPin: PIN, receiverMobile: '01711111111', schedule })
        .expect(201)
      expect(parcel.body.total).toBe(60)
      const medicine = await agent
        .post(api('/orders/medicine'))
        .send({ address: 'বাসা ১', addressPin: PIN, contactMobile: '01712000010', schedule, items: [{ name: 'Napa', quantity: '1 পাতা', company: 'Beximco', category: 'জ্বর', price: 100 }] })
        .expect(201)
      expect(medicine.body).toMatchObject({ total: 60, itemsTotal: 0, deliveryFee: 60 })
    })

    it('rejects past dates, incomplete rows and disabled vehicles', async () => {
      const { agent } = await signup('01712000011')
      await agent
        .post(api('/orders/bazar'))
        .send({ address: 'x', addressPin: PIN, contactMobile: '01712000011', schedule: { date: '2020-01-01', time: '10:00' }, items: [{ name: 'a', quantity: '1' }] })
        .expect(400)
        .expect(res => expect(res.body.code).toBe('schedule.past'))
      await agent
        .post(api('/orders/bazar'))
        .send({ address: 'x', addressPin: PIN, contactMobile: '01712000011', schedule: { ...schedule, time: '12:00' }, items: [{ name: 'a', quantity: '1' }] })
        .expect(201) // any time of the day: the delivery hours are only a notice
      await agent
        .post(api('/orders/medicine'))
        .send({ address: 'x', addressPin: PIN, contactMobile: '01712000011', schedule, items: [{ name: 'Napa', quantity: '1', company: '', category: 'জ্বর', price: 5 }] })
        .expect(400)
      const hidden = await prisma.vehicle.create({ data: { slug: 'hidden', nameBn: 'x', nameEn: 'x', rate: 1, isActive: false } })
      await agent
        .post(api('/orders/shifting'))
        .send({ loadingArea: 'a', unloadingArea: 'b', loadingPin: PIN, unloadingPin: PIN, schedule, vehicleId: hidden.id, labourers: 0, loadingFloor: 0, unloadingFloor: 0 })
        .expect(400)
        .expect(res => expect(res.body.code).toBe('vehicle.unavailable'))
    })

    it('attaches an uploaded prescription once, and checks file contents', async () => {
      const { agent } = await signup('01712000012')
      const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000', 'hex')
      const upload = await agent.post(api('/uploads/prescription')).attach('file', png, { filename: 'rx.png', contentType: 'image/png' }).expect(201)
      await agent
        .post(api('/uploads/prescription'))
        .attach('file', Buffer.from('<script>alert(1)</script> pretending'), { filename: 'rx.png', contentType: 'image/png' })
        .expect(400)
        .expect(res => expect(res.body.code).toBe('upload.type'))
      const order = { address: 'x', addressPin: PIN, contactMobile: '01712000012', schedule, prescriptionUploadId: upload.body.id, items: [] }
      const created = await agent.post(api('/orders/medicine')).send(order).expect(201)
      expect(created.body.prescription.id).toBe(upload.body.id)
      await agent.post(api('/orders/medicine')).send(order).expect(400).expect(res => expect(res.body.code).toBe('upload.missing'))
      // Someone else can't read it.
      const other = await signup('01712000013')
      await other.agent.get(api(`/uploads/${upload.body.id}`)).expect(404)
      await agent.get(api(`/uploads/${upload.body.id}`)).expect(200).expect('content-type', /image\/png/)
    })

    it('lets a customer cancel only while pending, and only their own order', async () => {
      const { agent } = await signup('01712000014')
      const other = await signup('01712000015')
      const order = (await agent.post(api('/orders/parcel')).send({ product: 'a', pickupAddress: 'A', dropoffAddress: 'B', pickupPin: PIN, dropoffPin: PIN, receiverMobile: '01711111111', schedule })).body as OrderDetail
      await other.agent.post(api(`/orders/${order.id}/cancel`)).expect(404)
      const cancelled = await agent.post(api(`/orders/${order.id}/cancel`)).expect(200)
      expect(cancelled.body).toMatchObject({ status: 'CANCELLED', canCancel: false })
      await agent.post(api(`/orders/${order.id}/cancel`)).expect(400)
    })

    it('needs a map pin for every address, and keeps it', async () => {
      const { agent } = await signup('01712000016')
      const uttara = { lat: 23.8759, lng: 90.3795 }
      const bazar = await agent
        .post(api('/orders/bazar'))
        .send({ address: 'বাসা ১', addressPin: PIN, contactMobile: '01712000016', schedule, items: [{ name: 'চাল', quantity: '5 কেজি' }] })
        .expect(201)
      expect(bazar.body.addressPin).toEqual(PIN)
      const parcel = { product: 'ব্যাগ', pickupAddress: 'A', dropoffAddress: 'B', pickupPin: PIN, receiverMobile: '01711111111', schedule }
      await agent
        .post(api('/orders/parcel'))
        .send(parcel)
        .expect(400)
        .expect(res => expect(res.body.code).toBe('location.required'))
      const placed = await agent.post(api('/orders/parcel')).send({ ...parcel, dropoffPin: uttara }).expect(201)
      expect(placed.body.parcel).toMatchObject({ pickupPin: PIN, dropoffPin: uttara })
      expect(placed.body.addressPin).toBeNull()
      await agent
        .post(api('/orders/bazar'))
        .send({ address: 'বাসা ১', addressPin: { lat: 123, lng: 90 }, contactMobile: '01712000016', schedule, items: [{ name: 'চাল', quantity: '1' }] })
        .expect(400)
    })
  })

  describe('my location', () => {
    const home = { address: 'মিরপুর ১০, ঢাকা', details: 'বাসা ১২, রোড ৩', lat: 23.8069, lng: 90.3687 }

    it('replaces the one location and writes history only for a change', async () => {
      const { agent, body } = await signup('01712000050')
      const me = await agent.get(api('/auth/me')).expect(200)
      expect(me.body.location).toEqual({ address: 'উত্তরা, ঢাকা', details: '', ...PIN })

      const updated = await agent.put(api('/me/location')).send(home).expect(200)
      expect(updated.body.location).toEqual(home)
      await agent.put(api('/me/location')).send(home).expect(200)

      const history = await prisma.auditLog.findMany({ where: { entityType: 'CUSTOMER', entityId: body.user.id, action: 'CUSTOMER_LOCATION_UPDATED' } })
      expect(history).toHaveLength(1)
      expect(history[0]!.changes).toEqual([
        { field: 'location', from: 'উত্তরা, ঢাকা', to: home.address },
        { field: 'locationDetails', from: '', to: home.details },
        { field: 'locationLat', from: PIN.lat, to: home.lat },
      ])

      const admin = await adminAgent()
      const seen = await admin.get(api(`/admin/customers/${body.user.id}`)).expect(200)
      expect(seen.body.location).toEqual(home)
    })

    it('needs the map address and pin, and a signed-in customer', async () => {
      const { agent } = await signup('01712000051')
      await agent
        .put(api('/me/location'))
        .send({ address: home.address })
        .expect(400)
      await agent
        .put(api('/me/location'))
        .send({ ...home, address: ' ' })
        .expect(400)
        .expect(res => expect(res.body.code).toBe('location.required'))
      await request(app.getHttpServer()).put(api('/me/location')).send(home).expect(401)
      // The profile no longer takes a location.
      await agent.patch(api('/me')).send({ name: 'করিম', mobile: '01712000051', location: 'x' }).expect(200)
      expect((await agent.get(api('/auth/me')).expect(200)).body.location.address).toBe('উত্তরা, ঢাকা')
    })

    it('looks addresses up for anyone, since signup needs it', async () => {
      // Bad coordinates fail validation before any lookup, so this needs no network.
      await request(app.getHttpServer()).get(api('/geo/reverse')).query({ lat: 123, lng: 90.4 }).expect(400)
    })
  })

  describe('offers', () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000', 'hex')
    const pdf = Buffer.from('%PDF-1.4 not a picture', 'latin1')
    const today = isoDateInBd()
    const tomorrow = isoDateInBd(new Date(Date.now() + 24 * 60 * 60 * 1000))
    const staff = async (mobile: string, role: 'MANAGER' | 'OPERATOR') => {
      const admin = await adminAgent()
      await admin.post(api('/admin/staff')).send({ name: role, mobile, password: 'staffpass1', roleId: ROLE_ID[role] }).expect(201)
      const agent = request.agent(app.getHttpServer())
      await agent.post(api('/admin/auth/login')).send({ mobile, password: 'staffpass1' }).expect(200)
      return agent
    }

    it('lets managers post an offer with a picture that everyone sees while it runs', async () => {
      const operator = await staff('01912000050', 'OPERATOR')
      const manager = await staff('01912000051', 'MANAGER')
      const offer = { titleBn: 'সব সবজিতে ১০% ছাড়', bodyBn: 'আজ রাত ৯টা পর্যন্ত', service: 'bazar', startsOn: today, endsOn: today }
      await operator.post(api('/admin/offers')).send(offer).expect(403)
      await manager.post(api('/admin/offers')).send({ ...offer, endsOn: '2000-01-01' }).expect(400).expect(res => expect(res.body.code).toBe('offer.dates'))

      const created = await manager.post(api('/admin/offers')).send(offer).expect(201)
      expect(created.body).toMatchObject({ status: 'running', title: { bn: offer.titleBn, en: offer.titleBn }, body: { bn: 'আজ রাত ৯টা পর্যন্ত' }, service: 'bazar', imageUrl: null })
      await manager.put(api(`/admin/offers/${created.body.id}/image`)).attach('file', pdf, { filename: 'offer.pdf', contentType: 'application/pdf' }).expect(400).expect(res => expect(res.body.code).toBe('offer.image'))
      const withImage = await manager.put(api(`/admin/offers/${created.body.id}/image`)).attach('file', png, { filename: 'offer.png', contentType: 'image/png' }).expect(200)
      expect(withImage.body.imageUrl).toMatch(new RegExp(`^/${API_PREFIX}/admin/offers/${created.body.id}/image\\?v=\\d+$`))

      // Public: no sign-in needed (the landing page).
      const later = await manager.post(api('/admin/offers')).send({ ...offer, titleBn: 'আগামীকালের অফার', startsOn: tomorrow, endsOn: tomorrow }).expect(201)
      expect(later.body.status).toBe('upcoming')
      const running = (await request(app.getHttpServer()).get(api('/offers')).expect(200)).body as { id: string; imageUrl: string }[]
      expect(running.map(item => item.id)).toEqual([created.body.id])
      const picture = await request(app.getHttpServer()).get(running[0]!.imageUrl).expect(200)
      expect(picture.headers['content-type']).toBe('image/png')
      expect(picture.headers['cache-control']).toContain('public')
      await request(app.getHttpServer()).get(api(`/offers/${later.body.id}/image`)).expect(404)

      // Switched off: gone for customers, still listed for staff.
      await manager.patch(api(`/admin/offers/${created.body.id}`)).send({ isActive: false }).expect(200)
      await request(app.getHttpServer()).get(api('/offers')).expect(200).expect(res => expect(res.body).toEqual([]))
      const all = (await operator.get(api('/admin/offers')).expect(200)).body.items as { id: string; status: string }[]
      expect(all.find(item => item.id === created.body.id)?.status).toBe('off')
      const off = (await operator.get(api('/admin/offers?status=off')).expect(200)).body.items as { id: string }[]
      expect(off.map(item => item.id)).toContain(created.body.id)
      const counts = (await operator.get(api('/admin/offers/stats')).expect(200)).body as { total: number; byStatus: Record<string, number> }
      expect(counts.byStatus.off).toBeGreaterThanOrEqual(1)
      expect(counts.byStatus.upcoming).toBeGreaterThanOrEqual(1)
      expect(Object.values(counts.byStatus).reduce((sum, count) => sum + count, 0)).toBe(counts.total)

      await manager.delete(api(`/admin/offers/${later.body.id}`)).expect(204)
      const history = (await manager.get(api(`/admin/audit?entityType=OFFER&entityId=${created.body.id}`)).expect(200)).body.items as { action: string; changes: { field: string; to: unknown }[] }[]
      expect(history.map(entry => entry.action)).toEqual(['OFFER_UPDATED', 'OFFER_UPDATED', 'OFFER_CREATED'])
      expect(history[0]!.changes).toEqual([{ field: 'isActive', from: true, to: false }])
      expect(history[1]!.changes).toEqual([{ field: 'image', from: null, to: 'added' }])
      await manager.delete(api(`/admin/offers/${created.body.id}`)).expect(204)
    })

    it('tells every customer about a running offer when staff ask', async () => {
      const manager = await staff('01912000052', 'MANAGER')
      const { agent } = await signup('01712000060')
      const upcoming = await manager.post(api('/admin/offers')).send({ titleBn: 'পরের সপ্তাহের অফার', startsOn: tomorrow, endsOn: tomorrow }).expect(201)
      const offer = await manager.post(api('/admin/offers')).send({ titleBn: 'ঔষুধে ফ্রি ডেলিভারি', titleEn: 'Free medicine delivery', startsOn: today, endsOn: tomorrow }).expect(201)
      const announced = await manager.post(api(`/admin/offers/${offer.body.id}/notify`)).expect(200)
      expect(announced.body.sent).toBeGreaterThan(0)

      const inbox = (await agent.get(api('/notifications')).expect(200)).body.items as { type: string; title: { bn: string; en: string }; data: { offerId?: string } }[]
      expect(inbox[0]).toMatchObject({ type: 'OFFER', title: { en: "Today's offer: Free medicine delivery" }, data: { offerId: offer.body.id } })
      const [entry] = (await manager.get(api(`/admin/audit?action=OFFER_ANNOUNCED&entityId=${offer.body.id}`)).expect(200)).body.items
      expect(entry).toMatchObject({ meta: { sent: announced.body.sent } })

      await manager.delete(api(`/admin/offers/${offer.body.id}`)).expect(204)
      await manager.delete(api(`/admin/offers/${upcoming.body.id}`)).expect(204)
    })
  })

  describe('push notifications', () => {
    const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' }
    const pushedTo = (endpoint: string) => pushes.filter(push => push.endpoint === endpoint)

    it("sends a customer's price to their phone, in their language, opening their version of the site", async () => {
      const { agent } = await signup('01712000070')
      const admin = await adminAgent()
      await agent.get(api('/notifications/push')).expect(200).expect(res => expect(res.body.publicKey).toBe(process.env.VAPID_PUBLIC_KEY))
      await agent.put(api('/notifications/push')).send({ endpoint: 'https://10.0.0.1/push', keys }).expect(400).expect(res => expect(res.body.code).toBe('push.endpoint'))
      await request(app.getHttpServer()).put(api('/notifications/push')).send({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys }).expect(401)

      const endpoint = 'https://fcm.googleapis.com/fcm/send/e2e-customer-70'
      await agent.put(api('/notifications/push')).send({ endpoint, keys, lang: 'en', mode: 'app' }).expect(204)
      const order = (await agent.post(api('/orders/bazar')).send({ address: 'x', addressPin: PIN, contactMobile: '01712000070', schedule, items: [{ name: 'চাল', quantity: '1' }] }).expect(201)).body as OrderDetail
      await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ id: order.items[0]!.id, name: 'চাল', quantity: '1', price: 70 }] }).expect(200)
      const price = await waitFor(() => pushedTo(endpoint)[0])
      expect(price).toMatchObject({
        payload: { title: `Order ${order.code}: price ready`, url: `/app/orders/${order.id}`, tag: `order-${order.id}`, area: 'customer', lang: 'en' },
        options: { urgency: 'high', TTL: 86_400 },
      })
      expect(price.payload.body).toContain('= Tk 300')

      // The same browser again (a page load in Bangla on the web version) updates the one row.
      await agent.put(api('/notifications/push')).send({ endpoint, keys, lang: 'bn', mode: 'web' }).expect(204)
      expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(1)
      await admin.patch(api(`/admin/orders/${order.id}/status`)).send({ status: 'CANCELLED' }).expect(200)
      const cancelled = await waitFor(() => pushedTo(endpoint)[1])
      expect(cancelled.payload).toMatchObject({ title: `অর্ডার ${order.code}: বাতিল`, url: `/orders/${order.id}`, lang: 'bn' })

      // Turned off (or logged out): nothing more reaches it.
      await agent.delete(api('/notifications/push')).send({ endpoint }).expect(204)
      expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0)
    })

    it('moves a shared browser to whoever signs in, and forgets one its push service dropped', async () => {
      const first = await signup('01712000071')
      const second = await signup('01712000072')
      const admin = await adminAgent()
      const endpoint = 'https://web.push.apple.com/e2e-shared-71'
      await first.agent.put(api('/notifications/push')).send({ endpoint, keys }).expect(204)
      await second.agent.put(api('/notifications/push')).send({ endpoint, keys }).expect(204)
      // The same browser can also be a staff member's: that is a separate row.
      await admin.put(api('/admin/notifications/push')).send({ endpoint, keys, lang: 'en' }).expect(204)
      const rows = await prisma.pushSubscription.findMany({ where: { endpoint }, orderBy: { audience: 'asc' } })
      expect(rows.map(row => [row.audience, row.userId, row.basePath])).toEqual([
        ['CUSTOMER', second.body.user.id, ''],
        ['ADMIN', null, '/admin'],
      ])
      // Only the signed-in owner's row goes.
      await first.agent.delete(api('/notifications/push')).send({ endpoint }).expect(204)
      expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(2)
      await admin.delete(api('/admin/notifications/push')).send({ endpoint }).expect(204)

      gone.add(endpoint)
      await admin.post(api('/admin/notifications/broadcast')).send({ titleBn: 'ঘোষণা', titleEn: 'Notice', bodyBn: 'আজ ছুটি', bodyEn: 'Closed today', userIds: [second.body.user.id] }).expect(201)
      await waitFor(async () => (await prisma.pushSubscription.count({ where: { endpoint } })) === 0)
    })

    it('tells staff about new orders on their devices', async () => {
      const admin = await adminAgent()
      const endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/e2e-admin'
      await admin.get(api('/admin/notifications/push')).expect(200).expect(res => expect(res.body.publicKey).toBeTruthy())
      await admin.put(api('/admin/notifications/push')).send({ endpoint, keys, lang: 'en' }).expect(204)
      const { agent } = await signup('01712000073')
      const order = (await agent.post(api('/orders/parcel')).send({ product: 'a', pickupAddress: 'A', dropoffAddress: 'B', pickupPin: PIN, dropoffPin: PIN, receiverMobile: '01711111111', schedule }).expect(201)).body as OrderDetail
      const push = await waitFor(() => pushedTo(endpoint).find(item => item.payload.url === `/admin/orders/${order.id}`))
      expect(push.payload).toMatchObject({ title: `New order ${order.code}`, area: 'admin', tag: `order-${order.id}` })
      await admin.delete(api('/admin/notifications/push')).send({ endpoint }).expect(204)
    })
  })

  describe('admin', () => {
    it('keeps admin routes away from customers and enforces roles', async () => {
      const { agent } = await signup('01712000020')
      await agent.get(api('/admin/orders')).expect(401)
      const admin = await adminAgent()
      await admin.post(api('/admin/staff')).send({ name: 'Op', mobile: '01912000020', password: 'operator1', roleId: ROLE_ID.OPERATOR }).expect(201)
      const operator = request.agent(app.getHttpServer())
      await operator.post(api('/admin/auth/login')).send({ mobile: '01912000020', password: 'operator1' }).expect(200)
      await operator.get(api('/admin/orders')).expect(200)
      await operator.put(api('/admin/catalog/pricing')).send(DEFAULT_PRICING).expect(403)
      await operator.get(api('/admin/staff')).expect(403)
    })

    it('moves orders through allowed statuses only, records the timeline and notifies the customer', async () => {
      const { agent } = await signup('01712000021')
      const admin = await adminAgent()
      const order = (await agent.post(api('/orders/parcel')).send({ product: 'a', pickupAddress: 'A', dropoffAddress: 'B', pickupPin: PIN, dropoffPin: PIN, receiverMobile: '01711111111', schedule })).body as OrderDetail
      await admin.patch(api(`/admin/orders/${order.id}/status`)).send({ status: 'COMPLETED' }).expect(400)
      await admin.patch(api(`/admin/orders/${order.id}/status`)).send({ status: 'BOOKED', note: 'রাইডার আসছে' }).expect(200)
      const done = await admin.patch(api(`/admin/orders/${order.id}/status`)).send({ status: 'COMPLETED' }).expect(200)
      expect(done.body.events.map((event: { to: string }) => event.to)).toEqual(['PENDING', 'BOOKED', 'COMPLETED'])
      await new Promise(resolve => setTimeout(resolve, 200))
      const inbox = await agent.get(api('/notifications')).expect(200)
      expect(inbox.body.items.map((item: { type: string }) => item.type)).toEqual(['ORDER_STATUS', 'ORDER_STATUS'])
      expect(inbox.body.items[1].body.bn).toContain('রাইডার আসছে')
      await agent.get(api('/notifications/unread-count')).expect(200).expect(res => expect(res.body.count).toBe(2))
    })

    it('prices a quote on top of the fees the order was placed with', async () => {
      const { agent } = await signup('01712000022')
      const admin = await adminAgent()
      const order = (await agent.post(api('/orders/bazar')).send({ address: 'x', addressPin: PIN, contactMobile: '01712000022', schedule, items: [{ name: 'a', quantity: '1' }] })).body as OrderDetail
      await admin.put(api('/admin/catalog/pricing')).send({ ...DEFAULT_PRICING, bazarShoppingFee: 999 }).expect(200)
      const quoted = await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ id: order.items[0]!.id, name: 'a', quantity: '1', price: 300 }] }).expect(200)
      expect(quoted.body).toMatchObject({ itemsTotal: 300, serviceFee: 150, total: 530, status: 'QUOTED' })
      await admin.put(api('/admin/catalog/pricing')).send(DEFAULT_PRICING).expect(200)
    })

    it('has staff price a bazar order, the customer confirm it, and then locks the price', async () => {
      const { agent } = await signup('01712000025')
      const admin = await adminAgent()
      const order = (
        await agent
          .post(api('/orders/bazar'))
          .send({ address: 'x', addressPin: PIN, contactMobile: '01712000025', schedule, items: [{ name: 'চাল', quantity: '5 কেজি' }, { name: 'আলু', quantity: '2 কেজি', variety: 'দেশি' }] })
          .expect(201)
      ).body as OrderDetail
      const [rice, potatoes] = order.items

      // Only a quote moves it on: staff can't book it, and the customer has nothing to confirm yet.
      await admin.patch(api(`/admin/orders/${order.id}/status`)).send({ status: 'BOOKED' }).expect(400).expect(res => expect(res.body.code).toBe('order.bad_transition'))
      await agent.post(api(`/orders/${order.id}/confirm`)).send({ total: 230, quoteVersion: 0 }).expect(400).expect(res => expect(res.body.code).toBe('order.bad_transition'))
      await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ id: rice!.id, name: 'চাল', quantity: '5 কেজি' }] }).expect(400).expect(res => expect(res.body.code).toBe('quote.items'))

      // Potatoes are out, fish is in.
      const quoted = await admin
        .put(api(`/admin/orders/${order.id}/quote`))
        .send({ items: [{ id: rice!.id, name: 'চাল', quantity: '5 কেজি', price: 350 }, { name: 'রুই মাছ', quantity: '1 কেজি', price: 100 }], note: 'দেশি আলু পাওয়া যায়নি' })
        .expect(200)
      expect(quoted.body).toMatchObject({ status: 'QUOTED', itemsTotal: 450, total: 680, quoteVersion: 1 })
      expect(quoted.body.items.map((item: { name: string; price: number }) => [item.name, item.price])).toEqual([
        ['চাল', 350],
        ['রুই মাছ', 100],
      ])
      expect(await prisma.orderItem.findUnique({ where: { id: potatoes!.id } })).toBeNull()
      const seen = (await agent.get(api(`/orders/${order.id}`)).expect(200)).body as OrderDetail
      expect(seen).toMatchObject({ canConfirm: true, canCancel: true })
      expect(seen.events.at(-1)).toMatchObject({ to: 'QUOTED', note: 'দেশি আলু পাওয়া যায়নি' })

      // A new price before the customer decides: confirming the old one is refused.
      await admin
        .put(api(`/admin/orders/${order.id}/quote`))
        .send({ items: [{ id: rice!.id, name: 'চাল', quantity: '5 কেজি', price: 360 }, { id: quoted.body.items[1].id, name: 'রুই মাছ', quantity: '1 কেজি', price: 100 }], note: 'চালের দাম বেড়েছে' })
        .expect(200)
      await agent.post(api(`/orders/${order.id}/confirm`)).send({ total: 680, quoteVersion: 1 }).expect(409).expect(res => expect(res.body.code).toBe('order.quote_changed'))
      const confirmed = await agent.post(api(`/orders/${order.id}/confirm`)).send({ total: 690, quoteVersion: 2 }).expect(200)
      expect(confirmed.body).toMatchObject({ status: 'BOOKED', total: 690, canConfirm: false, canCancel: false })

      // Locked: no more quotes, and the customer can't cancel a booked order.
      await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ id: rice!.id, name: 'চাল', quantity: '5 কেজি', price: 1 }] }).expect(400).expect(res => expect(res.body.code).toBe('order.bill_locked'))
      await agent.post(api(`/orders/${order.id}/cancel`)).expect(400)
      await admin.patch(api(`/admin/orders/${order.id}/status`)).send({ status: 'IN_PROGRESS' }).expect(200)

      await new Promise(resolve => setTimeout(resolve, 200))
      const inbox = (await agent.get(api('/notifications')).expect(200)).body.items as { type: string; title: { en: string }; body: { bn: string }; data: { status?: string } }[]
      expect(inbox.map(item => item.title.en)).toEqual([`Order ${order.code}: In progress`, `Order ${order.code}: new price`, `Order ${order.code}: price ready`])
      // The new price says how the total moved, the whole bill, and keeps the staff note.
      expect(inbox[1]!.body.bn).toBe('মোট বিল 680 থেকে 690 টাকা হয়েছে। বাজার 460 + মজুরী 150 + ডেলিভারী 80 = মোট 690 টাকা। চালের দাম বেড়েছে। দেখে কনফার্ম বা বাতিল করুন।')
      expect(inbox[2]!.body.bn).toContain('দেশি আলু পাওয়া যায়নি')
      const staffInbox = (await admin.get(api('/admin/notifications')).expect(200)).body.items as { title: { en: string } }[]
      expect(staffInbox.map(item => item.title.en)).toContain(`Order ${order.code} confirmed`)
    })

    it('lets staff add a prescription order\'s lines, and the customer cancel the quote', async () => {
      const { agent } = await signup('01712000026')
      const admin = await adminAgent()
      const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000', 'hex')
      const upload = await agent.post(api('/uploads/prescription')).attach('file', png, { filename: 'rx.png', contentType: 'image/png' }).expect(201)
      const order = (await agent.post(api('/orders/medicine')).send({ address: 'x', addressPin: PIN, contactMobile: '01712000026', schedule, prescriptionUploadId: upload.body.id, items: [] }).expect(201)).body as OrderDetail
      expect(order).toMatchObject({ items: [], total: 60 })

      await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ id: 'not-a-line', name: 'Napa', quantity: '1', price: 12 }] }).expect(400)
      const quoted = await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ name: 'Napa', quantity: '1 পাতা', price: 12 }, { name: 'Seclo', quantity: '1 পাতা', price: 88 }] }).expect(200)
      expect(quoted.body).toMatchObject({ status: 'QUOTED', itemsTotal: 100, total: 160 })

      const cancelled = await agent.post(api(`/orders/${order.id}/cancel`)).expect(200)
      expect(cancelled.body).toMatchObject({ status: 'CANCELLED', canConfirm: false })
      await agent.post(api(`/orders/${order.id}/confirm`)).send({ total: 160, quoteVersion: 1 }).expect(400).expect(res => expect(res.body.code).toBe('order.bad_transition'))

      // Parcel keeps its Catalog price: there is nothing to quote.
      const parcel = (await agent.post(api('/orders/parcel')).send({ product: 'a', pickupAddress: 'A', dropoffAddress: 'B', pickupPin: PIN, dropoffPin: PIN, receiverMobile: '01711111111', schedule }).expect(201)).body as OrderDetail
      await admin.put(api(`/admin/orders/${parcel.id}/quote`)).send({ items: [{ name: 'x', quantity: '1', price: 1 }] }).expect(400)
    })

    it('has staff price a shifting order\'s vehicle by distance, and the customer confirm it', async () => {
      const { agent } = await signup('01712000028')
      const admin = await adminAgent()
      const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { isActive: true } })
      const placeShifting = async () =>
        (
          await agent
            .post(api('/orders/shifting'))
            .send({ loadingArea: 'মিরপুর ১০', unloadingArea: 'উত্তরা', loadingPin: PIN, unloadingPin: PIN, schedule, vehicleId: vehicle.id, labourers: 1, loadingFloor: 1, unloadingFloor: 1 })
            .expect(201)
        ).body as OrderDetail
      const order = await placeShifting()
      expect(order).toMatchObject({ itemsTotal: 0, serviceFee: 220, total: 220, quoteVersion: 0, canConfirm: false })

      // Only a quote moves it on, and only through its own endpoint.
      await admin.patch(api(`/admin/orders/${order.id}/status`)).send({ status: 'BOOKED' }).expect(400).expect(res => expect(res.body.code).toBe('order.bad_transition'))
      await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ name: 'x', quantity: '1', price: 1 }] }).expect(400).expect(res => expect(res.body.code).toBe('validation'))
      await admin.put(api(`/admin/orders/${order.id}/shifting-quote`)).send({}).expect(400).expect(res => expect(res.body.code).toBe('quote.vehicle'))
      const bazar = (await agent.post(api('/orders/bazar')).send({ address: 'x', addressPin: PIN, contactMobile: '01712000028', schedule, items: [{ name: 'a', quantity: '1' }] }).expect(201)).body as OrderDetail
      await admin.put(api(`/admin/orders/${bazar.id}/shifting-quote`)).send({ vehicleRate: 1500 }).expect(400).expect(res => expect(res.body.code).toBe('validation'))

      // A long way: the rent goes up from the starting rate. Labour and floors stay as placed.
      const quoted = await admin.put(api(`/admin/orders/${order.id}/shifting-quote`)).send({ vehicleRate: 1500, note: 'মিরপুর থেকে উত্তরা ১৪ কিমি' }).expect(200)
      expect(quoted.body).toMatchObject({ status: 'QUOTED', itemsTotal: 1500, serviceFee: 220, total: 1720, quoteVersion: 1, shifting: { vehicleRate: 1500 } })
      const [bill] = await prisma.auditLog.findMany({ where: { entityId: order.id, action: 'ORDER_BILL_UPDATED' } })
      expect(bill!.changes).toEqual([
        { field: 'vehicleRate', from: null, to: 1500 },
        { field: 'total', from: 220, to: 1720 },
      ])
      const [priceReady] = await waitFor(async () => {
        const items = (await agent.get(api('/notifications')).expect(200)).body.items as { body: { bn: string; en: string } }[]
        return items.length ? items : null
      })
      expect(priceReady!.body.bn).toBe('গাড়ী ভাড়া 1500 + লেবার ও ফ্লোর 220 = মোট 1720 টাকা। মিরপুর থেকে উত্তরা ১৪ কিমি। দেখে কনফার্ম বা বাতিল করুন।')
      expect(priceReady!.body.en).toContain('Vehicle Tk 1500 + labour and floors Tk 220 = Tk 1720')

      // A new rent before the customer decides: only the latest can be confirmed.
      await admin.put(api(`/admin/orders/${order.id}/shifting-quote`)).send({ vehicleRate: 1400 }).expect(200)
      await agent.post(api(`/orders/${order.id}/confirm`)).send({ total: 1720, quoteVersion: 1 }).expect(409).expect(res => expect(res.body.code).toBe('order.quote_changed'))
      const confirmed = await agent.post(api(`/orders/${order.id}/confirm`)).send({ total: 1620, quoteVersion: 2 }).expect(200)
      expect(confirmed.body).toMatchObject({ status: 'BOOKED', total: 1620, shifting: { vehicleRate: 1400 }, canConfirm: false })
      await admin.put(api(`/admin/orders/${order.id}/shifting-quote`)).send({ vehicleRate: 1 }).expect(400).expect(res => expect(res.body.code).toBe('order.bill_locked'))

      // The customer can also say no to the rent.
      const other = await placeShifting()
      await admin.put(api(`/admin/orders/${other.id}/shifting-quote`)).send({ vehicleRate: 2000 }).expect(200)
      const cancelled = await agent.post(api(`/orders/${other.id}/cancel`)).expect(200)
      expect(cancelled.body).toMatchObject({ status: 'CANCELLED', canConfirm: false })
    })

    it('lets staff change the charges in a quote, and the customer confirm only the quote they saw', async () => {
      const { agent } = await signup('01712000027')
      const admin = await adminAgent()
      const order = (await agent.post(api('/orders/bazar')).send({ address: 'দূরের ঠিকানা', addressPin: PIN, contactMobile: '01712000027', schedule, items: [{ name: 'চাল', quantity: '5 কেজি' }] }).expect(201)).body as OrderDetail
      expect(order).toMatchObject({ serviceFee: 150, deliveryFee: 80, total: 230, quoteVersion: 0 })
      const line = { id: order.items[0]!.id, name: 'চাল', quantity: '5 কেজি' }

      // A far address: the delivery charge goes up in the quote.
      const quoted = await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ ...line, price: 300 }], deliveryFee: 120, note: 'দূরত্ব বেশি' }).expect(200)
      expect(quoted.body).toMatchObject({ itemsTotal: 300, serviceFee: 150, deliveryFee: 120, total: 570, quoteVersion: 1 })
      const [bill] = await prisma.auditLog.findMany({ where: { entityId: order.id, action: 'ORDER_BILL_UPDATED' } })
      expect(bill!.changes).toEqual(
        expect.arrayContaining([
          { field: 'deliveryFee', from: 80, to: 120 },
          { field: 'total', from: 230, to: 570 },
        ]),
      )
      const [priceReady] = await waitFor(async () => {
        const items = (await agent.get(api('/notifications')).expect(200)).body.items as { body: { bn: string; en: string } }[]
        return items.length ? items : null
      })
      expect(priceReady!.body.bn).toContain('ডেলিভারী খরচ 80 → 120 টাকা')
      expect(priceReady!.body.en).toContain('Bazar Tk 300 + shopping fee Tk 150 + delivery Tk 120 = Tk 570')

      // A new quote with the same total but a different bill: the customer must see it before confirming.
      const requoted = await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ ...line, price: 340 }], deliveryFee: 80 }).expect(200)
      expect(requoted.body).toMatchObject({ itemsTotal: 340, deliveryFee: 80, total: 570, quoteVersion: 2 })
      await agent.post(api(`/orders/${order.id}/confirm`)).send({ total: 570, quoteVersion: 1 }).expect(409).expect(res => expect(res.body.code).toBe('order.quote_changed'))
      await agent.post(api(`/orders/${order.id}/confirm`)).send({ total: 570, quoteVersion: 2 }).expect(200)

      // Medicine has no shopping fee; its delivery can be waived.
      const medicine = (await agent.post(api('/orders/medicine')).send({ address: 'x', addressPin: PIN, contactMobile: '01712000027', schedule, items: [{ name: 'Napa', quantity: '1', company: 'Beximco', category: 'জ্বর' }] }).expect(201)).body as OrderDetail
      const napa = { id: medicine.items[0]!.id, name: 'Napa', quantity: '1', price: 12 }
      await admin.put(api(`/admin/orders/${medicine.id}/quote`)).send({ items: [napa], serviceFee: 50 }).expect(400).expect(res => expect(res.body.code).toBe('quote.fees'))
      await admin.put(api(`/admin/orders/${medicine.id}/quote`)).send({ items: [napa], deliveryFee: -1 }).expect(400).expect(res => expect(res.body.code).toBe('quote.fees'))
      const free = await admin.put(api(`/admin/orders/${medicine.id}/quote`)).send({ items: [napa], deliveryFee: 0 }).expect(200)
      expect(free.body).toMatchObject({ serviceFee: 0, deliveryFee: 0, total: 12 })
    })

    it('pushes new orders to admins in real time', async () => {
      const admin = await adminAgent()
      const login = await admin.post(api('/admin/auth/login')).send(ADMIN).expect(200)
      const socket: Socket = io(`${baseUrl}${SOCKET_NAMESPACE}`, { auth: { audience: 'admin', token: login.body.tokens.accessToken }, transports: ['websocket'] })
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve())
        socket.on('connect_error', reject)
      })
      const received = new Promise<{ code: string }>(resolve => socket.once(SOCKET_EVENTS.orderNew, resolve))
      const { agent } = await signup('01712000023')
      const order = (await agent.post(api('/orders/parcel')).send({ product: 'a', pickupAddress: 'A', dropoffAddress: 'B', pickupPin: PIN, dropoffPin: PIN, receiverMobile: '01711111111', schedule })).body as OrderDetail
      await expect(received).resolves.toMatchObject({ code: order.code })
      socket.close()
    })

    it('refuses unauthenticated sockets at the handshake', async () => {
      const socket = io(`${baseUrl}${SOCKET_NAMESPACE}`, { transports: ['websocket'], reconnection: false })
      const error = await new Promise<Error>(resolve => socket.on('connect_error', resolve))
      expect(error.message).toBe('unauthorized')
      socket.close()
    })

    it('blocks a customer immediately', async () => {
      const { agent, body } = await signup('01712000024')
      const admin = await adminAgent()
      await admin.patch(api(`/admin/customers/${body.user.id}`)).send({ isBlocked: true }).expect(200)
      await agent.get(api('/orders')).expect(403).expect(res => expect(res.body.code).toBe('auth.blocked'))
      await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01712000024', password: 'secret12' }).expect(403)
    })

    it('summarises the dashboard in Bangladesh days, counting only confirmed bills as revenue', async () => {
      const admin = await adminAgent()
      const today = isoDateInBd()
      const dashboard = await admin.get(api('/admin/dashboard?days=7')).expect(200)
      expect(dashboard.body.series).toHaveLength(7)
      expect(dashboard.body.series.at(-1).date).toBe(today)
      expect(dashboard.body).toMatchObject({ to: today, bucket: 'day' })
      expect(dashboard.body.live.todayOrders).toBeGreaterThan(0)

      // Every order in these tests was placed today.
      const confirmed = await prisma.order.aggregate({ where: { status: { in: ['BOOKED', 'IN_PROGRESS', 'COMPLETED'] } }, _sum: { total: true }, _count: { _all: true } })
      const placed = await prisma.order.count()
      expect(dashboard.body.current.orders).toBe(placed)
      expect(dashboard.body.current.revenue).toBe(confirmed._sum.total ?? 0)
      expect(dashboard.body.live.todayRevenue).toBe(confirmed._sum.total ?? 0)
      expect(dashboard.body.series.at(-1).revenue).toBe(confirmed._sum.total ?? 0)

      const stats = await admin.get(api(`/admin/orders/stats?from=${today}&to=${today}`)).expect(200)
      expect(stats.body).toMatchObject({ orders: placed, revenue: confirmed._sum.total ?? 0 })
      expect(stats.body.byStatus.PENDING).toBe(await prisma.order.count({ where: { status: 'PENDING' } }))

      // A reversed range, or one ending in the future, is refused with a message.
      await admin.get(api(`/admin/dashboard?from=${today}&to=2000-01-01`)).expect(400).expect(res => expect(res.body.code).toBe('range.invalid'))
      await admin.get(api('/admin/dashboard?to=2999-01-01')).expect(400)
      // Longer periods are charted by the week.
      const year = await admin.get(api('/admin/dashboard?days=200')).expect(200)
      expect(year.body.bucket).toBe('week')
      expect(year.body.series.at(-1).revenue).toBe(confirmed._sum.total ?? 0)
    })

    it('pages the admin lists by number, with the total the filters match', async () => {
      const admin = await adminAgent()
      const total = await prisma.order.count()
      const first = await admin.get(api('/admin/orders?limit=2')).expect(200)
      expect(first.body).toMatchObject({ page: 1, limit: 2, total, pageCount: Math.ceil(total / 2) })
      expect(first.body.items).toHaveLength(2)
      const second = await admin.get(api('/admin/orders?limit=2&page=2')).expect(200)
      expect(second.body.items).toHaveLength(Math.min(2, total - 2))
      // No order shows on two pages.
      const ids = [...first.body.items, ...second.body.items].map((order: { id: string }) => order.id)
      expect(new Set(ids).size).toBe(ids.length)
      // Past the last page the list is empty, but still says how many there are.
      await admin.get(api('/admin/orders?page=999')).expect(200).expect(res => expect(res.body).toMatchObject({ items: [], total }))
      await admin.get(api('/admin/orders?page=0')).expect(400)

      const byTotal = (await admin.get(api('/admin/orders?sort=total_desc&limit=100')).expect(200)).body.items as { total: number }[]
      expect(byTotal.map(order => order.total)).toEqual([...byTotal.map(order => order.total)].sort((a, b) => b - a))

      const customers = await admin.get(api('/admin/customers?limit=1&ordered=true')).expect(200)
      expect(customers.body.total).toBe(await prisma.user.count({ where: { orders: { some: {} } } }))
      const customerStats = await admin.get(api('/admin/customers/stats')).expect(200)
      expect(customerStats.body).toMatchObject({ total: await prisma.user.count(), blocked: await prisma.user.count({ where: { isBlocked: true } }) })
      expect(customerStats.body.ordered + customerStats.body.neverOrdered).toBe(customerStats.body.total)

      const staff = await admin.get(api(`/admin/staff?roleId=${ROLE_ID.SUPER_ADMIN}`)).expect(200)
      expect(staff.body.items.every((item: { role: { isSystem: boolean } }) => item.role.isSystem)).toBe(true)
      const staffStats = await admin.get(api('/admin/staff/stats')).expect(200)
      expect(staffStats.body.total).toBe(await prisma.admin.count())

      const inbox = await admin.get(api('/admin/notifications?limit=1')).expect(200)
      const inboxStats = await admin.get(api('/admin/notifications/stats')).expect(200)
      expect(inbox.body.total).toBe(inboxStats.body.total)
    })

    it('shows what each staff member did to orders to managers only', async () => {
      const admin = await adminAgent()
      const activity = await admin.get(api('/admin/dashboard/staff?days=7')).expect(200)
      expect(activity.body.rows.find((row: { name: string }) => row.name === 'Admin')?.statusChanges).toBeGreaterThan(0)
      await admin.post(api('/admin/staff')).send({ name: 'Op2', mobile: '01912000029', password: 'operator1', roleId: ROLE_ID.OPERATOR }).expect(201)
      const operator = request.agent(app.getHttpServer())
      await operator.post(api('/admin/auth/login')).send({ mobile: '01912000029', password: 'operator1' }).expect(200)
      await operator.get(api('/admin/dashboard')).expect(200)
      await operator.get(api('/admin/dashboard/staff')).expect(403)
    })
  })

  describe('history log', () => {
    const staffAgent = async ({ role, ...body }: { name: string; mobile: string; password: string; role: 'MANAGER' | 'OPERATOR' }) => {
      const admin = await adminAgent()
      const created = await admin.post(api('/admin/staff')).send({ ...body, roleId: ROLE_ID[role] }).expect(201)
      const agent = request.agent(app.getHttpServer())
      await agent.post(api('/admin/auth/login')).send({ mobile: body.mobile, password: body.password }).expect(200)
      return { agent, id: created.body.id as string }
    }

    it('records who changed the prices, with only the values that changed', async () => {
      const manager = await staffAgent({ name: 'Mina', mobile: '01912000030', password: 'manager1', role: 'MANAGER' })
      await manager.agent.put(api('/admin/catalog/pricing')).send({ ...DEFAULT_PRICING, bazarShoppingFee: 999 }).expect(200)
      await manager.agent.put(api('/admin/catalog/pricing')).send(DEFAULT_PRICING).expect(200)
      await manager.agent.put(api('/admin/catalog/pricing')).send(DEFAULT_PRICING).expect(200)

      const log = await manager.agent.get(api(`/admin/audit?entityType=PRICING&adminId=${manager.id}`)).expect(200)
      // Newest first; saving unchanged prices adds nothing.
      expect(log.body.items).toHaveLength(2)
      expect(log.body.items[1]).toMatchObject({
        action: 'PRICING_UPDATED',
        actor: { type: 'ADMIN', id: manager.id, name: 'Mina', role: ROLE_NAME.MANAGER },
        entity: { type: 'PRICING' },
        changes: [{ field: 'bazarShoppingFee', from: 150, to: 999 }],
      })
      expect(log.body.items[0].changes).toEqual([{ field: 'bazarShoppingFee', from: 999, to: 150 }])
    })

    it('lets managers set the delivery hours, which inform but never restrict the order time', async () => {
      const manager = await staffAgent({ name: 'Nila', mobile: '01912000032', password: 'manager1', role: 'MANAGER' })
      const operator = await staffAgent({ name: 'Sumon', mobile: '01912000033', password: 'operator1', role: 'OPERATOR' })
      const hours = { ...DEFAULT_DELIVERY_HOURS, parcel: [{ from: '10:00', to: '18:00' }] }
      await operator.agent.put(api('/admin/catalog/delivery-hours')).send(hours).expect(403)
      await manager.agent
        .put(api('/admin/catalog/delivery-hours'))
        .send({ ...hours, bazar: [{ from: '08:00', to: '12:00' }, { from: '11:00', to: '13:00' }] })
        .expect(400)
        .expect(res => expect(res.body.code).toBe('hours.invalid'))
      await manager.agent.put(api('/admin/catalog/delivery-hours')).send(hours).expect(200)

      const catalog = await request(app.getHttpServer()).get(api('/catalog')).expect(200)
      expect(catalog.body.deliveryHours).toEqual(hours)
      const { agent } = await signup('01712000040')
      const parcel = { product: 'ব্যাগ', pickupAddress: 'A', dropoffAddress: 'B', pickupPin: PIN, dropoffPin: PIN, receiverMobile: '01711111111' }
      await agent.post(api('/orders/parcel')).send({ ...parcel, schedule: { ...schedule, time: '09:00' } }).expect(201)
      await agent.post(api('/orders/parcel')).send({ ...parcel, schedule: { ...schedule, time: '18:00' } }).expect(201)

      const log = await manager.agent.get(api(`/admin/audit?entityType=DELIVERY_HOURS&adminId=${manager.id}`)).expect(200)
      expect(log.body.items).toHaveLength(1)
      expect(log.body.items[0]).toMatchObject({ action: 'DELIVERY_HOURS_UPDATED', changes: [{ field: 'parcelHours', from: '', to: '10:00-18:00' }] })
      await manager.agent.put(api('/admin/catalog/delivery-hours')).send(DEFAULT_DELIVERY_HOURS).expect(200)
    })

    it("keeps an order's whole history, which operators can read but not the full log", async () => {
      const { agent } = await signup('01712000030', 'হাসান')
      const admin = await adminAgent()
      const order = (await agent.post(api('/orders/bazar')).send({ address: 'x', addressPin: PIN, contactMobile: '01712000030', schedule, items: [{ name: 'চাল', quantity: '5 কেজি' }] }).expect(201))
        .body as OrderDetail
      await admin.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ id: order.items[0]!.id, name: 'চাল', quantity: '5 কেজি', price: 400 }], note: 'দোকানের রসিদ' }).expect(200)
      await agent.post(api(`/orders/${order.id}/confirm`)).send({ total: 630, quoteVersion: 1 }).expect(200)

      const operator = await staffAgent({ name: 'Rafi', mobile: '01912000031', password: 'operator1', role: 'OPERATOR' })
      const history = (await operator.agent.get(api(`/admin/orders/${order.id}/history`)).expect(200)).body as { action: string; changes: { field: string }[] }[]
      expect(history.map(entry => entry.action).sort()).toEqual(['ORDER_BILL_UPDATED', 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_STATUS_CHANGED'])
      // No total yet when it was placed: staff price it.
      expect(history[0]).toMatchObject({ action: 'ORDER_CREATED', actor: { type: 'CUSTOMER', name: 'হাসান' }, entity: { type: 'ORDER', id: order.id, label: order.code }, meta: { service: 'bazar' } })
      expect(history.find(entry => entry.action === 'ORDER_BILL_UPDATED')).toMatchObject({
        actor: { type: 'ADMIN', role: ROLE_NAME.SUPER_ADMIN },
        changes: [
          { field: 'item.price', label: 'চাল', from: null, to: 400 },
          { field: 'total', from: 230, to: 630 },
        ],
        note: 'দোকানের রসিদ',
      })
      const statusChanges = history.filter(entry => entry.action === 'ORDER_STATUS_CHANGED')
      expect(statusChanges).toEqual([
        expect.objectContaining({ actor: expect.objectContaining({ type: 'ADMIN' }), changes: [{ field: 'status', from: 'PENDING', to: 'QUOTED' }], note: 'দোকানের রসিদ' }),
        expect.objectContaining({ actor: expect.objectContaining({ type: 'CUSTOMER', name: 'হাসান' }), changes: [{ field: 'status', from: 'QUOTED', to: 'BOOKED' }] }),
      ])
      await operator.agent.get(api('/admin/audit')).expect(403)
    })

    it('logs staff sign-ins and failed attempts, never the password typed', async () => {
      await request(app.getHttpServer()).post(api('/admin/auth/login')).send({ mobile: ADMIN.mobile, password: 'wrong-secret-42' }).expect(401)
      await request(app.getHttpServer()).post(api('/admin/auth/login')).send({ mobile: '01799999999', password: 'whatever1' }).expect(401)
      const admin = await adminAgent()

      const failed = (await admin.get(api('/admin/audit?action=ADMIN_SIGN_IN_FAILED')).expect(200)).body.items
      expect(failed.map((entry: { meta: { reason: string } }) => entry.meta.reason)).toEqual(['unknown_mobile', 'wrong_password'])
      expect(failed[1]).toMatchObject({ actor: { type: 'ADMIN', id: null, name: ADMIN.mobile }, entity: { type: 'STAFF', label: 'Admin' } })
      expect(JSON.stringify(failed)).not.toContain('wrong-secret-42')
      const [signedIn] = (await admin.get(api('/admin/audit?action=ADMIN_SIGNED_IN&limit=1')).expect(200)).body.items
      expect(signedIn).toMatchObject({ actor: { name: 'Admin', role: ROLE_NAME.SUPER_ADMIN }, entity: { type: 'STAFF', label: 'Admin' } })
    })

    it("shows a customer's own actions and what staff did to the account", async () => {
      const { agent, body } = await signup('01712000032', 'সুমি')
      await agent.put(api('/me/location')).send({ address: 'বনানী, ঢাকা', ...PIN }).expect(200)
      const admin = await adminAgent()
      await admin.patch(api(`/admin/customers/${body.user.id}`)).send({ points: 40 }).expect(200)
      await admin.patch(api(`/admin/customers/${body.user.id}`)).send({ isBlocked: true }).expect(200)

      const log = (await admin.get(api(`/admin/audit?customerId=${body.user.id}`)).expect(200)).body.items
      expect(log.map((entry: { action: string }) => entry.action)).toEqual(['CUSTOMER_BLOCKED', 'CUSTOMER_POINTS_CHANGED', 'CUSTOMER_LOCATION_UPDATED', 'CUSTOMER_SIGNED_UP'])
      expect(log[1].changes).toEqual([{ field: 'points', from: 0, to: 40 }])
      expect(log[2].changes).toEqual([{ field: 'location', from: 'উত্তরা, ঢাকা', to: 'বনানী, ঢাকা' }])
    })
  })
  describe('roles and permissions', () => {
    const signIn = async (mobile: string, password = 'staffpass1') => {
      const agent = request.agent(app.getHttpServer())
      await agent.post(api('/admin/auth/login')).send({ mobile, password }).expect(200)
      return agent
    }

    it('lets a role made in the panel do exactly what it grants, and applies a change at once', async () => {
      const admin = await adminAgent()
      const refused = await admin.post(api('/admin/roles')).send({ nameBn: 'দাম ডেস্ক', nameEn: 'Price desk', permissions: ['orders.send_price', 'nonsense.x'] }).expect(400)
      expect(refused.body.code).toBe('field.invalid')
      const role = (await admin.post(api('/admin/roles')).send({ nameBn: 'দাম ডেস্ক', nameEn: 'Price desk', permissions: ['orders.send_price'] }).expect(201)).body
      // Any action brings its module's view along.
      expect(role.permissions).toEqual(['orders.view', 'orders.send_price'])
      await admin.post(api('/admin/staff')).send({ name: 'Desk', mobile: '01912000060', password: 'staffpass1', roleId: role.id }).expect(201)
      const desk = await signIn('01912000060')
      expect((await desk.get(api('/admin/auth/me')).expect(200)).body).toMatchObject({ role: { name: { en: 'Price desk' }, isSystem: false }, permissions: ['orders.view', 'orders.send_price'] })

      const { agent, body: customer } = await signup('01712000088')
      const order = (await agent.post(api('/orders/bazar')).send({ address: 'x', addressPin: PIN, contactMobile: '01712000088', schedule, items: [{ name: 'a', quantity: '1' }] })).body as OrderDetail
      await desk.get(api('/admin/orders')).expect(200)
      await desk.get(api(`/admin/orders/${order.id}/history`)).expect(200)
      await desk.put(api(`/admin/orders/${order.id}/quote`)).send({ items: [{ id: order.items[0]!.id, name: 'a', quantity: '1', price: 100 }] }).expect(200)
      await desk.patch(api(`/admin/orders/${order.id}/status`)).send({ status: 'CANCELLED' }).expect(403)
      await desk.put(api('/admin/catalog/pricing')).send(DEFAULT_PRICING).expect(403)
      await desk.get(api('/admin/offers')).expect(403)
      await desk.get(api('/admin/dashboard')).expect(403)
      await desk.get(api('/admin/customers')).expect(403)
      await desk.get(api('/admin/notifications')).expect(403)
      await desk.post(api('/admin/roles')).send({ nameBn: 'ক', nameEn: 'K', permissions: [] }).expect(403).expect(res => expect(res.body.code).toBe('forbidden'))

      // The next request already has the new permission: no sign-out needed.
      await admin.patch(api(`/admin/roles/${role.id}`)).send({ permissions: ['orders.send_price', 'orders.update_status'] }).expect(200)
      await desk.patch(api(`/admin/orders/${order.id}/status`)).send({ status: 'CANCELLED' }).expect(200)

      const [entry] = (await admin.get(api(`/admin/audit?entityType=ROLE&entityId=${role.id}&action=ROLE_UPDATED`)).expect(200)).body.items
      expect(entry.changes).toEqual([{ field: 'permission.added', from: null, to: 'orders.update_status' }])

      // Blocking and points are separate permissions: the built-in Operator can see customers but change neither.
      const operator = await signIn('01912000020', 'operator1')
      await operator.get(api(`/admin/customers/${customer.user.id}`)).expect(200)
      await operator.patch(api(`/admin/customers/${customer.user.id}`)).send({ points: 5 }).expect(403)
      await operator.patch(api(`/admin/customers/${customer.user.id}`)).send({ isBlocked: true }).expect(403)
    })

    it('keeps the Super admin role and its accounts out of reach of other staff managers', async () => {
      const admin = await adminAgent()
      const superAdminId = (await admin.get(api('/admin/auth/me')).expect(200)).body.id as string
      const lead = (await admin.post(api('/admin/roles')).send({ nameBn: 'স্টাফ লিড', nameEn: 'Staff lead', permissions: ['staff.create', 'staff.edit'] }).expect(201)).body
      await admin.post(api('/admin/staff')).send({ name: 'Lead', mobile: '01912000061', password: 'staffpass1', roleId: lead.id }).expect(201)
      const leadAgent = await signIn('01912000061')

      await leadAgent
        .post(api('/admin/staff'))
        .send({ name: 'X', mobile: '01912000062', password: 'staffpass1', roleId: ROLE_ID.SUPER_ADMIN })
        .expect(403)
        .expect(res => expect(res.body.code).toBe('admin.super_only'))
      const op = (await leadAgent.post(api('/admin/staff')).send({ name: 'Y', mobile: '01912000063', password: 'staffpass1', roleId: ROLE_ID.OPERATOR }).expect(201)).body
      expect(op.role).toMatchObject({ id: ROLE_ID.OPERATOR, name: ROLE_NAME.OPERATOR })
      await leadAgent.patch(api(`/admin/staff/${op.id}`)).send({ roleId: ROLE_ID.SUPER_ADMIN }).expect(403)
      await leadAgent.patch(api(`/admin/staff/${superAdminId}`)).send({ isActive: false }).expect(403).expect(res => expect(res.body.code).toBe('admin.super_only'))
      await leadAgent.patch(api(`/admin/staff/${op.id}`)).send({ roleId: ROLE_ID.MANAGER }).expect(200)
      // Without staff.reset_password, no new passwords.
      await leadAgent.patch(api(`/admin/staff/${op.id}`)).send({ password: 'newpass12' }).expect(403)
      await leadAgent.patch(api(`/admin/staff/${op.id}`)).send({ roleId: 'no-such-role' }).expect(400).expect(res => expect(res.body.code).toBe('role.not_found'))

      const stats = (await admin.get(api('/admin/staff/stats')).expect(200)).body as { byRole: { id: string; count: number }[] }
      expect(stats.byRole.find(role => role.id === lead.id)?.count).toBe(1)
    })

    it('lets staff given Roles & permissions manage other roles, only with permissions they hold', async () => {
      const admin = await adminAgent()
      const desk = (await admin.post(api('/admin/roles')).send({ nameBn: 'রোল ডেস্ক', nameEn: 'Role desk', permissions: ['roles.create', 'roles.edit', 'orders.view'] }).expect(201)).body
      expect(desk.permissions).toEqual(['orders.view', 'roles.view', 'roles.create', 'roles.edit'])
      await admin.post(api('/admin/staff')).send({ name: 'Roles', mobile: '01912000064', password: 'staffpass1', roleId: desk.id }).expect(201)
      const agent = await signIn('01912000064')

      const made = (await agent.post(api('/admin/roles')).send({ nameBn: 'দেখা', nameEn: 'Viewer', permissions: ['orders.view'] }).expect(201)).body
      await agent.post(api('/admin/roles')).send({ nameBn: 'ইতিহাস', nameEn: 'Historian', permissions: ['history.view'] }).expect(403).expect(res => expect(res.body.code).toBe('role.beyond_own'))
      await agent.patch(api(`/admin/roles/${made.id}`)).send({ permissions: ['orders.send_price'] }).expect(403).expect(res => expect(res.body.code).toBe('role.beyond_own'))
      await agent.patch(api(`/admin/roles/${made.id}`)).send({ nameEn: 'Order viewer' }).expect(200)
      // Not their own role (that would let them raise themselves), and never the Super admin's.
      await agent.patch(api(`/admin/roles/${desk.id}`)).send({ nameEn: 'Role desk 2' }).expect(403).expect(res => expect(res.body.code).toBe('role.own'))
      await agent.patch(api(`/admin/roles/${ROLE_ID.SUPER_ADMIN}`)).send({ nameEn: 'X' }).expect(400).expect(res => expect(res.body.code).toBe('role.locked'))
      // A permission they lack on someone else's role stays as it is while they change what they hold.
      const managerBefore = (await admin.get(api('/admin/roles')).expect(200)).body.find((role: { id: string }) => role.id === ROLE_ID.MANAGER).permissions as string[]
      await agent.patch(api(`/admin/roles/${ROLE_ID.MANAGER}`)).send({ permissions: managerBefore.filter(permission => permission !== 'history.view') }).expect(403)
      await agent.patch(api(`/admin/roles/${ROLE_ID.MANAGER}`)).send({ permissions: [...managerBefore, 'roles.view'] }).expect(200)
      await admin.patch(api(`/admin/roles/${ROLE_ID.MANAGER}`)).send({ permissions: managerBefore }).expect(200)

      await agent.delete(api(`/admin/roles/${made.id}`)).expect(403)
      await admin.patch(api(`/admin/roles/${desk.id}`)).send({ permissions: [...desk.permissions, 'roles.delete'] }).expect(200)
      await agent.delete(api(`/admin/roles/${made.id}`)).expect(204)
    })

    it('never changes the Super admin role, and deletes a role only once nobody holds it', async () => {
      const admin = await adminAgent()
      await admin.patch(api(`/admin/roles/${ROLE_ID.SUPER_ADMIN}`)).send({ permissions: [] }).expect(400).expect(res => expect(res.body.code).toBe('role.locked'))
      await admin.delete(api(`/admin/roles/${ROLE_ID.SUPER_ADMIN}`)).expect(400)
      await admin.post(api('/admin/roles')).send({ nameBn: 'আরেক ম্যানেজার', nameEn: 'Manager', permissions: [] }).expect(409).expect(res => expect(res.body.code).toBe('role.name_taken'))
      await admin.delete(api(`/admin/roles/${ROLE_ID.MANAGER}`)).expect(409).expect(res => expect(res.body.code).toBe('role.in_use'))

      const spare = (await admin.post(api('/admin/roles')).send({ nameBn: 'অস্থায়ী', nameEn: 'Temporary', permissions: ['history.view'] }).expect(201)).body
      await admin.delete(api(`/admin/roles/${spare.id}`)).expect(204)
      const roles = (await admin.get(api('/admin/roles')).expect(200)).body as { id: string; isSystem: boolean; permissions: string[] }[]
      expect(roles.find(role => role.id === spare.id)).toBeUndefined()
      // The system role comes first and reports every permission.
      expect(roles[0]).toMatchObject({ id: ROLE_ID.SUPER_ADMIN, isSystem: true })
      expect(roles[0]!.permissions.length).toBeGreaterThan(20)
      const actions = (await admin.get(api(`/admin/audit?entityType=ROLE&entityId=${spare.id}`)).expect(200)).body.items.map((entry: { action: string }) => entry.action)
      expect(actions).toEqual(['ROLE_DELETED', 'ROLE_CREATED'])
    })
  })
})

import type { AddressInfo } from 'node:net'

import { Test } from '@nestjs/testing'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { API_PREFIX, DEFAULT_PRICING, DEFAULT_VEHICLES, isoDateInBd, type OrderDetail, SOCKET_EVENTS, SOCKET_NAMESPACE } from '@/shared'
import bcrypt from 'bcryptjs'
import { io, type Socket } from 'socket.io-client'
import request from 'supertest'

import { AppModule } from '../src/server/app.module'
import { configureApp } from '../src/server/bootstrap'
import { ENV, type Env } from '../src/server/config/env'
import { PrismaService } from '../src/server/prisma/prisma.service'

const ADMIN = { mobile: '01700000000', password: 'admin12345' }
const schedule = { date: isoDateInBd(), time: '10:00' }
const api = (path: string) => `/${API_PREFIX}${path}`

describe('Pashe Achi API (e2e)', () => {
  let app: NestExpressApplication
  let prisma: PrismaService
  let baseUrl: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
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
    await prisma.admin.create({ data: { name: 'Admin', mobile: ADMIN.mobile, role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(ADMIN.password, 4) } })
  })

  afterAll(async () => {
    await app?.close()
  })

  const signup = async (mobile: string, name = 'করিম') => {
    const agent = request.agent(app.getHttpServer())
    const response = await agent.post(api('/auth/signup')).send({ name, mobile, password: 'secret12', location: 'উত্তরা' }).expect(201)
    return { agent, body: response.body as { user: { id: string }; tokens: { accessToken: string; refreshToken: string } } }
  }
  const adminAgent = async () => {
    const agent = request.agent(app.getHttpServer())
    await agent.post(api('/admin/auth/login')).send(ADMIN).expect(200)
    return agent
  }

  describe('auth', () => {
    it('signs up, normalises the mobile and sets httpOnly cookies', async () => {
      const response = await request(app.getHttpServer()).post(api('/auth/signup')).send({ name: 'রহিম', mobile: '+880 1712-000001', password: 'secret12' }).expect(201)
      expect(response.body.user).toMatchObject({ name: 'রহিম', mobile: '01712000001', points: 0 })
      const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? [])
      expect(cookies.some(cookie => cookie.startsWith('pa_at=') && /HttpOnly/i.test(cookie))).toBe(true)
      expect(cookies.some(cookie => cookie.startsWith('pa_rt=') && /SameSite=Lax/i.test(cookie))).toBe(true)
    })

    it('rejects a duplicate mobile, a wrong password and an empty form with message codes', async () => {
      await signup('01712000002')
      await request(app.getHttpServer()).post(api('/auth/signup')).send({ name: 'x', mobile: '01712000002', password: 'secret12' }).expect(409).expect(res => expect(res.body.code).toBe('mobile.taken'))
      await request(app.getHttpServer()).post(api('/auth/login')).send({ mobile: '01712000002', password: 'nope-nope' }).expect(401).expect(res => expect(res.body.code).toBe('auth.invalid'))
      const empty = await request(app.getHttpServer()).post(api('/auth/login')).send({}).expect(400)
      expect(empty.body).toMatchObject({ code: 'auth.login', message: { bn: 'মোবাইল নম্বর ও পাসওয়ার্ড দিন।' } })
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
        .send({ address: 'বাসা ১', contactMobile: '01712000010', schedule, total: 1, items: [{ name: 'চাল', quantity: '5 কেজি', price: 450 }, { name: 'আলু', quantity: '1 কেজি', price: 80 }] })
        .expect(201)
      expect(bazar.body).toMatchObject({ code: 'PA-1001', total: 760, itemsTotal: 530, serviceFee: 150, deliveryFee: 80, status: 'PENDING' })
      const shifting = await agent
        .post(api('/orders/shifting'))
        .send({ loadingArea: 'মিরপুর', unloadingArea: 'উত্তরা', schedule, vehicleId: vehicle.id, labourers: 1, loadingFloor: 1, unloadingFloor: 1 })
        .expect(201)
      expect(shifting.body.total).toBe(1420)
      const parcel = await agent
        .post(api('/orders/parcel'))
        .send({ product: 'ব্যাগ', pickupAddress: 'A', dropoffAddress: 'B', receiverMobile: '01711111111', schedule })
        .expect(201)
      expect(parcel.body.total).toBe(60)
      const medicine = await agent
        .post(api('/orders/medicine'))
        .send({ address: 'বাসা ১', contactMobile: '01712000010', schedule, items: [{ name: 'Napa', quantity: '1 পাতা', company: 'Beximco', category: 'জ্বর', price: 100 }] })
        .expect(201)
      expect(medicine.body.total).toBe(160)
    })

    it('rejects past dates, incomplete rows and disabled vehicles', async () => {
      const { agent } = await signup('01712000011')
      await agent
        .post(api('/orders/bazar'))
        .send({ address: 'x', contactMobile: '01712000011', schedule: { date: '2020-01-01', time: '10:00' }, items: [{ name: 'a', quantity: '1' }] })
        .expect(400)
        .expect(res => expect(res.body.code).toBe('schedule.past'))
      await agent
        .post(api('/orders/medicine'))
        .send({ address: 'x', contactMobile: '01712000011', schedule, items: [{ name: 'Napa', quantity: '1', company: '', category: 'জ্বর', price: 5 }] })
        .expect(400)
      const hidden = await prisma.vehicle.create({ data: { slug: 'hidden', nameBn: 'x', nameEn: 'x', rate: 1, isActive: false } })
      await agent
        .post(api('/orders/shifting'))
        .send({ loadingArea: 'a', unloadingArea: 'b', schedule, vehicleId: hidden.id, labourers: 0, loadingFloor: 0, unloadingFloor: 0 })
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
      const order = { address: 'x', contactMobile: '01712000012', schedule, prescriptionUploadId: upload.body.id, items: [] }
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
      const order = (await agent.post(api('/orders/parcel')).send({ product: 'a', pickupAddress: 'A', dropoffAddress: 'B', receiverMobile: '01711111111', schedule })).body as OrderDetail
      await other.agent.post(api(`/orders/${order.id}/cancel`)).expect(404)
      const cancelled = await agent.post(api(`/orders/${order.id}/cancel`)).expect(200)
      expect(cancelled.body).toMatchObject({ status: 'CANCELLED', canCancel: false })
      await agent.post(api(`/orders/${order.id}/cancel`)).expect(400)
    })
  })

  describe('admin', () => {
    it('keeps admin routes away from customers and enforces roles', async () => {
      const { agent } = await signup('01712000020')
      await agent.get(api('/admin/orders')).expect(401)
      const admin = await adminAgent()
      await admin.post(api('/admin/staff')).send({ name: 'Op', mobile: '01912000020', password: 'operator1', role: 'OPERATOR' }).expect(201)
      const operator = request.agent(app.getHttpServer())
      await operator.post(api('/admin/auth/login')).send({ mobile: '01912000020', password: 'operator1' }).expect(200)
      await operator.get(api('/admin/orders')).expect(200)
      await operator.put(api('/admin/catalog/pricing')).send(DEFAULT_PRICING).expect(403)
      await operator.get(api('/admin/staff')).expect(403)
    })

    it('moves orders through allowed statuses only, records the timeline and notifies the customer', async () => {
      const { agent } = await signup('01712000021')
      const admin = await adminAgent()
      const order = (await agent.post(api('/orders/bazar')).send({ address: 'x', contactMobile: '01712000021', schedule, items: [{ name: 'a', quantity: '1', price: 100 }] })).body as OrderDetail
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

    it('recomputes the bill when an admin corrects line prices, keeping the fee snapshot', async () => {
      const { agent } = await signup('01712000022')
      const admin = await adminAgent()
      const order = (await agent.post(api('/orders/bazar')).send({ address: 'x', contactMobile: '01712000022', schedule, items: [{ name: 'a', quantity: '1' }] })).body as OrderDetail
      await admin.put(api('/admin/catalog/pricing')).send({ ...DEFAULT_PRICING, bazarShoppingFee: 999 }).expect(200)
      const updated = await admin.patch(api(`/admin/orders/${order.id}/items`)).send({ items: [{ id: order.items[0]!.id, price: 300 }] }).expect(200)
      expect(updated.body).toMatchObject({ itemsTotal: 300, serviceFee: 150, total: 530 })
      await admin.put(api('/admin/catalog/pricing')).send(DEFAULT_PRICING).expect(200)
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
      const order = (await agent.post(api('/orders/parcel')).send({ product: 'a', pickupAddress: 'A', dropoffAddress: 'B', receiverMobile: '01711111111', schedule })).body as OrderDetail
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

    it('summarises the dashboard in Bangladesh days', async () => {
      const admin = await adminAgent()
      const dashboard = await admin.get(api('/admin/dashboard?days=7')).expect(200)
      expect(dashboard.body.daily).toHaveLength(7)
      expect(dashboard.body.daily.at(-1).date).toBe(isoDateInBd())
      expect(dashboard.body.today.orders).toBeGreaterThan(0)
    })
  })
})

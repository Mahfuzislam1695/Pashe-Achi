import { Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { type OnGatewayConnection, type OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { SOCKET_NAMESPACE } from '@/shared'
import type { Namespace, Socket } from 'socket.io'

import type { Audience } from '../auth/auth.types'
import { COOKIE_NAMES, parseCookieHeader } from '../auth/cookies'
import { TokenService } from '../auth/token.service'
import { type CustomerBlockedEvent, DOMAIN_EVENTS } from '../common/domain-events'
import { PrismaService } from '../prisma/prisma.service'

export const rooms = {
  user: (id: string) => `user:${id}`,
  admin: (id: string) => `admin:${id}`,
  admins: 'admins',
}

/** The connect_error message clients get when the handshake isn't authenticated. */
export const UNAUTHORIZED = 'unauthorized'

interface SocketIdentity {
  audience: Audience
  id: string
}

/**
 * Realtime channel at /ws. Clients authenticate in the handshake:
 * - browsers: `auth: { audience: 'customer' | 'admin' }` plus their access-token cookie
 * - mobile apps: `auth: { token: '<accessToken>' }` (customer)
 * Unauthenticated handshakes are refused before they connect (connect_error "unauthorized"), so a
 * client can refresh its session and retry. CORS comes from the adapter in bootstrap.ts.
 */
@WebSocketGateway({ namespace: SOCKET_NAMESPACE })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name)

  @WebSocketServer() private readonly server!: Namespace

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(namespace: Namespace) {
    namespace.use((socket, next) => {
      this.authenticate(socket)
        .then(identity => {
          if (!identity) return next(new Error(UNAUTHORIZED))
          socket.data = identity
          next()
        })
        .catch(error => {
          this.logger.warn(`Socket handshake failed: ${String(error)}`)
          next(new Error(UNAUTHORIZED))
        })
    })
  }

  async handleConnection(socket: Socket) {
    const identity = socket.data as SocketIdentity | undefined
    if (!identity) return socket.disconnect(true)
    await socket.join(identity.audience === 'customer' ? [rooms.user(identity.id)] : [rooms.admin(identity.id), rooms.admins])
  }

  private async authenticate(socket: Socket): Promise<SocketIdentity | null> {
    const auth = (socket.handshake.auth ?? {}) as { token?: unknown; audience?: unknown }
    const audience: Audience = auth.audience === 'admin' ? 'admin' : 'customer'
    const token = typeof auth.token === 'string' ? auth.token : parseCookieHeader(socket.handshake.headers.cookie)[COOKIE_NAMES[audience].access]
    const payload = token ? await this.tokens.verifyAccessToken(audience, token) : null
    if (!payload) return null

    if (audience === 'customer') {
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { isBlocked: true } })
      return user && !user.isBlocked ? { audience, id: payload.sub } : null
    }
    const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub }, select: { isActive: true } })
    return admin?.isActive ? { audience, id: payload.sub } : null
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server.to(rooms.user(userId)).emit(event, payload)
  }

  toAdmin(adminId: string, event: string, payload: unknown) {
    this.server.to(rooms.admin(adminId)).emit(event, payload)
  }

  toAdmins(event: string, payload: unknown) {
    this.server.to(rooms.admins).emit(event, payload)
  }

  @OnEvent(DOMAIN_EVENTS.customerBlocked)
  disconnectBlocked({ userId }: CustomerBlockedEvent) {
    this.server.in(rooms.user(userId)).disconnectSockets(true)
  }
}

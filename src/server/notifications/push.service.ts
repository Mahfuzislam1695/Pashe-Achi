import { Inject, Injectable } from '@nestjs/common'
import type { DeviceTokenInput, PushKeyDto, PushSubscriptionInput } from '@/shared'
import { sendNotification } from 'web-push'

import { AppException } from '../common/app.exception'
import { ENV, type Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'
import type { Recipient } from './notifications.service'

/** Where a browser's push messages go: its push service URL and encryption keys. */
export interface PushTarget {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface PushOptions {
  /** Seconds the push service keeps the message for a phone that is offline. */
  TTL: number
  urgency: 'high' | 'normal'
}

/** Sends one encrypted message; rejects with `{ statusCode }` when the push service refuses it. */
export type PushSender = (target: PushTarget, payload: string, options: PushOptions) => Promise<unknown>

/** The sender, or null when push is not set up (no VAPID keys in .env). The e2e tests swap in a recorder. */
export const PUSH_SENDER = Symbol('PUSH_SENDER')

export function createPushSender(env: Env): PushSender | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return null
  const vapidDetails = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
  return (target, payload, options) => sendNotification(target, payload, { ...options, vapidDetails })
}

/**
 * The browsers that get phone or desktop notifications (Web Push), and the phones running the
 * Kingfisher app (Firebase Cloud Messaging). A browser has at most one customer and one admin owner,
 * and a phone one customer, so whoever signs in on a shared phone gets its notifications.
 */
@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
    @Inject(PUSH_SENDER) private readonly sender: PushSender | null,
  ) {}

  publicKey(): PushKeyDto {
    return { publicKey: this.sender ? this.env.VAPID_PUBLIC_KEY || null : null }
  }

  async subscribe(owner: Recipient, input: PushSubscriptionInput, userAgent?: string) {
    if (!this.sender) throw AppException.badRequest('push.endpoint')
    const isCustomer = 'userId' in owner
    const audience = isCustomer ? 'CUSTOMER' : 'ADMIN'
    const fields = {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      ...(isCustomer ? { userId: owner.userId, adminId: null } : { adminId: owner.adminId, userId: null }),
      basePath: isCustomer ? '' : '/admin',
      lang: input.lang,
      userAgent: userAgent?.slice(0, 300) ?? null,
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint_audience: { endpoint: input.endpoint, audience } },
      create: { endpoint: input.endpoint, audience, ...fields },
      update: fields,
    })
  }

  /** Only the signed-in owner's row goes; the same browser may also be subscribed for the admin panel. */
  async unsubscribe(owner: Recipient, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, ...owner } })
  }

  /**
   * A phone's FCM token from the app. Kept even while FCM is off in .env, so phones get push as soon
   * as it is switched on; the app sends it again after every sign-in, token change and language change.
   */
  async registerDevice(userId: string, input: DeviceTokenInput) {
    const fields = { userId, platform: input.platform === 'ios' ? ('IOS' as const) : ('ANDROID' as const), lang: input.lang, appVersion: input.appVersion ?? null }
    await this.prisma.deviceToken.upsert({ where: { token: input.token }, create: { token: input.token, ...fields }, update: fields })
  }

  async removeDevice(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId } })
  }
}

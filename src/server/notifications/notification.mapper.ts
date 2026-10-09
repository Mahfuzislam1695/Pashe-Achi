import type { NotificationData, NotificationDto, NotificationType, Text } from '@/shared'

import type { Notification } from '../generated/prisma/client'

/** What to tell someone: a bilingual title and body plus data the app uses to deep-link. */
export interface NotificationContent {
  type: NotificationType
  title: Text
  body: Text
  data?: NotificationData
}

export const toNotificationRow = (content: NotificationContent) => ({
  type: content.type,
  titleBn: content.title.bn,
  titleEn: content.title.en,
  bodyBn: content.body.bn,
  bodyEn: content.body.en,
  data: (content.data ?? {}) as object,
})

export const toNotificationDto = (row: Notification): NotificationDto => ({
  id: row.id,
  type: row.type,
  title: { bn: row.titleBn, en: row.titleEn },
  body: { bn: row.bodyBn, en: row.bodyEn },
  data: (row.data ?? {}) as NotificationData,
  readAt: row.readAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
})

import { z } from 'zod'

import { isoDateInBd, MOBILE_PATTERN, normalizeMobile } from '../format'
import type { MessageCode } from '../messages'

// Every message is a MessageCode (see messages.ts); the front ends turn it into Bangla/English.

/** A required, trimmed string. Empty input reports `code`. */
export const requiredText = (code: MessageCode, max = 200) =>
  z.string({ error: code }).trim().min(1, { error: code }).max(max, { error: 'field.invalid' })

/** An optional trimmed string. The API stores blank values as null. */
export const optionalText = (max = 200) => z.string({ error: 'field.invalid' }).trim().max(max, { error: 'field.invalid' }).optional()

/**
 * A Bangladeshi mobile number. Blank input reports `code`; anything else that isn't
 * 01[3-9]XXXXXXXX after normalising (+880, spaces, Bengali digits) reports mobile.invalid.
 */
export const mobile = (code: MessageCode) =>
  z
    .string({ error: code })
    .trim()
    .min(1, { error: code })
    .overwrite(normalizeMobile)
    .regex(MOBILE_PATTERN, { error: 'mobile.invalid' })

export const password = (code: MessageCode) =>
  z.string({ error: code }).min(1, { error: code }).min(6, { error: 'password.short' }).max(72, { error: 'field.invalid' })

/** A whole taka amount. */
export const amount = (code: MessageCode = 'field.invalid') => z.number({ error: code }).int({ error: code }).min(0, { error: code }).max(10_000_000, { error: code })

export const count = (code: MessageCode, max: number) => z.number({ error: code }).int({ error: code }).min(0, { error: code }).max(max, { error: code })

/** ডেলিভারি তারিখ (YYYY-MM-DD, today or later in Bangladesh time) and ডেলিভারি টাইম (HH:mm). */
export const scheduleSchema = z.object({
  date: z
    .string({ error: 'schedule.required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'schedule.required' })
    .refine(date => date >= isoDateInBd(), { error: 'schedule.past' }),
  time: z.string({ error: 'schedule.required' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'schedule.required' }),
})
export type ScheduleInput = z.infer<typeof scheduleSchema>

export const idParamSchema = z.object({ id: z.string().min(1).max(64) })

export const cursorQuery = {
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}

import { APP_TIME_ZONE, ORDER_PREFIX } from './brand'

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

export const toBnDigits = (value: number | string) => String(value).replace(/\d/g, digit => BN_DIGITS[Number(digit)]!)

/** Bengali digits to Latin, so "০১৭..." typed on a Bangla keyboard is accepted. */
export const toLatinDigits = (value: string) => value.replace(/[০-৯]/g, digit => String(BN_DIGITS.indexOf(digit)))

/** "+880 1712-345678", "8801712345678", "1712345678" and "০১৭১২৩৪৫৬৭৮" all become "01712345678". */
export const normalizeMobile = (value: string) => {
  const digits = toLatinDigits(value).replace(/[\s\-().]/g, '').replace(/^\+/, '')
  if (digits.startsWith('880')) return digits.slice(2)
  // Typed without the leading 0.
  return /^1[3-9]\d{8}$/.test(digits) ? `0${digits}` : digits
}

export const MOBILE_PATTERN = /^01[3-9]\d{8}$/

/** HH:mm, 24-hour (the value format of <input type="time">). */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const orderCode = (number: number) => `${ORDER_PREFIX}-${number}`

/** YYYY-MM-DD for the given instant in Bangladesh time (the value format of <input type="date">). */
export const isoDateInBd = (date: Date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE })

const DAY_MS = 24 * 60 * 60 * 1000
const dayStart = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`)

/** An inclusive from–to range of YYYY-MM-DD days. */
export type DayRange = { from: string; to: string }

/** The YYYY-MM-DD day `days` after the given one (before it, when negative). */
export const addDays = (isoDate: string, days: number) => new Date(dayStart(isoDate) + days * DAY_MS).toISOString().slice(0, 10)

/** How many days an inclusive YYYY-MM-DD range covers (1 for a single day). */
export const dayCount = (from: string, to: string) => Math.round((dayStart(to) - dayStart(from)) / DAY_MS) + 1

/**
 * The page buttons for a numbered list: every page when there are few, otherwise the first, the
 * last and `around` pages either side of the current one, with null for each gap.
 */
export function pageWindow(page: number, pageCount: number, around = 1): (number | null)[] {
  if (pageCount <= around * 2 + 5) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const start = Math.max(2, Math.min(page - around, pageCount - around * 2 - 2))
  const end = Math.min(pageCount - 1, Math.max(page + around, around * 2 + 3))
  const middle = Array.from({ length: end - start + 1 }, (_, index) => start + index)
  return [1, ...(start > 2 ? [null] : []), ...middle, ...(end < pageCount - 1 ? [null] : []), pageCount]
}

/** Parses an amount typed into a form box. Blank, negative or invalid input counts as 0. */
export const toAmount = (value: string | number | undefined | null) => Math.max(0, Math.round(Number(value) || 0))

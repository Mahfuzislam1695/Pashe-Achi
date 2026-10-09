import { APP_TIME_ZONE, ORDER_PREFIX } from './brand'

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

export const toBnDigits = (value: number | string) => String(value).replace(/\d/g, digit => BN_DIGITS[Number(digit)]!)

/** Bengali digits to Latin, so "০১৭..." typed on a Bangla keyboard is accepted. */
export const toLatinDigits = (value: string) => value.replace(/[০-৯]/g, digit => String(BN_DIGITS.indexOf(digit)))

/** "+880 1712-345678", "8801712345678" and "০১৭১২৩৪৫৬৭৮" all become "01712345678". */
export const normalizeMobile = (value: string) => {
  const digits = toLatinDigits(value).replace(/[\s\-().]/g, '').replace(/^\+/, '')
  return digits.startsWith('880') ? digits.slice(2) : digits
}

export const MOBILE_PATTERN = /^01[3-9]\d{8}$/

export const orderCode = (number: number) => `${ORDER_PREFIX}-${number}`

/** YYYY-MM-DD for the given instant in Bangladesh time (the value format of <input type="date">). */
export const isoDateInBd = (date: Date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE })

/** Parses an amount typed into a form box. Blank, negative or invalid input counts as 0. */
export const toAmount = (value: string | number | undefined | null) => Math.max(0, Math.round(Number(value) || 0))

import { describe, expect, it } from 'vitest'

import { isoDateInBd, normalizeMobile } from '../format'
import { pickIssueCode } from '../messages'
import { loginSchema, signupSchema } from './auth'
import { createBazarOrderSchema, createMedicineOrderSchema, FORM_ERROR_PRIORITY } from './orders'

const today = isoDateInBd()
const schedule = { date: today, time: '09:30' }
const codes = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues.map(issue => issue.message) ?? []

describe('mobile numbers', () => {
  it('normalises +880, spaces and Bengali digits', () => {
    expect(normalizeMobile('+880 1712-345678')).toBe('01712345678')
    expect(normalizeMobile('০১৭১২৩৪৫৬৭৮')).toBe('01712345678')
  })

  it('stores the normalised number', () => {
    expect(loginSchema.parse({ mobile: '+8801712345678', password: 'x' }).mobile).toBe('01712345678')
  })

  it('rejects numbers that are not Bangladeshi mobiles', () => {
    expect(codes(loginSchema.safeParse({ mobile: '0123', password: 'x' }))).toContain('mobile.invalid')
  })
})

describe('signup', () => {
  it('reports missing fields with the sketch message first', () => {
    const result = signupSchema.safeParse({ name: '', mobile: '', password: '' })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.signup)).toBe('auth.signup')
  })

  it('requires 6+ character passwords', () => {
    const result = signupSchema.safeParse({ name: 'Rahim', mobile: '01712345678', password: '123' })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.signup)).toBe('password.short')
  })
})

describe('bazar order', () => {
  const valid = { address: 'House 1, Mirpur', contactMobile: '01712345678', schedule, items: [{ name: 'আলু', quantity: '1 কেজি' }] }

  it('accepts a minimal order', () => {
    expect(createBazarOrderSchema.safeParse(valid).success).toBe(true)
  })

  it('reports an incomplete row before missing details', () => {
    const result = createBazarOrderSchema.safeParse({ ...valid, address: '', items: [{ name: 'আলু', quantity: '' }] })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.bazar)).toBe('bazar.rows')
  })

  it('requires at least one row', () => {
    const result = createBazarOrderSchema.safeParse({ ...valid, items: [] })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.bazar)).toBe('bazar.details')
  })

  it('requires a schedule that is not in the past', () => {
    expect(pickIssueCode(codes(createBazarOrderSchema.safeParse({ ...valid, schedule: { date: '', time: '' } })), FORM_ERROR_PRIORITY.bazar)).toBe('schedule.required')
    expect(pickIssueCode(codes(createBazarOrderSchema.safeParse({ ...valid, schedule: { date: '2000-01-01', time: '09:00' } })), FORM_ERROR_PRIORITY.bazar)).toBe(
      'schedule.past',
    )
  })
})

describe('medicine order', () => {
  const base = { address: 'House 1', contactMobile: '01712345678', schedule, items: [] }

  it('needs a prescription or a medicine row', () => {
    expect(pickIssueCode(codes(createMedicineOrderSchema.safeParse(base)), FORM_ERROR_PRIORITY.medicine)).toBe('medicine.details')
    expect(createMedicineOrderSchema.safeParse({ ...base, prescriptionUploadId: 'upl_1' }).success).toBe(true)
  })

  it('reports the prescription rule even when the schedule is also missing', () => {
    const result = createMedicineOrderSchema.safeParse({ ...base, schedule: { date: '', time: '' } })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.medicine)).toBe('medicine.details')
  })

  it('requires all five columns', () => {
    const result = createMedicineOrderSchema.safeParse({ ...base, items: [{ name: 'Napa', quantity: '1', company: 'Beximco', category: '' }] })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.medicine)).toBe('medicine.rows')
  })
})

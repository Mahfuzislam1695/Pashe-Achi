import { z } from 'zod'

import { LANGS } from '../enums'
import { mobile, password, requiredText } from './common'
import { customerLocationSchema } from './locations'

export const signupSchema = z.object({
  name: requiredText('auth.signup', 80),
  mobile: mobile('auth.signup'),
  /** Picked on the map; required. */
  location: customerLocationSchema,
  /** Only while the super admin asks customers for a password; otherwise the mobile number becomes the password. */
  password: password('password.required').optional(),
  lang: z.enum(LANGS).optional(),
})
export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  mobile: mobile('auth.login'),
  /** Only while the super admin asks customers for a password. */
  password: z.string({ error: 'password.required' }).min(1, { error: 'password.required' }).max(72, { error: 'field.invalid' }).optional(),
})
export type LoginInput = z.infer<typeof loginSchema>

/** Staff (admin panel) login: the password is always required. */
export const staffLoginSchema = z.object({
  mobile: mobile('auth.login'),
  password: z.string({ error: 'password.required' }).min(1, { error: 'password.required' }).max(72, { error: 'field.invalid' }),
})
export type StaffLoginInput = z.infer<typeof staffLoginSchema>

/** Body for /auth/refresh and /auth/logout. Browsers send the token as a cookie instead. */
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(512).optional() })
export type RefreshInput = z.infer<typeof refreshSchema>

export const updateProfileSchema = z.object({
  name: requiredText('profile.name', 80),
  mobile: mobile('profile.mobile'),
  lang: z.enum(LANGS).optional(),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { error: 'password.wrong' }).max(72),
  newPassword: password('password.short'),
})
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

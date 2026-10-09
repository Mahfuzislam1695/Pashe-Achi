import { z } from 'zod'

import { LANGS } from '../enums'
import { mobile, optionalText, password, requiredText } from './common'

export const signupSchema = z.object({
  name: requiredText('auth.signup', 80),
  mobile: mobile('auth.signup'),
  location: optionalText(160),
  password: password('auth.signup'),
  lang: z.enum(LANGS).optional(),
})
export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  mobile: mobile('auth.login'),
  password: z.string({ error: 'auth.login' }).min(1, { error: 'auth.login' }).max(72, { error: 'field.invalid' }),
})
export type LoginInput = z.infer<typeof loginSchema>

/** Body for /auth/refresh and /auth/logout. Browsers send the token as a cookie instead. */
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(512).optional() })
export type RefreshInput = z.infer<typeof refreshSchema>

export const updateProfileSchema = z.object({
  name: requiredText('profile.name', 80),
  mobile: mobile('profile.mobile'),
  location: optionalText(160),
  lang: z.enum(LANGS).optional(),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { error: 'password.wrong' }).max(72),
  newPassword: password('password.short'),
})
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

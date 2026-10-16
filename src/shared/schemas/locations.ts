import { z } from 'zod'

import { LANGS } from '../enums'
import { requiredText } from './common'

/** A map pin. Orders take one per address, always optional: the address text is what's required. */
export const geoPointSchema = z.object({
  lat: z.number({ error: 'field.invalid' }).min(-90, { error: 'field.invalid' }).max(90, { error: 'field.invalid' }),
  lng: z.number({ error: 'field.invalid' }).min(-180, { error: 'field.invalid' }).max(180, { error: 'field.invalid' }),
})

/** আমার লোকেশন: a named place the customer saved on the map. */
export const savedLocationSchema = z.object({
  label: requiredText('location.details', 40),
  address: requiredText('location.details', 300),
  ...geoPointSchema.shape,
  /** Make this the default. A customer's first location is the default anyway. */
  isDefault: z.boolean().optional(),
})
export type SavedLocationInput = z.infer<typeof savedLocationSchema>

export const updateSavedLocationSchema = savedLocationSchema.partial()
export type UpdateSavedLocationInput = z.infer<typeof updateSavedLocationSchema>

/** GET /geo/reverse: the address text for a pin. */
export const reverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  lang: z.enum(LANGS).default('bn'),
})
export type ReverseGeocodeQuery = z.infer<typeof reverseGeocodeQuerySchema>

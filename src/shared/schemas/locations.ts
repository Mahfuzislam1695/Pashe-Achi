import { z } from 'zod'

import { LANGS } from '../enums'
import { optionalText, requiredText } from './common'

/** A map pin. */
export const geoPointSchema = z.object({
  lat: z.number({ error: 'field.invalid' }).min(-90, { error: 'field.invalid' }).max(90, { error: 'field.invalid' }),
  lng: z.number({ error: 'field.invalid' }).min(-180, { error: 'field.invalid' }).max(180, { error: 'field.invalid' }),
})

/** An order address's pin. Every address is picked on the map, so it is required. */
export const requiredPin = z.object(geoPointSchema.shape, { error: 'location.required' })

/**
 * A place picked on the map: the customer's own location (signup, PUT /me/location) and the
 * value of every address box. `address` is what the map gave for the pin; `details` is the
 * house, flat or road the customer added.
 */
export const customerLocationSchema = z.object(
  {
    address: requiredText('location.required', 300),
    details: optionalText(120),
    ...geoPointSchema.shape,
  },
  { error: 'location.required' },
)
export type CustomerLocationInput = z.infer<typeof customerLocationSchema>

/** GET /geo/reverse: the address text for a pin. */
export const reverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  lang: z.enum(LANGS).default('bn'),
})
export type ReverseGeocodeQuery = z.infer<typeof reverseGeocodeQuerySchema>

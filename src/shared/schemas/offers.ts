import { z } from 'zod'

import { SERVICE_IDS } from '../enums'
import { optionalText, requiredText } from './common'

const day = z.string({ error: 'offer.dates' }).regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'offer.dates' })

const offerFields = {
  titleBn: requiredText('offer.title', 120),
  /** English text is optional; customers reading in English see the Bangla when it is blank. */
  titleEn: optionalText(120),
  bodyBn: optionalText(1000),
  bodyEn: optionalText(1000),
  /** The service its "অর্ডার করুন" button opens; null for none. */
  service: z.enum(SERVICE_IDS).nullable().optional(),
  /** Bangladesh days, inclusive. */
  startsOn: day,
  endsOn: day,
  isActive: z.boolean().optional(),
}

const datesInOrder = (value: { startsOn?: unknown; endsOn?: unknown }) =>
  typeof value.startsOn !== 'string' || typeof value.endsOn !== 'string' || value.endsOn >= value.startsOn

/** আজকের অফার, as staff write it (POST /admin/offers). The picture is uploaded separately. */
export const offerSchema = z.object(offerFields).refine(datesInOrder, { error: 'offer.dates', path: ['endsOn'], when: () => true })
export type OfferInput = z.infer<typeof offerSchema>

/** PATCH /admin/offers/:id: any subset. The API checks the dates against the stored ones too. */
export const updateOfferSchema = z.object(offerFields).partial().refine(datesInOrder, { error: 'offer.dates', path: ['endsOn'], when: () => true })
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>

import { z } from 'zod'

import { HOME_BANNER_TARGETS, HOME_TONES, SERVICE_IDS } from '../enums'
import { optionalText, requiredText } from './common'

const bannerFields = {
  titleBn: requiredText('home.title', 120),
  /** English text is optional; customers reading in English see the Bangla when it is blank. */
  titleEn: optionalText(120),
  bodyBn: optionalText(300),
  bodyEn: optionalText(300),
  ctaBn: optionalText(40),
  ctaEn: optionalText(40),
  /** What the button opens; null shows no button. */
  target: z.enum(HOME_BANNER_TARGETS, { error: 'field.invalid' }).nullable().optional(),
  isActive: z.boolean({ error: 'field.invalid' }).optional(),
}

/** POST /admin/home/banners. The picture is uploaded separately. */
export const homeBannerSchema = z.object(bannerFields)
export type HomeBannerInput = z.infer<typeof homeBannerSchema>

/** PATCH /admin/home/banners/:id: any subset. */
export const updateHomeBannerSchema = z.object(bannerFields).partial()
export type UpdateHomeBannerInput = z.infer<typeof updateHomeBannerSchema>

const categoryFields = {
  nameBn: requiredText('home.name', 40),
  nameEn: optionalText(40),
  tone: z.enum(HOME_TONES, { error: 'field.invalid' }).optional(),
  /** A tap adds a bazar list row with the name; off, it only opens the form. */
  addsItem: z.boolean({ error: 'field.invalid' }).optional(),
  isActive: z.boolean({ error: 'field.invalid' }).optional(),
}

/** POST /admin/home/categories. The picture is uploaded separately. */
export const homeCategorySchema = z.object(categoryFields)
export type HomeCategoryInput = z.infer<typeof homeCategorySchema>

/** PATCH /admin/home/categories/:id: any subset. */
export const updateHomeCategorySchema = z.object(categoryFields).partial()
export type UpdateHomeCategoryInput = z.infer<typeof updateHomeCategorySchema>

/** PUT /admin/home/banners/order and /categories/order: every id, in the new order. */
export const homeOrderSchema = z.object({ ids: z.array(z.string().min(1).max(64), { error: 'home.order' }).max(200, { error: 'home.order' }) })
export type HomeOrderInput = z.infer<typeof homeOrderSchema>

const section = z.object({
  headingBn: requiredText('home.heading', 80),
  headingEn: optionalText(80),
  visible: z.boolean({ error: 'field.invalid' }),
})

/** PUT /admin/home/sections: each section's heading and whether it shows. */
export const homeSectionsSchema = z.object({ categories: section, services: section, offers: section })
export type HomeSectionsInput = z.infer<typeof homeSectionsSchema>

/** The :service of the service picture routes. */
export const homeServiceParamSchema = z.object({ service: z.enum(SERVICE_IDS) })

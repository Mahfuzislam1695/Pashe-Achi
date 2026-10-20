// The app's name in one place. The customer site, the admin panel (tab title, logo, welcome screen) and the API
// (order codes, notification text) read from here. The logo files and the icons in public/ (logo-mark, logo-256,
// logo-512, icon-32x32, icon-192x192, icon-512x512, apple-icon, og-image.jpg) are made from the transparent
// public/logo/logo.png, so re-render them if the logo changes.
export const APP_NAME = { bn: 'কিংফিশার', en: 'Kingfisher' } as const
export const APP_LOGO = '/logo/logo-mark.webp'
export const APP_LOGO_LARGE = '/logo/logo-256.webp'
export const APP_LOGO_HERO = '/logo/logo-512.webp'
export const ORDER_PREFIX = 'PA'

// The developer credit (a link to the developer's site) in the landing footer, the sign-in screens and both sidebars.
export const DEVELOPER = { name: 'Aethrasoft', url: 'https://www.aethrasoft.com/' } as const
export const DEVELOPED_BY = { bn: 'ডেভেলপ করেছে', en: 'Developed by' } as const

// These phrases depend on the name's wording and grammar, so they live with it.
export const APP_WELCOME = { bn: 'কিংফিশার-এ স্বাগতম', en: 'WELCOME TO KINGFISHER' } as const
export const APP_TAGLINE = { bn: 'উন্নত জীবনের – সহজ সমাধান', en: 'Better living – simple solutions' } as const

// Photos for the banners, each in public/images as {base}-800.webp and {base}-1600.webp (800 and 1600 px wide).
// All are from Unsplash under the Unsplash License (free for commercial use, no credit required):
//   hero      grocery bags              unsplash.com/photos/8RaUEd8zD-U
//   welcome   fruit stalls, Ahsan Manzil unsplash.com/photos/LqAfMq42qdg
//   street    rickshaws, Dhaka          unsplash.com/photos/PoV905Bpaqo
//   city      aerial view of Dhaka      unsplash.com/photos/sJ4VPkOJKHk
//   bazar     basket of vegetables      unsplash.com/photos/NLU117HCVuc
//   shifting  mover with a box trolley  unsplash.com/photos/GgmZ23grWNY
//   medicine  pharmacist at the shelves unsplash.com/photos/byGTytEGjBo
//   parcel    a parcel handed over      unsplash.com/photos/BFdSCxmqvYc
// hero, welcome and street are 4:5, city 16:9, the four services 3:2.
// public/images/app-bn.webp and app-en.webp (780×1688) are screenshots of the app's /app/bazar screen
// with the demo customer, shown in the landing page's phone frame; retake them when that screen changes.
export const PHOTOS = {
  hero: '/images/hero',
  welcome: '/images/welcome',
  street: '/images/street',
  city: '/images/city',
  bazar: '/images/bazar',
  shifting: '/images/shifting',
  medicine: '/images/medicine',
  parcel: '/images/parcel',
} as const

export type PhotoName = keyof typeof PHOTOS

/** The `src` (the 800 px file) and `srcSet` of a photo, for an <img> with a `sizes` attribute. */
export function photo(name: PhotoName) {
  const base = PHOTOS[name]
  return { src: `${base}-800.webp`, srcSet: `${base}-800.webp 800w, ${base}-1600.webp 1600w` }
}

// All dates (delivery schedule, "today" on the dashboard) are interpreted in Bangladesh time.
export const APP_TIME_ZONE = 'Asia/Dhaka'

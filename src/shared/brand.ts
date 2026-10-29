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

// The head office, shown in the landing page's footer and contact card. `map` opens it in Google Maps (no key).
export const HEAD_OFFICE = {
  label: { bn: 'হেড অফিস', en: 'Head office' },
  address: {
    bn: '(সুন্দরবন কুরিয়ার সার্ভিস সংলগ্ন) রোড ২, বাসা ৫, ধউর মেইন রোড, তুরাগ, উত্তরা, ঢাকা',
    en: '(Next to Sundarban Courier Service) Road 2, House 5, Dhour Main Road, Turag, Uttara, Dhaka',
  },
  map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Sundarban Courier Service, Dhour Main Road, Turag, Uttara, Dhaka')}`,
} as const

// The Kingfisher app's links on /app-download (the Flutter app in mobile/, id com.kingfisherbd24.app).
// null shows "শীঘ্রই আসছে" (coming soon) in place of the button.
// playStore: https://play.google.com/store/apps/details?id=com.kingfisherbd24.app once it is published.
// apk: the API's GET /app/apk, which serves the APK uploaded on the admin panel's System page, or else
// public/downloads/kingfisher.apk (mobile/README.md, "The APK on the website"). A full https:// URL works too.
export const APK_DOWNLOAD_PATH = '/api/v1/app/apk'
export const APP_DOWNLOADS: { playStore: string | null; apk: string | null } = { playStore: null, apk: APK_DOWNLOAD_PATH }

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
// public/images/app-bn.webp and app-en.webp (780×1688) are screenshots of the fresh market screen on a
// phone with the demo customer, shown in the landing page's phone frame; retake them when that screen changes.
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

// Home's bazar category tiles: public/images/cat-{name}-400.webp and -800.webp (4:3; the app bundles
// the 400 px files in mobile/assets/images). Unsplash License, from images.unsplash.com:
//   fish        fish on ice              photo-1563557908-b7787229f123
//   meat        two cuts of beef         photo-1603048297172-c92544798d5a
//   vegetables  a vegetable stall        photo-1550989460-0adf9ea622e2
//   rice        bowls of grains, lentils photo-1766791620623-fab070962a90
//   daily       shelves of jars, bottles photo-1545601445-4d6a0a0565f0
//   more        a bag of groceries       photo-1543168256-418811576931
export const CATEGORY_PHOTOS = ['fish', 'meat', 'vegetables', 'rice', 'daily', 'more'] as const

export type CategoryPhotoName = (typeof CATEGORY_PHOTOS)[number]

/** The `src` (the 400 px file) and `srcSet` of a category photo. */
export function categoryPhoto(name: CategoryPhotoName) {
  const base = `/images/cat-${name}`
  return { src: `${base}-400.webp`, srcSet: `${base}-400.webp 400w, ${base}-800.webp 800w` }
}

// All dates (delivery schedule, "today" on the dashboard) are interpreted in Bangladesh time.
export const APP_TIME_ZONE = 'Asia/Dhaka'

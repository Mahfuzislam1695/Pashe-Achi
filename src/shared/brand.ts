// The app's name in one place. The customer site, the admin panel (tab title, logo, welcome screen) and the API
// (order codes, notification text) read from here. The logo files and the icons in public/ are resized from
// public/logo/logo.jpeg, so re-render them if the logo changes.
export const APP_NAME = { bn: 'কিংফিশার', en: 'Kingfisher' } as const
export const APP_LOGO = '/logo/logo-mark.webp'
export const APP_LOGO_LARGE = '/logo/logo-256.webp'
export const ORDER_PREFIX = 'PA'

// These phrases depend on the name's wording and grammar, so they live with it.
export const APP_WELCOME = { bn: 'কিংফিশার-এ স্বাগতম', en: 'WELCOME TO KINGFISHER' } as const
export const APP_TAGLINE = { bn: 'প্রতিদিনের দরকারে, আমরা পাশে আছি', en: 'Everyday help, right by your side' } as const

// All dates (delivery schedule, "today" on the dashboard) are interpreted in Bangladesh time.
export const APP_TIME_ZONE = 'Asia/Dhaka'

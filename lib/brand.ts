// The app's name in one place. app/layout.tsx (tab title, home-screen name) and app/page.tsx
// (logo, welcome screen, order IDs) read from here. The icons in public/ are PNGs of APP_INITIAL
// on the logo mark, so re-render them if the name changes.
export const APP_NAME = { bn: 'পাশে আছি', en: 'Pashe Achi' }
export const APP_INITIAL = 'পা'
export const ORDER_PREFIX = 'PA'

// These phrases depend on the name's wording and grammar, so they live with it.
export const APP_WELCOME = { bn: 'পাশে আছি-তে স্বাগতম', en: 'WELCOME TO PASHE ACHI' }
export const APP_TAGLINE = { bn: 'প্রতিদিনের দরকারে, আমরা পাশে আছি', en: 'Everyday help, right by your side' }

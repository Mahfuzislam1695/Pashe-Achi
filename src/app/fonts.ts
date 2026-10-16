import { Hind_Siliguri, Inter } from 'next/font/google'

/** The brand font (Bangla and Latin) for the customer site, the admin panel and the 404 page. */
export const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bangla',
})

/**
 * English text and numbers. Inter has no Bengali glyphs, so stacks list it first and Bangla falls
 * through to Hind Siliguri: `var(--font-latin), var(--font-bangla), …`.
 */
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-latin',
})

/** Both font variables, for the <html> class of every root layout. */
export const fontVariables = `${inter.variable} ${hindSiliguri.variable}`

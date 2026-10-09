import { Hind_Siliguri } from 'next/font/google'

/** The brand font (Bangla and Latin) for the customer site, the admin panel and the 404 page. */
export const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bangla',
})

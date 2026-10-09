// Plain values shared by server and client code (a 'use client' module can't export them to the server).

/** Language choice, read by src/app/(customer)/layout.tsx on the server so the first paint is already in that language. */
export const LANG_COOKIE = 'pa_lang'

/** The API's refresh-token cookie. src/proxy.ts only checks that it exists; the API does the real check. */
export const SESSION_COOKIE = 'pa_rt'

/** Where a signed-in customer lands. */
export const HOME_PATH = '/bazar'

// Plain values shared by server and client code (a 'use client' module can't export them to the server).

/** Language choice, read by src/app/(customer)/layout.tsx on the server so the first paint is already in that language. */
export const LANG_COOKIE = 'pa_lang'

/** The API's refresh-token cookie. src/proxy.ts only checks that it exists; the API does the real check. */
export const SESSION_COOKIE = 'pa_rt'

/** The app version (the phone design at every width) lives under this prefix; the web version at the root. */
export const APP_BASE = '/app'

/** Where a signed-in customer lands on the web version. */
export const HOME_PATH = '/bazar'

/** Where a signed-in customer lands on the app version. */
export const APP_HOME_PATH = `${APP_BASE}/bazar`

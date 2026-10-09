// Plain values shared by server and client code.

/** Admin panel language, read by src/app/(admin)/layout.tsx so the first paint is in that language. */
export const LANG_COOKIE = 'pa_admin_lang'

/** The API's admin refresh-token cookie. src/proxy.ts only checks that it exists. */
export const SESSION_COOKIE = 'pa_admin_rt'

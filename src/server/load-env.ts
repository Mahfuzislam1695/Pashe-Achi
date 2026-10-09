import { resolve } from 'node:path'

import { config } from 'dotenv'

import { PROJECT_ROOT } from './project-root'

/** `npm run dev` passes --dev: pages compile on demand with hot reload. `npm start` serves the `next build` output. */
export const DEV = process.argv.includes('--dev')

// The project's one .env file. Values already set in the real environment win.
config({ path: resolve(PROJECT_ROOT, '.env'), quiet: true })
if (!process.env.NODE_ENV) Object.assign(process.env, { NODE_ENV: DEV ? 'development' : 'production' })

import { resolve } from 'node:path'

/** The project root (where .env, .next/ and uploads/ live), from src/server and dist/server alike. */
export const PROJECT_ROOT = resolve(__dirname, '../..')

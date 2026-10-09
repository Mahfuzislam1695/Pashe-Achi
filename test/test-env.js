// Environment for the e2e tests, set before any app module loads.
const path = require('node:path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })

/** TEST_DATABASE_URL, or DATABASE_URL with "_test" appended to the database name. */
function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env (or TEST_DATABASE_URL) to run the e2e tests.')
  const url = new URL(process.env.DATABASE_URL)
  url.pathname = `${url.pathname.replace(/_test$/, '')}_test`
  return url.toString()
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl(),
  JWT_ACCESS_SECRET: 'test-customer-access-secret-0123456789abcdef',
  ADMIN_JWT_ACCESS_SECRET: 'test-admin-access-secret-0123456789abcdefgh',
  UPLOAD_DIR: path.join('uploads', 'test'),
  LOG_LEVEL: 'silent',
  THROTTLE_LIMIT: '10000',
  AUTH_THROTTLE_LIMIT: '10000',
})

module.exports = { testDatabaseUrl }

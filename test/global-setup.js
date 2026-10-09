// Creates the e2e test database (UTF8) if needed and applies every migration to it.
const { execSync } = require('node:child_process')
const path = require('node:path')

const { Client } = require('pg')

module.exports = async function globalSetup() {
  const { testDatabaseUrl } = require('./test-env')
  const url = new URL(testDatabaseUrl())
  const name = decodeURIComponent(url.pathname.slice(1))
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unexpected test database name: ${name}`)

  const admin = new URL(url)
  admin.pathname = '/postgres'
  admin.search = ''
  const client = new Client({ connectionString: admin.toString() })
  await client.connect()
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
  if (!exists.rowCount) await client.query(`CREATE DATABASE "${name}" ENCODING 'UTF8' TEMPLATE template0`)
  await client.end()

  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'ignore',
  })
}

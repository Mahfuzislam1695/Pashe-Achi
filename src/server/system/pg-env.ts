import { APP_TIME_ZONE, isoDateInBd } from '@/shared'

/**
 * DATABASE_URL as the libpq environment variables pg_dump reads. The password travels in the child's
 * environment, never on its command line (where the process list would show it), and Prisma's
 * ?schema= parameter, which pg_dump rejects, is left out.
 */
export function pgEnv(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl)
  const env: Record<string, string> = {
    PGHOST: decodeURIComponent(url.hostname).replace(/^\[(.*)\]$/, '$1') || 'localhost',
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
  }
  if (url.username) env.PGUSER = decodeURIComponent(url.username)
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password)
  const sslMode = url.searchParams.get('sslmode')
  if (sslMode) env.PGSSLMODE = sslMode
  // A Unix socket directory given as ?host=/var/run/postgresql.
  const socketHost = url.searchParams.get('host')
  if (socketHost) env.PGHOST = socketHost
  return env
}

/** The major version in "pg_dump (PostgreSQL) 17.2" or "17.2 (Debian 17.2-1)": 17. */
export const majorVersion = (version: string | null) => {
  const match = version && /(\d+)(?:\.\d+)?/.exec(version.replace(/^\D+/, ''))
  return match ? Number(match[1]) : null
}

/** kingfisher-backup-2026-10-29-0130.dump, in Bangladesh time. */
export function backupFileName(now = new Date()) {
  const time = now.toLocaleTimeString('en-GB', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(':', '')
  return `kingfisher-backup-${isoDateInBd(now)}-${time}.dump`
}

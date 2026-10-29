import { backupFileName, majorVersion, pgEnv } from './pg-env'

describe('pgEnv', () => {
  it('splits DATABASE_URL into libpq variables, decoding the password and dropping ?schema=', () => {
    expect(pgEnv('postgresql://pashe:p%40ss%3Aword@db.local:6543/pashe_achi?schema=public')).toEqual({
      PGHOST: 'db.local',
      PGPORT: '6543',
      PGDATABASE: 'pashe_achi',
      PGUSER: 'pashe',
      PGPASSWORD: 'p@ss:word',
    })
  })

  it('defaults the port and passes sslmode and a socket host through', () => {
    expect(pgEnv('postgres://app@localhost/shop?sslmode=require')).toEqual({ PGHOST: 'localhost', PGPORT: '5432', PGDATABASE: 'shop', PGUSER: 'app', PGSSLMODE: 'require' })
    expect(pgEnv('postgresql://app:x@localhost/shop?host=/var/run/postgresql').PGHOST).toBe('/var/run/postgresql')
  })
})

describe('majorVersion', () => {
  it.each([
    ['pg_dump (PostgreSQL) 17.2', 17],
    ['16.4 (Debian 16.4-1.pgdg120+1)', 16],
    [null, null],
  ])('%s → %s', (version, major) => {
    expect(majorVersion(version)).toBe(major)
  })
})

describe('backupFileName', () => {
  it('uses the Bangladesh date and time', () => {
    expect(backupFileName(new Date('2026-10-28T19:30:00Z'))).toBe('kingfisher-backup-2026-10-29-0130.dump')
  })
})

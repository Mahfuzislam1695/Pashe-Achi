import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { HttpStatus, Inject, Injectable, Logger, StreamableFile } from '@nestjs/common'
import type { BackupFormat, SystemStatusDto } from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app.exception'
import { ENV, type Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'
import { backupFileName, majorVersion, pgEnv } from './pg-env'
import { writeSqlDump } from './sql-dump'

const execFileAsync = promisify(execFile)

/** A dump that takes longer than this is stopped (the whole database is a few hundred MB at most). */
const DUMP_TIMEOUT_MS = 10 * 60 * 1000

/** Where the PostgreSQL packages put pg_dump when it isn't on PATH: a folder per version. */
const PG_DUMP_FOLDERS =
  process.platform === 'win32'
    ? [{ dir: 'C:/Program Files/PostgreSQL', match: /^\d+$/, bin: 'bin/pg_dump.exe' }]
    : [
        { dir: '/usr/lib/postgresql', match: /^\d+$/, bin: 'bin/pg_dump' }, // Debian, Ubuntu
        { dir: '/usr', match: /^pgsql-\d+$/, bin: 'bin/pg_dump' }, // RHEL, Rocky, Alma
        { dir: '/opt/homebrew/opt', match: /^postgresql@\d+$/, bin: 'bin/pg_dump' }, // macOS
        { dir: '/usr/local/opt', match: /^postgresql@\d+$/, bin: 'bin/pg_dump' },
      ]

type PgDump = { path: string; version: string }

/**
 * The System page's database backup. With a pg_dump as new as the server it is PostgreSQL's custom
 * format (.dump, for pg_restore). Without one, as on a host with no PostgreSQL client tools, the app
 * writes the database as plain SQL itself (.sql, see sql-dump.ts), so the backup never depends on
 * what is installed. Either way it goes to a temp file first, so a failure is a proper error rather
 * than a half-sent download, then that file is streamed and deleted.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name)
  private running = false
  private pgDump: PgDump | null = null

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async database(): Promise<SystemStatusDto['database']> {
    const [server, pgDump] = await Promise.all([this.server(), this.findPgDump()])
    return { ...server, pgDumpVersion: pgDump?.version ?? null, backupFormat: this.formatFor(server.serverVersion, pgDump) }
  }

  /** `requested` picks the format; without it, a .dump when pg_dump can make one, else the app's .sql. */
  async backup(actor: AuditActor, requested?: BackupFormat): Promise<StreamableFile> {
    if (this.running) throw AppException.conflict('system.backup_busy')
    this.running = true
    let dir: string | null = null
    const cleanUp = () => dir && rm(dir, { recursive: true, force: true }).catch(error => this.logger.warn(`Could not delete ${dir}: ${String(error)}`))
    try {
      const [server, pgDump] = await Promise.all([this.server(), this.findPgDump()])
      const best = this.formatFor(server.serverVersion, pgDump)
      const format = requested ?? best
      if (format === 'dump' && best !== 'dump') throw new AppException(HttpStatus.SERVICE_UNAVAILABLE, 'system.pg_dump_missing')

      dir = await mkdtemp(join(tmpdir(), 'kingfisher-backup-'))
      const file = backupFileName(new Date(), format)
      const path = join(dir, file)
      if (format === 'dump') await this.dump(pgDump!.path, path)
      else await this.writeSql(path, server)
      const { size } = await stat(path)
      await this.audit.record({ action: 'SYSTEM_BACKUP_DOWNLOADED', actor, entity: { type: 'SYSTEM', id: 'backup', label: file }, meta: { file, size, format } })
      const stream = createReadStream(path)
      // Finished, failed or cancelled by the browser: the temp copy goes either way.
      stream.once('close', () => void cleanUp())
      const type = format === 'dump' ? 'application/octet-stream' : 'application/sql; charset=utf-8'
      return new StreamableFile(stream, { type, length: size, disposition: `attachment; filename="${file}"` })
    } catch (error) {
      await cleanUp()
      throw error
    } finally {
      this.running = false
    }
  }

  private async server() {
    const [row] = await this.prisma.$queryRaw<{ name: string; size: bigint; version: string }[]>`
      SELECT current_database() AS name, pg_database_size(current_database()) AS size, current_setting('server_version') AS version`
    return { name: row.name, size: Number(row.size), serverVersion: row.version.split(' ')[0] }
  }

  /** pg_dump refuses a server newer than itself. */
  private formatFor(serverVersion: string, pgDump: PgDump | null): BackupFormat {
    const server = majorVersion(serverVersion)
    const dump = majorVersion(pgDump?.version ?? null)
    return dump !== null && server !== null && dump >= server ? 'dump' : 'sql'
  }

  /**
   * The newest pg_dump among PG_DUMP_PATH and the install folders, or null. Only a success is
   * remembered, so installing the client tools needs no restart.
   */
  private async findPgDump(): Promise<PgDump | null> {
    if (this.pgDump) return this.pgDump
    const candidates = [this.env.PG_DUMP_PATH]
    for (const { dir, match, bin } of PG_DUMP_FOLDERS) {
      const entries = await readdir(dir).catch(() => [])
      for (const entry of entries) if (match.test(entry)) candidates.push(join(dir, entry, bin))
    }
    const found = await Promise.all(candidates.map(path => this.pgDumpVersion(path).then(version => (version ? { path, version } : null))))
    let best: PgDump | null = null
    for (const candidate of found) {
      if (candidate && (best === null || (majorVersion(candidate.version) ?? 0) > (majorVersion(best.version) ?? 0))) best = candidate
    }
    this.pgDump = best
    return best
  }

  private async pgDumpVersion(path: string) {
    try {
      const { stdout } = await execFileAsync(path, ['--version'], { timeout: 5000, windowsHide: true })
      return stdout.trim().replace(/^pg_dump \(PostgreSQL\)\s*/, '') || null
    } catch {
      return null
    }
  }

  private async writeSql(path: string, server: { name: string; serverVersion: string }) {
    const out = createWriteStream(path, { flags: 'wx' })
    const write = async (text: string) => {
      if (!out.write(text)) await once(out, 'drain')
    }
    try {
      const schema = new URL(this.env.DATABASE_URL).searchParams.get('schema') || 'public'
      await this.prisma.$transaction(tx => writeSqlDump(tx, schema, write, { database: server.name, serverVersion: server.serverVersion }), {
        isolationLevel: 'RepeatableRead',
        maxWait: 10_000,
        timeout: DUMP_TIMEOUT_MS,
      })
      out.end()
      await once(out, 'finish')
    } catch (error) {
      out.destroy()
      this.logger.error(`The app's SQL backup failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
      throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, 'system.backup_failed')
    }
  }

  private dump(pgDump: string, path: string) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(pgDump, ['--format=custom', '--no-owner', '--no-privileges', '--file', path], {
        env: { ...process.env, ...pgEnv(this.env.DATABASE_URL) },
        stdio: ['ignore', 'ignore', 'pipe'],
        timeout: DUMP_TIMEOUT_MS,
        windowsHide: true,
      })
      let stderr = ''
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        if (stderr.length < 4000) stderr += chunk
      })
      child.once('error', (error: NodeJS.ErrnoException) => {
        // Found a moment ago, so it was removed since: look again next time.
        this.pgDump = null
        this.logger.error(`pg_dump could not start (${pgDump}): ${String(error)}`)
        reject(new AppException(HttpStatus.SERVICE_UNAVAILABLE, 'system.pg_dump_missing'))
      })
      child.once('close', (code, signal) => {
        if (code === 0) return resolve()
        this.logger.error(`pg_dump failed (${signal ?? `exit ${code}`}): ${stderr.trim()}`)
        reject(new AppException(HttpStatus.INTERNAL_SERVER_ERROR, 'system.backup_failed'))
      })
    })
  }
}

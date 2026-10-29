import { execFile, spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { HttpStatus, Inject, Injectable, Logger, StreamableFile } from '@nestjs/common'
import type { SystemStatusDto } from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app.exception'
import { ENV, type Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'
import { backupFileName, pgEnv } from './pg-env'

const execFileAsync = promisify(execFile)

/** A dump that takes longer than this is stopped (the whole database is a few hundred MB at most). */
const DUMP_TIMEOUT_MS = 10 * 60 * 1000

/**
 * The System page's database backup: PostgreSQL's own pg_dump in its custom format, which pg_restore
 * loads back in full. It dumps to a temp file first, so a failure is a proper error rather than a
 * half-sent download, then streams that file and deletes it.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name)
  private running = false
  private pgDumpVersion: string | null = null

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async database(): Promise<SystemStatusDto['database']> {
    const [[row], pgDumpVersion] = await Promise.all([
      this.prisma.$queryRaw<{ name: string; size: bigint; version: string }[]>`
        SELECT current_database() AS name, pg_database_size(current_database()) AS size, current_setting('server_version') AS version`,
      this.findPgDump(),
    ])
    return { name: row.name, size: Number(row.size), serverVersion: row.version.split(' ')[0], pgDumpVersion }
  }

  async backup(actor: AuditActor): Promise<StreamableFile> {
    if (this.running) throw AppException.conflict('system.backup_busy')
    this.running = true
    const dir = await mkdtemp(join(tmpdir(), 'kingfisher-backup-'))
    const cleanUp = () => rm(dir, { recursive: true, force: true }).catch(error => this.logger.warn(`Could not delete ${dir}: ${String(error)}`))
    try {
      const file = backupFileName()
      const path = join(dir, file)
      await this.dump(path)
      const { size } = await stat(path)
      await this.audit.record({ action: 'SYSTEM_BACKUP_DOWNLOADED', actor, entity: { type: 'SYSTEM', id: 'backup', label: file }, meta: { file, size } })
      const stream = createReadStream(path)
      // Finished, failed or cancelled by the browser: the temp copy goes either way.
      stream.once('close', () => void cleanUp())
      return new StreamableFile(stream, { type: 'application/octet-stream', length: size, disposition: `attachment; filename="${file}"` })
    } catch (error) {
      await cleanUp()
      throw error
    } finally {
      this.running = false
    }
  }

  /** pg_dump's version (17.2), or null when it can't be run. Only a success is remembered, so installing it needs no restart. */
  private async findPgDump() {
    if (this.pgDumpVersion) return this.pgDumpVersion
    try {
      const { stdout } = await execFileAsync(this.env.PG_DUMP_PATH, ['--version'], { timeout: 5000, windowsHide: true })
      this.pgDumpVersion = stdout.trim().replace(/^pg_dump \(PostgreSQL\)\s*/, '') || null
    } catch {
      return null
    }
    return this.pgDumpVersion
  }

  private dump(path: string) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(this.env.PG_DUMP_PATH, ['--format=custom', '--no-owner', '--no-privileges', '--file', path], {
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
        if (error.code === 'ENOENT') {
          this.logger.error(`pg_dump not found (PG_DUMP_PATH=${this.env.PG_DUMP_PATH})`)
          reject(new AppException(HttpStatus.SERVICE_UNAVAILABLE, 'system.pg_dump_missing'))
        } else {
          this.logger.error(`pg_dump could not start: ${String(error)}`)
          reject(new AppException(HttpStatus.INTERNAL_SERVER_ERROR, 'system.backup_failed'))
        }
      })
      child.once('close', (code, signal) => {
        if (code === 0) return resolve()
        this.logger.error(`pg_dump failed (${signal ?? `exit ${code}`}): ${stderr.trim()}`)
        reject(new AppException(HttpStatus.INTERNAL_SERVER_ERROR, 'system.backup_failed'))
      })
    })
  }
}

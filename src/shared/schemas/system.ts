import { z } from 'zod'

/**
 * The database backup's two file types: PostgreSQL's custom format made by pg_dump (.dump, restored
 * with pg_restore), or plain SQL the app writes itself when the server has no usable pg_dump (.sql).
 */
export const BACKUP_FORMATS = ['dump', 'sql'] as const
export type BackupFormat = (typeof BACKUP_FORMATS)[number]

/** GET /admin/system/backup: without a format, the best the server can make. */
export const backupQuerySchema = z.object({ format: z.enum(BACKUP_FORMATS).optional() })
export type BackupQuery = z.infer<typeof backupQuerySchema>

/** The largest APK the System page accepts (the website build is about 22 MB). */
export const MAX_APK_BYTES = 150 * 1024 * 1024

/**
 * PUT /admin/system/apk: the multipart text fields sent with the file. The version is what the
 * System page and /app-download show (1.0.3); blank leaves it unknown.
 */
export const apkUploadSchema = z.object({
  version: z
    .string()
    .trim()
    .max(32, { error: 'apk.version' })
    .regex(/^[0-9A-Za-z.+_-]*$/, { error: 'apk.version' })
    .optional()
    .transform(value => value || null),
})
export type ApkUploadInput = z.infer<typeof apkUploadSchema>

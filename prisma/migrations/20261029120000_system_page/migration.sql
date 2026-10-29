-- The System page (/admin/system): database backups and the app's APK, in the history log.
ALTER TYPE "AuditAction" ADD VALUE 'SYSTEM_BACKUP_DOWNLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'APK_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'APK_REMOVED';

ALTER TYPE "AuditEntity" ADD VALUE 'SYSTEM';

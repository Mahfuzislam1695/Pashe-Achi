'use client'

import { APK_DOWNLOAD_PATH, can, MAX_APK_BYTES, type MessageCode, type SystemStatusDto } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, DatabaseBackup, Download, Smartphone, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { PermissionGate } from '@/admin/components/permission-gate'
import { Badge, Button, Card, ErrorNote, Field, Input, Loading, PageHeader } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useCurrentAdmin, useSystemStatus } from '@/admin/lib/queries'
import { errorCode, fileSize } from '@/admin/lib/utils'

const majorVersion = (version: string | null) => (version ? Number.parseInt(version, 10) : Number.NaN)

/**
 * The System page: a full database backup (pg_dump) and the app's APK on /app-download. Only the Super
 * admin has the system module at first; the API checks system.backup and system.apk itself.
 */
export default function SystemPage() {
  const { t } = useLang()
  return (
    <PermissionGate permission="system.view" title={t('সিস্টেম', 'System')}>
      <System />
    </PermissionGate>
  )
}

function System() {
  const { t } = useLang()
  const status = useSystemStatus()
  return (
    <>
      <PageHeader title={t('সিস্টেম', 'System')} subtitle={t('ডেটাবেসের ব্যাকআপ আর ওয়েবসাইটের অ্যাপ (APK)।', "Database backups and the website's app (APK).")} />
      {status.data ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <BackupCard database={status.data.database} />
          <ApkCard apk={status.data.apk} />
        </div>
      ) : status.isError ? (
        <ErrorNote code={errorCode(status.error)} />
      ) : (
        <Loading />
      )}
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-medium wrap-break-word">{children}</dd>
    </>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl border border-warning/25 bg-warning-soft px-3 py-2 text-sm text-warning-ink">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function BackupCard({ database }: { database: SystemStatusDto['database'] }) {
  const { t } = useLang()
  const me = useCurrentAdmin()
  const [error, setError] = useState<MessageCode | null>(null)
  const backup = useMutation({
    mutationFn: api.system.backup,
    onMutate: () => setError(null),
    onSuccess: ({ blob, filename }) => {
      const name = filename ?? 'kingfisher-backup.dump'
      saveFile(blob, name)
      toast.success(t(`ব্যাকআপ ডাউনলোড হয়েছে: ${name}`, `Backup downloaded: ${name}`))
    },
    onError: failure => {
      setError(errorCode(failure))
      toast.error(t('ব্যাকআপ হয়নি', 'Backup failed'))
    },
  })
  const tooOld = database.pgDumpVersion !== null && majorVersion(database.pgDumpVersion) < majorVersion(database.serverVersion)

  return (
    <Card title={<span className="inline-flex items-center gap-2"><DatabaseBackup className="size-4 text-brand-600" />{t('ডেটাবেস ব্যাকআপ', 'Database backup')}</span>}>
      <div className="grid gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Row label={t('ডেটাবেস', 'Database')}>{database.name}</Row>
          <Row label={t('আকার', 'Size')}>{fileSize(database.size)}</Row>
          <Row label="PostgreSQL">{database.serverVersion}</Row>
          <Row label="pg_dump">{database.pgDumpVersion ?? <Badge tone="danger">{t('পাওয়া যায়নি', 'Not found')}</Badge>}</Row>
        </dl>

        {database.pgDumpVersion === null && (
          <Warning>
            {t(
              'সার্ভারে pg_dump নেই। PostgreSQL client tools ইনস্টল করুন (লিনাক্সে apt install postgresql-client-17), বা .env-এ PG_DUMP_PATH-এ pg_dump-এর পুরো ঠিকানা দিন।',
              "pg_dump isn't available on the server. Install the PostgreSQL client tools (on Linux: apt install postgresql-client-17), or set PG_DUMP_PATH in .env to pg_dump's full path.",
            )}
          </Warning>
        )}
        {tooOld && (
          <Warning>
            {t(
              `pg_dump ${database.pgDumpVersion} ডেটাবেসের ভার্সন ${database.serverVersion}-এর চেয়ে পুরোনো, তাই ব্যাকআপ হবে না। একই বা নতুন ভার্সনের client tools ইনস্টল করুন।`,
              `pg_dump ${database.pgDumpVersion} is older than the database (${database.serverVersion}), so it can't back it up. Install client tools of the same version or newer.`,
            )}
          </Warning>
        )}

        <p className="text-sm text-muted">
          {t(
            'পুরো ডেটাবেসের এখনকার কপি: গ্রাহক, অর্ডার, বিল, ইতিহাস, স্টাফ, সেটিংস সব। প্রেসক্রিপশন আর অফারের ছবি (uploads ফোল্ডার) এতে থাকে না। ফাইলে সব গ্রাহকের তথ্য আছে, তাই নিরাপদে রাখুন।',
            "A copy of the whole database as it is now: customers, orders, bills, history, staff and settings. Prescriptions and offer pictures (the uploads folder) aren't in it. The file holds every customer's data, so keep it safe.",
          )}
        </p>

        {can(me, 'system.backup') && (
          <div>
            <Button loading={backup.isPending} disabled={database.pgDumpVersion === null} onClick={() => backup.mutate()}>
              {!backup.isPending && <Download className="size-4" />}
              {backup.isPending ? t('ব্যাকআপ তৈরি হচ্ছে…', 'Making the backup…') : t('ব্যাকআপ ডাউনলোড', 'Download backup')}
            </Button>
          </div>
        )}
        <ErrorNote code={error} />

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-brand-700">{t('ব্যাকআপ থেকে ফিরিয়ে আনা', 'Restoring a backup')}</summary>
          <p className="mt-2 text-muted">
            {t(
              'সার্ভার বন্ধ রেখে PostgreSQL-এর pg_restore দিয়ে চালান। এটি ডেটাবেসের এখনকার সব তথ্য ব্যাকআপের তথ্য দিয়ে বদলে দেয়।',
              "Stop the server, then run PostgreSQL's pg_restore. It replaces everything in the database with the backup's data.",
            )}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-canvas px-3 py-2 text-xs text-ink">{`pg_restore --clean --if-exists --no-owner -d ${database.name} kingfisher-backup-….dump`}</pre>
        </details>
      </div>
    </Card>
  )
}

function ApkCard({ apk }: { apk: SystemStatusDto['apk'] }) {
  const { t, formatDate } = useLang()
  const me = useCurrentAdmin()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState('')
  const [error, setError] = useState<MessageCode | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.system })

  const upload = useMutation({
    mutationFn: ({ file, version }: { file: File; version: string }) => api.system.uploadApk(file, version),
    onMutate: () => setError(null),
    onSuccess: async () => {
      setFile(null)
      setVersion('')
      if (fileInput.current) fileInput.current.value = ''
      await refresh()
      toast.success(t('নতুন APK চালু হয়েছে', 'The new APK is live'))
    },
    onError: failure => setError(errorCode(failure, ['apk.required', 'apk.invalid', 'apk.too_large', 'apk.version'])),
  })
  const remove = useMutation({
    mutationFn: api.system.removeApk,
    onMutate: () => setError(null),
    onSuccess: async () => {
      await refresh()
      toast.success(t('আপলোড করা APK সরানো হয়েছে', 'The uploaded APK was removed'))
    },
    onError: failure => setError(errorCode(failure)),
  })

  const link = typeof window === 'undefined' ? APK_DOWNLOAD_PATH : new URL(APK_DOWNLOAD_PATH, window.location.origin).href
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success(t('লিংক কপি হয়েছে', 'Link copied'))
    } catch {
      toast.error(link)
    }
  }

  return (
    <Card title={<span className="inline-flex items-center gap-2"><Smartphone className="size-4 text-brand-600" />{t('অ্যাপ (APK)', 'App (APK)')}</span>}>
      <div className="grid gap-4">
        {apk ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <Row label={t('এখন চালু', 'Live now')}>
                {apk.source === 'uploaded' ? <Badge tone="brand">{t('আপলোড করা', 'Uploaded')}</Badge> : <Badge>{t('সাইটের সাথে দেওয়া', 'Bundled with the site')}</Badge>}
              </Row>
              <Row label={t('ভার্সন', 'Version')}>{apk.version ?? '—'}</Row>
              <Row label={t('আকার', 'Size')}>{fileSize(apk.size)}</Row>
              <Row label={apk.source === 'uploaded' ? t('আপলোড', 'Uploaded') : t('ফাইলের তারিখ', 'File date')}>
                {formatDate(apk.updatedAt, true)}
                {apk.uploadedBy && <span className="text-muted"> · {apk.uploadedBy}</span>}
              </Row>
            </dl>
            <div className="flex flex-wrap gap-2">
              <a
                href={apk.url}
                download="kingfisher.apk"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <Download className="size-4" />
                {t('APK ডাউনলোড', 'Download APK')}
              </a>
              <Button variant="secondary" onClick={copyLink}>
                <Copy className="size-4" />
                {t('লিংক কপি', 'Copy link')}
              </Button>
            </div>
            <p className="text-sm text-muted">
              {t('ওয়েবসাইটের /app-download পেজ এই APK-টিই দেয়।', 'The website’s /app-download page offers this APK.')} <span className="break-all">{link}</span>
            </p>
          </>
        ) : (
          <Warning>{t('এখনো কোনো APK নেই। নিচে আপলোড করুন।', 'There is no APK yet. Upload one below.')}</Warning>
        )}

        {can(me, 'system.apk') && (
          <form
            className="grid gap-3 border-t border-line pt-4"
            onSubmit={event => {
              event.preventDefault()
              if (!file) return setError('apk.required')
              if (file.size > MAX_APK_BYTES) return setError('apk.too_large')
              upload.mutate({ file, version })
            }}
          >
            <h3 className="text-sm font-semibold text-navy">{t('নতুন APK আপলোড', 'Upload a new APK')}</h3>
            <Field
              label={t('APK ফাইল', 'APK file')}
              hint={t('mobile/README.md-এর ওয়েবসাইট বিল্ড (app-release.apk), ১৫০ MB পর্যন্ত। আপলোড হলেই সবাই এটি পাবে।', 'The website build from mobile/README.md (app-release.apk), up to 150 MB. Everyone gets it as soon as it uploads.')}
            >
              <Input
                ref={fileInput}
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                className="h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-brand-700"
                onChange={event => {
                  setError(null)
                  setFile(event.target.files?.[0] ?? null)
                }}
              />
            </Field>
            <Field label={t('ভার্সন (ঐচ্ছিক)', 'Version (optional)')} hint={t('pubspec.yaml-এর version, যেমন 1.0.3', "pubspec.yaml's version, e.g. 1.0.3")}>
              <Input value={version} maxLength={32} placeholder="1.0.3" onChange={event => setVersion(event.target.value)} />
            </Field>
            <ErrorNote code={error} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={upload.isPending} disabled={!file || remove.isPending}>
                {!upload.isPending && <Upload className="size-4" />}
                {upload.isPending ? t('আপলোড হচ্ছে…', 'Uploading…') : t('আপলোড', 'Upload')}
                {file && !upload.isPending && <span className="font-normal opacity-80">({fileSize(file.size)})</span>}
              </Button>
              {apk?.source === 'uploaded' && (
                <Button
                  variant="danger"
                  loading={remove.isPending}
                  disabled={upload.isPending}
                  onClick={() => {
                    if (window.confirm(t('আপলোড করা APK সরিয়ে সাইটের সাথে দেওয়া APK-তে ফিরে যাবেন?', 'Remove the uploaded APK and go back to the one bundled with the site?'))) remove.mutate()
                  }}
                >
                  {!remove.isPending && <Trash2 className="size-4" />}
                  {t('আপলোড সরান', 'Remove upload')}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </Card>
  )
}

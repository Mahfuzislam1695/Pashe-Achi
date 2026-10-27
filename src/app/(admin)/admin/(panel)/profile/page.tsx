'use client'

import { changePasswordSchema, type MessageCode, PERMISSION_LABELS, PERMISSION_MODULE_IDS, PERMISSION_MODULE_LABELS, permissionModule, validateForm } from '@/shared'
import { useMutation } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { useCurrentAdmin } from '@/admin/lib/queries'
import { errorCode } from '@/admin/lib/utils'

export default function ProfilePage() {
  const { t, text, formatDate } = useLang()
  const admin = useCurrentAdmin()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' })
  const [error, setError] = useState<MessageCode | null>(null)
  const change = useMutation({
    mutationFn: api.auth.changePassword,
    // A new password ends every session, including this one.
    onSuccess: () => window.location.assign('/admin/login'),
    onError: failure => setError(errorCode(failure)),
  })

  return (
    <>
      <PageHeader title={t('প্রোফাইল', 'Profile')} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={t('অ্যাকাউন্ট', 'Account')}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted">{t('নাম', 'Name')}</dt>
            <dd className="font-medium">{admin.name}</dd>
            <dt className="text-muted">{t('মোবাইল', 'Mobile')}</dt>
            <dd className="font-medium tabular-nums">{admin.mobile}</dd>
            <dt className="text-muted">{t('রোল', 'Role')}</dt>
            <dd className="font-medium">{text(admin.role.name)}</dd>
            <dt className="text-muted">{t('যোগ দিয়েছেন', 'Since')}</dt>
            <dd className="font-medium">{formatDate(admin.createdAt)}</dd>
          </dl>
        </Card>
        <Card title={t('পাসওয়ার্ড বদলান', 'Change password')}>
          <form
            className="grid gap-3"
            onSubmit={event => {
              event.preventDefault()
              const check = validateForm(changePasswordSchema, form, ['password.wrong', 'password.short'])
              if (!check.success) return setError(check.code)
              setError(null)
              change.mutate(check.data)
            }}
          >
            <Field label={t('বর্তমান পাসওয়ার্ড', 'Current password')}>
              <Input type="password" autoComplete="current-password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} />
            </Field>
            <Field label={t('নতুন পাসওয়ার্ড', 'New password')} hint={t('বদলালে সব ডিভাইস থেকে লগআউট হবে।', 'Changing it signs you out on every device.')}>
              <Input type="password" autoComplete="new-password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
            </Field>
            <ErrorNote code={error} />
            <div>
              <Button type="submit" loading={change.isPending}>
                <KeyRound className="size-4" />
                {t('পাসওয়ার্ড বদলান', 'Change password')}
              </Button>
            </div>
          </form>
        </Card>
        <MyPermissions />
      </div>
    </>
  )
}

/** What the signed-in admin's role lets them do, module by module. */
function MyPermissions() {
  const { t, text } = useLang()
  const admin = useCurrentAdmin()
  const modules = PERMISSION_MODULE_IDS.map(module => ({ module, permissions: admin.permissions.filter(permission => permissionModule(permission) === module) })).filter(
    entry => entry.permissions.length > 0,
  )
  return (
    <Card title={t('আপনি যা করতে পারেন', 'What you can do')} className="lg:col-span-2">
      {admin.role.isSystem && <p className="mb-3 text-sm text-muted">{t('সুপার অ্যাডমিনের সব অনুমতি আছে, রোল ও অনুমতিও তিনিই ঠিক করেন।', 'A Super admin has every permission and decides the roles and their permissions.')}</p>}
      {modules.length === 0 && <p className="text-sm text-muted">{t('আপনার রোলে এখনো কোনো অনুমতি নেই।', 'Your role has no permissions yet.')}</p>}
      <dl className="grid gap-3 sm:grid-cols-2">
        {modules.map(({ module, permissions }) => (
          <div key={module} className="grid gap-1.5">
            <dt className="text-xs font-semibold text-muted">{text(PERMISSION_MODULE_LABELS[module])}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {permissions.map(permission => (
                <Badge key={permission} tone="brand">
                  {text(PERMISSION_LABELS[permission].label)}
                </Badge>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

'use client'

import { ADMIN_ROLE_LABELS, changePasswordSchema, type MessageCode, validateForm } from '@/shared'
import { useMutation } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'

import { Button, Card, ErrorNote, Field, Input, PageHeader } from '@/admin/components/ui'
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
            <dd className="font-medium">{text(ADMIN_ROLE_LABELS[admin.role])}</dd>
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
      </div>
    </>
  )
}

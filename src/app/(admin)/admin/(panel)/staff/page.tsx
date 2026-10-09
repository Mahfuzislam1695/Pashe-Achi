'use client'

import { ADMIN_ROLE_LABELS, ADMIN_ROLES, type AdminDto, type AdminRole, createAdminSchema, FORM_ERROR_PRIORITY, type MessageCode, validateForm } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHeader, Select, Table, Td, Th } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useCurrentAdmin, useStaff } from '@/admin/lib/queries'
import { errorCode, isSuperAdmin } from '@/admin/lib/utils'

export default function StaffPage() {
  const { t } = useLang()
  const me = useCurrentAdmin()
  if (!isSuperAdmin(me.role)) {
    return (
      <>
        <PageHeader title={t('স্টাফ', 'Staff')} />
        <ErrorNote code="forbidden" />
      </>
    )
  }
  return (
    <>
      <PageHeader
        title={t('স্টাফ', 'Staff')}
        subtitle={t('অপারেটর অর্ডার সামলায়; ম্যানেজার দাম, গ্রাহক ও ঘোষণাও সামলায়।', 'Operators handle orders; managers also handle pricing, customers and announcements.')}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <StaffList myId={me.id} />
        <AddStaff />
      </div>
    </>
  )
}

function StaffList({ myId }: { myId: string }) {
  const { t, text, formatDate } = useLang()
  const queryClient = useQueryClient()
  const staff = useStaff()
  const update = useMutation({
    mutationFn: (input: { id: string; body: { role?: AdminRole; isActive?: boolean; password?: string } }) => api.staff.update(input.id, input.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff })
      toast.success(t('সেভ হয়েছে', 'Saved'))
    },
  })
  const resetPassword = (admin: AdminDto) => {
    const password = window.prompt(t(`${admin.name}-এর নতুন পাসওয়ার্ড (অন্তত ৬ অক্ষর)`, `New password for ${admin.name} (at least 6 characters)`))
    if (!password) return
    if (password.length < 6) return toast.error(t('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।', 'Password must be at least 6 characters.'))
    update.mutate({ id: admin.id, body: { password } })
  }

  return (
    <Card title={t('অ্যাডমিন অ্যাকাউন্ট', 'Admin accounts')}>
      {staff.isPending && <Loading />}
      <ErrorNote code={staff.isError ? errorCode(staff.error) : update.isError ? errorCode(update.error) : null} />
      {staff.isSuccess && !staff.data.length && <Empty>{t('কেউ নেই।', 'Nobody yet.')}</Empty>}
      {staff.data && staff.data.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>{t('নাম', 'Name')}</Th>
              <Th>{t('রোল', 'Role')}</Th>
              <Th>{t('অবস্থা', 'Status')}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {staff.data.map(admin => {
              const self = admin.id === myId
              return (
                <tr key={admin.id}>
                  <Td>
                    <div className="font-medium">
                      {admin.name} {self && <Badge tone="brand">{t('আপনি', 'You')}</Badge>}
                    </div>
                    <div className="text-xs text-muted tabular-nums">
                      {admin.mobile} · {formatDate(admin.createdAt)}
                    </div>
                  </Td>
                  <Td>
                    <Select
                      aria-label={t('রোল', 'Role')}
                      className="h-8 w-40"
                      value={admin.role}
                      disabled={self || update.isPending}
                      onChange={e => update.mutate({ id: admin.id, body: { role: e.target.value as AdminRole } })}
                    >
                      {ADMIN_ROLES.map(role => (
                        <option key={role} value={role}>
                          {text(ADMIN_ROLE_LABELS[role])}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={admin.isActive}
                        disabled={self || update.isPending}
                        onChange={e => update.mutate({ id: admin.id, body: { isActive: e.target.checked } })}
                      />
                      {admin.isActive ? t('চালু', 'Active') : t('বন্ধ', 'Disabled')}
                    </label>
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => resetPassword(admin)}>
                      <KeyRound className="size-4" />
                      {t('পাসওয়ার্ড', 'Password')}
                    </Button>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

const EMPTY = { name: '', mobile: '', password: '', role: 'OPERATOR' as AdminRole }

function AddStaff() {
  const { t, text } = useLang()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<MessageCode | null>(null)
  const create = useMutation({
    mutationFn: api.staff.create,
    onSuccess: admin => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff })
      setForm(EMPTY)
      toast.success(t(`${admin.name} যোগ হয়েছেন`, `${admin.name} added`))
    },
    onError: failure => setError(errorCode(failure)),
  })
  return (
    <Card title={t('নতুন স্টাফ', 'Add staff')}>
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault()
          const check = validateForm(createAdminSchema, form, ['field.required', ...FORM_ERROR_PRIORITY.signup])
          if (!check.success) return setError(check.code)
          setError(null)
          create.mutate(check.data)
        }}
      >
        <Field label={t('নাম', 'Name')}>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="off" />
        </Field>
        <Field label={t('মোবাইল নম্বর', 'Mobile number')}>
          <Input type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} autoComplete="off" />
        </Field>
        <Field label={t('পাসওয়ার্ড', 'Password')} hint={t('অন্তত ৬ অক্ষর', 'At least 6 characters')}>
          <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
        </Field>
        <Field label={t('রোল', 'Role')}>
          <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as AdminRole })}>
            {ADMIN_ROLES.map(role => (
              <option key={role} value={role}>
                {text(ADMIN_ROLE_LABELS[role])}
              </option>
            ))}
          </Select>
        </Field>
        <ErrorNote code={error} />
        <div>
          <Button type="submit" loading={create.isPending}>
            <UserPlus className="size-4" />
            {t('যোগ করুন', 'Add')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

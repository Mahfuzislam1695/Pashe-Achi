'use client'

import { type AdminDto, can, createAdminSchema, FORM_ERROR_PRIORITY, type MessageCode, type RoleDto, SYSTEM_ROLE_KEYS, validateForm } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { History, KeyRound, ShieldCheck, UserCheck, UserCog, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'

import { StatGrid, StatTile } from '@/admin/components/charts'
import { ClearFilters, SearchBox } from '@/admin/components/filters'
import { Pagination } from '@/admin/components/pagination'
import { PermissionGate } from '@/admin/components/permission-gate'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHeader, Select, Table, Td, Th } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useCurrentAdmin, useRoles, useStaff, useStaffStats } from '@/admin/lib/queries'
import { pick, useUrlFilters } from '@/admin/lib/url-state'
import { errorCode, isSystemRole } from '@/admin/lib/utils'

export default function StaffPage() {
  const { t } = useLang()
  return (
    <PermissionGate permission="staff.view" title={t('স্টাফ', 'Staff')}>
      <Staff />
    </PermissionGate>
  )
}

function Staff() {
  const { t } = useLang()
  const me = useCurrentAdmin()
  return (
    <>
      <PageHeader
        title={t('স্টাফ', 'Staff')}
        subtitle={t('প্রত্যেক স্টাফের একটি রোল; রোল ঠিক করে কে কী করতে পারবেন।', 'Each staff member has one role; the role decides what they can do.')}
        actions={
          isSystemRole(me) ? (
            <Link href="/admin/roles" className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-ink hover:border-brand-200 hover:text-brand-700">
              <UserCog className="size-4" />
              {t('রোল ও অনুমতি', 'Roles & permissions')}
            </Link>
          ) : null
        }
      />
      <StaffStats />
      <div className={can(me, 'staff.create') ? 'grid grid-cols-1 items-start gap-5 lg:grid-cols-[2fr_1fr]' : 'grid grid-cols-1 gap-5'}>
        <Suspense fallback={<Loading />}>
          <StaffList />
        </Suspense>
        {can(me, 'staff.create') && <AddStaff />}
      </div>
    </>
  )
}

/** The roles this admin may hand out: every one, except Super admin unless they hold it. */
function useAssignableRoles(): RoleDto[] {
  const me = useCurrentAdmin()
  const roles = useRoles().data ?? []
  return roles.filter(role => !role.isSystem || me.role.isSystem)
}

function StaffStats() {
  const { t, text, digits } = useLang()
  const stats = useStaffStats()
  if (!stats.data) return null
  return (
    <StatGrid columns={Math.min(6, 2 + stats.data.byRole.length) as 4 | 5 | 6} className="mb-5">
      <StatTile icon={Users} label={t('মোট অ্যাকাউন্ট', 'Accounts')} value={digits(stats.data.total)} />
      <StatTile
        icon={UserCheck}
        tone="success"
        label={t('চালু', 'Active')}
        value={digits(stats.data.active)}
        hint={t(`বন্ধ: ${digits(stats.data.total - stats.data.active)}`, `Disabled: ${digits(stats.data.total - stats.data.active)}`)}
      />
      {stats.data.byRole.map(role => (
        <StatTile key={role.id} icon={role.isSystem ? ShieldCheck : UserCog} tone="violet" label={text(role.name)} value={digits(role.count)} href={`/admin/staff?roleId=${encodeURIComponent(role.id)}`} />
      ))}
    </StatGrid>
  )
}

/** Search, role and status filters and the page live in the URL. */
function StaffList() {
  const { t, text, formatDate } = useLang()
  const me = useCurrentAdmin()
  const queryClient = useQueryClient()
  const url = useUrlFilters()
  const roles = useRoles().data ?? []
  const assignable = useAssignableRoles()
  const filters = { q: url.get('q'), roleId: url.get('roleId'), active: pick(url.get('active'), ['true', 'false'] as const) }
  const staff = useStaff({ ...filters, page: url.page, limit: url.limit })
  const items = staff.data?.items ?? []
  const hasFilters = Object.values(filters).some(Boolean)
  const canEdit = can(me, 'staff.edit')
  const canReset = can(me, 'staff.reset_password')
  const update = useMutation({
    mutationFn: (input: { id: string; body: { roleId?: string; isActive?: boolean; password?: string } }) => api.staff.update(input.id, input.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles })
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
      <div className="mb-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <SearchBox value={filters.q} onSearch={q => url.set({ q })} placeholder={t('নাম বা মোবাইল', 'Name or mobile')} />
        <Select aria-label={t('রোল', 'Role')} value={filters.roleId ?? ''} onChange={e => url.set({ roleId: e.target.value || undefined })}>
          <option value="">{t('সব রোল', 'All roles')}</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {text(role.name)}
            </option>
          ))}
        </Select>
        <Select aria-label={t('অবস্থা', 'Status')} value={filters.active ?? ''} onChange={e => url.set({ active: e.target.value || undefined })}>
          <option value="">{t('সব অবস্থা', 'All statuses')}</option>
          <option value="true">{t('চালু', 'Active')}</option>
          <option value="false">{t('বন্ধ', 'Disabled')}</option>
        </Select>
        <ClearFilters disabled={!hasFilters} onClear={() => url.clear()} />
      </div>
      {staff.isPending && <Loading />}
      <ErrorNote code={staff.isError ? errorCode(staff.error) : update.isError ? errorCode(update.error) : null} />
      {staff.isSuccess && !items.length && <Empty>{hasFilters ? t('এই ফিল্টারে কেউ নেই।', 'Nobody matches these filters.') : t('কেউ নেই।', 'Nobody yet.')}</Empty>}
      {items.length > 0 && (
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
            {items.map(admin => {
              const self = admin.id === me.id
              // A Super admin's account is changed only by a Super admin.
              const locked = self || (admin.role.isSystem && !me.role.isSystem)
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
                    {canEdit && !locked ? (
                      <Select
                        aria-label={t('রোল', 'Role')}
                        className="h-8 w-44"
                        value={admin.role.id}
                        disabled={update.isPending}
                        onChange={e => update.mutate({ id: admin.id, body: { roleId: e.target.value } })}
                      >
                        {/* The current role stays listed even when it isn't one this admin may give. */}
                        {[...assignable, ...(assignable.some(role => role.id === admin.role.id) ? [] : [admin.role])].map(role => (
                          <option key={role.id} value={role.id}>
                            {text(role.name)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone={admin.role.isSystem ? 'brand' : 'neutral'}>{text(admin.role.name)}</Badge>
                    )}
                  </Td>
                  <Td>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={admin.isActive}
                        disabled={!canEdit || locked || update.isPending}
                        onChange={e => update.mutate({ id: admin.id, body: { isActive: e.target.checked } })}
                      />
                      {admin.isActive ? t('চালু', 'Active') : t('বন্ধ', 'Disabled')}
                    </label>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {can(me, 'history.view') && (
                      <Link
                        href={`/admin/history?adminId=${encodeURIComponent(admin.id)}`}
                        className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted transition-colors hover:bg-canvas hover:text-brand-700"
                      >
                        <History className="size-4" />
                        {t('কাজের ইতিহাস', 'Activity')}
                      </Link>
                    )}
                    {canReset && !(admin.role.isSystem && !me.role.isSystem) && (
                      <Button size="sm" variant="ghost" onClick={() => resetPassword(admin)}>
                        <KeyRound className="size-4" />
                        {t('পাসওয়ার্ড', 'Password')}
                      </Button>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
      {staff.data && (
        <Pagination
          page={staff.data.page}
          pageCount={staff.data.pageCount}
          total={staff.data.total}
          limit={staff.data.limit}
          fetching={staff.isPlaceholderData}
          onPage={page => url.set({ page })}
          onLimit={limit => url.set({ limit })}
        />
      )}
    </Card>
  )
}

const EMPTY = { name: '', mobile: '', password: '', roleId: '' }

function AddStaff() {
  const { t, text } = useLang()
  const queryClient = useQueryClient()
  const roles = useAssignableRoles()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<MessageCode | null>(null)
  // Until a role is picked: Operator, the narrowest built-in role, or else the first that isn't Super admin.
  const roleId = form.roleId || (roles.find(role => role.key === SYSTEM_ROLE_KEYS.operator) ?? roles.find(role => !role.isSystem) ?? roles[0])?.id || ''
  const create = useMutation({
    mutationFn: api.staff.create,
    onSuccess: admin => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles })
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
          const check = validateForm(createAdminSchema, { ...form, roleId }, ['field.required', ...FORM_ERROR_PRIORITY.signup])
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
          <Select value={roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}>
            {roles.map(role => (
              <option key={role.id} value={role.id}>
                {text(role.name)}
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

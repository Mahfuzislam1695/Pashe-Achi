'use client'

import {
  type AdminDto,
  ALL_PERMISSIONS,
  can,
  FORM_ERROR_PRIORITY,
  type MessageCode,
  normalizePermissions,
  type Permission,
  PERMISSION_LABELS,
  PERMISSION_MODULE_IDS,
  PERMISSION_MODULE_LABELS,
  PERMISSION_MODULES,
  type PermissionModule,
  type RoleDto,
  roleSchema,
  validateForm,
} from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, Plus, Save, ShieldCheck, Trash2, UserCog, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

import { PermissionGate } from '@/admin/components/permission-gate'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHeader } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useCurrentAdmin, useRoles } from '@/admin/lib/queries'
import { cn, errorCode } from '@/admin/lib/utils'

/**
 * Roles and what each may do, module by module, for staff holding roles.* (the Super admin always).
 * The API enforces the same rules this page follows: nobody but the Super admin changes their own
 * role, and staff give or take away only permissions they hold themselves.
 */
export default function RolesPage() {
  const { t } = useLang()
  return (
    <PermissionGate permission="roles.view" title={t('রোল ও অনুমতি', 'Roles & permissions')}>
      <Roles />
    </PermissionGate>
  )
}

function Roles() {
  const { t } = useLang()
  const me = useCurrentAdmin()
  const [editing, setEditing] = useState<RoleDto | 'new' | null>(null)
  return (
    <>
      <PageHeader
        title={t('রোল ও অনুমতি', 'Roles & permissions')}
        subtitle={t(
          'প্রত্যেক রোলে কোন মডিউলে কী করা যাবে তা ঠিক করুন। বদল সাথে সাথে সেই রোলের সব স্টাফের ওপর খাটে।',
          'Choose what each role can do in each module. Changes apply at once to every staff member with that role.',
        )}
        actions={
          editing === null && can(me, 'roles.create') ? (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" />
              {t('নতুন রোল', 'New role')}
            </Button>
          ) : null
        }
      />
      <div className={cn('grid grid-cols-1 items-start gap-5', editing && 'xl:grid-cols-[2fr_3fr]')}>
        <RoleList onEdit={setEditing} editingId={editing === null || editing === 'new' ? null : editing.id} />
        {editing && <RoleEditor key={editing === 'new' ? 'new' : editing.id} role={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </div>
    </>
  )
}

/** Whether `me` may change `role`: never the Super admin role, never their own, and only with roles.edit. */
const canChange = (me: AdminDto, role: RoleDto) => !role.isSystem && role.id !== me.role.id && can(me, 'roles.edit')

function RoleList({ onEdit, editingId }: { onEdit: (role: RoleDto) => void; editingId: string | null }) {
  const { t, text, digits } = useLang()
  const me = useCurrentAdmin()
  const queryClient = useQueryClient()
  const roles = useRoles()
  const remove = useMutation({
    mutationFn: api.roles.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles })
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff })
      toast.success(t('রোল মুছে ফেলা হয়েছে', 'Role deleted'))
    },
  })
  return (
    <Card title={t('সব রোল', 'All roles')}>
      {roles.isPending && <Loading />}
      <ErrorNote code={roles.isError ? errorCode(roles.error) : remove.isError ? errorCode(remove.error) : null} />
      {roles.isSuccess && !roles.data.length && <Empty>{t('এখনো কোনো রোল নেই।', 'No roles yet.')}</Empty>}
      <ul className="grid gap-3">
        {roles.data?.map(role => (
          <li key={role.id} className={cn('grid gap-2 rounded-xl border p-3', role.id === editingId ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line')}>
            <div className="flex flex-wrap items-center gap-2">
              {role.isSystem ? <ShieldCheck className="size-4 text-brand-600" /> : <UserCog className="size-4 text-muted" />}
              <span className="font-semibold">{text(role.name)}</span>
              {role.isSystem && <Badge tone="brand">{t('সব অনুমতি', 'Every permission')}</Badge>}
              {role.id === me.role.id && <Badge>{t('আপনার রোল', 'Your role')}</Badge>}
            </div>
            {role.description && <p className="text-sm text-muted">{text(role.description)}</p>}
            <p className="flex flex-wrap gap-x-3 text-xs text-muted">
              <span>{role.isSystem ? t('সব অনুমতি, সবসময়', 'Every permission, always') : t(`${digits(role.permissions.length)}/${digits(ALL_PERMISSIONS.length)} অনুমতি`, `${role.permissions.length} of ${ALL_PERMISSIONS.length} permissions`)}</span>
              <Link href={`/admin/staff?roleId=${encodeURIComponent(role.id)}`} className="font-semibold text-brand-700 hover:underline">
                {t(`${digits(role.staffCount)} জন স্টাফ`, `${role.staffCount} staff`)}
              </Link>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => onEdit(role)}>
                {canChange(me, role) ? <Pencil className="size-3.5" /> : <Lock className="size-3.5" />}
                {canChange(me, role) ? t('এডিট', 'Edit') : t('দেখুন', 'View')}
              </Button>
              {!role.isSystem && can(me, 'roles.delete') && (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={role.staffCount > 0}
                  title={role.staffCount > 0 ? t('এই রোলে স্টাফ আছেন; আগে তাঁদের অন্য রোল দিন।', 'Staff hold this role; give them another role first.') : undefined}
                  loading={remove.isPending && remove.variables === role.id}
                  onClick={() => {
                    if (window.confirm(t(`"${role.name.bn}" রোলটি মুছে ফেলবেন?`, `Delete the "${role.name.en}" role?`))) remove.mutate(role.id)
                  }}
                >
                  <Trash2 className="size-3.5" />
                  {t('মুছুন', 'Delete')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

type Draft = { nameBn: string; nameEn: string; descriptionBn: string; descriptionEn: string; permissions: Permission[] }

const draftOf = (role: RoleDto | null): Draft => ({
  nameBn: role?.name.bn ?? '',
  nameEn: role?.name.en ?? '',
  descriptionBn: role?.description?.bn ?? '',
  descriptionEn: role?.description?.en ?? '',
  permissions: role ? [...role.permissions] : [],
})

const modulePermissions = (module: PermissionModule) => PERMISSION_MODULES[module].map(action => `${module}.${action}` as Permission)

/**
 * Names, descriptions and the permission matrix. The system role is shown read-only with every box
 * ticked, and so is any role `me` may not change. Boxes for permissions `me` doesn't hold stay as they are.
 */
function RoleEditor({ role, onDone }: { role: RoleDto | null; onDone: () => void }) {
  const { t, text, digits } = useLang()
  const me = useCurrentAdmin()
  const queryClient = useQueryClient()
  const locked = role?.isSystem ?? false
  const readOnly = role ? !canChange(me, role) : !can(me, 'roles.create')
  const [draft, setDraft] = useState<Draft>(() => (locked ? { ...draftOf(role), permissions: [...ALL_PERMISSIONS] } : draftOf(role)))
  const [error, setError] = useState<MessageCode | null>(null)
  const chosen = new Set(draft.permissions)
  const changeable = (permission: Permission) => !readOnly && can(me, permission)

  const edit = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
    setError(null)
  }
  // Any action brings its module's view along; taking view away clears what `me` may clear of the
  // module (view stays while the role keeps an action `me` can't take away).
  const toggle = (permission: Permission, on: boolean) => {
    const [module, action] = permission.split('.') as [PermissionModule, string]
    const next = on
      ? [...draft.permissions, permission]
      : action === 'view'
        ? draft.permissions.filter(entry => !(entry.startsWith(`${module}.`) && changeable(entry)))
        : draft.permissions.filter(entry => entry !== permission)
    edit('permissions', normalizePermissions(next))
  }
  const toggleModule = (module: PermissionModule, on: boolean) => {
    const own = modulePermissions(module).filter(changeable)
    edit('permissions', normalizePermissions(on ? [...draft.permissions, ...own] : draft.permissions.filter(entry => !own.includes(entry))))
  }

  const save = useMutation({
    mutationFn: async () => {
      const check = validateForm(roleSchema, draft, ['field.required', ...FORM_ERROR_PRIORITY.signup])
      if (!check.success) throw check.code
      return role ? api.roles.update(role.id, check.data) : api.roles.create(check.data)
    },
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles })
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff })
      // The signed-in admin's own role may be the one that changed.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
      toast.success(role ? t('রোল আপডেট হয়েছে', 'Role updated') : t('রোল যোগ হয়েছে', 'Role added'), {
        description: role && saved.staffCount ? t(`${digits(saved.staffCount)} জন স্টাফ এখনই নতুন অনুমতি পাবেন।`, `${saved.staffCount} staff get the new permissions right away.`) : undefined,
      })
      onDone()
    },
    onError: failure => setError(errorCode(failure)),
  })

  return (
    <Card
      title={readOnly && role ? text(role.name) : role ? t('রোল এডিট', 'Edit role') : t('নতুন রোল', 'New role')}
      actions={
        <Button variant="ghost" size="sm" onClick={onDone}>
          <X className="size-4" />
          {t('বন্ধ', 'Close')}
        </Button>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={event => {
          event.preventDefault()
          if (!readOnly) save.mutate()
        }}
      >
        {readOnly ? (
          <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            <Lock className="mt-0.5 size-4 shrink-0" />
            {locked
              ? t('সুপার অ্যাডমিনের সবসময় সব অনুমতি থাকে, ভবিষ্যতে যোগ হওয়া অনুমতিও। এই রোল বদলানো বা মুছে ফেলা যায় না।', 'A Super admin always has every permission, including ones added later. This role cannot be changed or deleted.')
              : role?.id === me.role.id
                ? t('এটি আপনার নিজের রোল; এটি বদলাতে পারেন অন্য কেউ, যাঁর রোল এডিটের অনুমতি আছে।', 'This is your own role. Another admin who can edit roles must change it.')
                : t('রোল শুধু দেখতে পারবেন; বদলাতে "রোল ও অনুমতি: এডিট" অনুমতি লাগবে।', 'You can only view roles. Changing them needs Roles & permissions: Edit.')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('নাম (বাংলা) *', 'Name (Bangla) *')}>
              <Input value={draft.nameBn} maxLength={60} onChange={e => edit('nameBn', e.target.value)} placeholder="যেমন: রাইডার ডেস্ক" />
            </Field>
            <Field label={t('নাম (ইংরেজি) *', 'Name (English) *')}>
              <Input value={draft.nameEn} maxLength={60} onChange={e => edit('nameEn', e.target.value)} placeholder="e.g. Rider desk" />
            </Field>
            <Field label={t('বিবরণ (বাংলা)', 'Description (Bangla)')}>
              <Input value={draft.descriptionBn} maxLength={200} onChange={e => edit('descriptionBn', e.target.value)} />
            </Field>
            <Field label={t('বিবরণ (ইংরেজি)', 'Description (English)')}>
              <Input value={draft.descriptionEn} maxLength={200} onChange={e => edit('descriptionEn', e.target.value)} />
            </Field>
          </div>
        )}

        <div className="grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-navy">{t('অনুমতি', 'Permissions')}</span>
            <span className="text-xs text-muted tabular-nums">
              {t(`${digits(draft.permissions.length)}/${digits(ALL_PERMISSIONS.length)} অনুমতি`, `${draft.permissions.length} of ${ALL_PERMISSIONS.length} permissions`)}
            </span>
          </div>
          <ul className="grid divide-y divide-line rounded-xl border border-line">
            {PERMISSION_MODULE_IDS.map(module => {
              const own = modulePermissions(module)
              const count = own.filter(permission => chosen.has(permission)).length
              return (
                <li key={module} className="grid gap-2 p-3 sm:grid-cols-[11rem_1fr] sm:items-start">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={count === own.length}
                      ref={input => {
                        if (input) input.indeterminate = count > 0 && count < own.length
                      }}
                      disabled={!own.some(changeable)}
                      onChange={e => toggleModule(module, e.target.checked)}
                      aria-label={t(`${text(PERMISSION_MODULE_LABELS[module])}: সব`, `${text(PERMISSION_MODULE_LABELS[module])}: all`)}
                    />
                    {text(PERMISSION_MODULE_LABELS[module])}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {own.map(permission => (
                      <label
                        key={permission}
                        title={!readOnly && !changeable(permission) ? t('আপনার এই অনুমতি নেই, তাই বদলাতে পারবেন না।', "You don't hold this permission, so you can't change it.") : text(PERMISSION_LABELS[permission].hint)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm',
                          chosen.has(permission) ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-line text-ink',
                          changeable(permission) ? 'cursor-pointer hover:border-brand-200' : !readOnly && 'opacity-60',
                        )}
                      >
                        <input type="checkbox" className="size-4 accent-brand-600" checked={chosen.has(permission)} disabled={!changeable(permission)} onChange={e => toggle(permission, e.target.checked)} />
                        <span className="grid leading-tight">
                          <span className="font-medium">{text(PERMISSION_LABELS[permission].label)}</span>
                          <span className="text-xs text-muted">{text(PERMISSION_LABELS[permission].hint)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
          {!readOnly && (
            <p className="text-xs text-muted">
              {t('কোনো কাজের অনুমতি দিলে সেই মডিউল দেখার অনুমতিও যোগ হয়।', "Giving any action also gives that module's View.")}
              {!me.role.isSystem && t(' নিজের যে অনুমতি আছে শুধু সেগুলোই দিতে বা সরাতে পারবেন।', ' You can give or take away only permissions you hold yourself.')}
            </p>
          )}
        </div>

        <ErrorNote code={error} />
        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              <Save className="size-4" />
              {t('সেভ করুন', 'Save')}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

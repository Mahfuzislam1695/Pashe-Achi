'use client'

import { can, type Permission } from '@/shared'

import { useCurrentAdmin } from '@/admin/lib/queries'
import { ErrorNote, PageHeader } from './ui'

/**
 * A page for roles with `permission` (a module's view). Others get its title and "not allowed";
 * the API refuses them anyway, so this only spares them a page of errors.
 */
export function PermissionGate({ permission, title, children }: { permission: Permission; title: string; children: React.ReactNode }) {
  const admin = useCurrentAdmin()
  if (can(admin, permission)) return children
  return (
    <>
      <PageHeader title={title} />
      <ErrorNote code="forbidden" />
    </>
  )
}


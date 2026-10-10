import type { AuditChange, AuditValue } from '@/shared'

/**
 * The fields whose value differs between `before` and `after`, as history log changes.
 * A field missing (undefined) from `after` was not part of the update and counts as unchanged.
 */
export function diffChanges<T extends object>(before: NoInfer<T> | null, after: Partial<T>, fields: readonly (keyof T & string)[]): AuditChange[] {
  const changes: AuditChange[] = []
  for (const field of fields) {
    const to = after[field]
    if (to === undefined) continue
    const from = before ? before[field] : null
    if (from === to) continue
    changes.push({ field, from: (from ?? null) as AuditValue, to: (to ?? null) as AuditValue })
  }
  return changes
}

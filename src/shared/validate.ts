import type { z } from 'zod'

import { type MessageCode, pickIssueCode } from './messages'

export type FormCheck<T> = { success: true; data: T } | { success: false; code: MessageCode }

/**
 * Validates a form payload with the same schema the API uses and reduces any problems to the
 * single message the screen should show, in the form's priority order.
 */
export function validateForm<TSchema extends z.ZodType>(schema: TSchema, payload: unknown, priority: readonly MessageCode[]): FormCheck<z.output<TSchema>> {
  const result = schema.safeParse(payload)
  if (result.success) return { success: true, data: result.data }
  return { success: false, code: pickIssueCode(result.error.issues.map(issue => issue.message), priority) }
}

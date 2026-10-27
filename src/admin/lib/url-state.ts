'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Keeps only values from `allowed`, so a hand-edited URL never reaches the API as a bad filter. */
export const pick = <T extends string>(value: string | null | undefined, allowed: readonly T[]) => (value && allowed.includes(value as T) ? (value as T) : undefined)

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
/** A YYYY-MM-DD day from the URL, or undefined. */
export const pickDay = (value: string | null | undefined) => (value && ISO_DAY.test(value) ? value : undefined)

export const PAGE_SIZES = [10, 25, 50, 100] as const

/**
 * Filters, page and page size kept in the URL query, so a filtered page survives a refresh and can
 * be bookmarked or shared. Changing a filter or the page size goes back to page 1. Call below a
 * <Suspense> (useSearchParams).
 */
export function useUrlFilters(defaultLimit = 25) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const set = useCallback(
    (changes: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
      }
      // A new filter or page size starts again from the first page.
      if (!('page' in changes)) next.delete('page')
      if (next.get('page') === '1') next.delete('page')
      if (next.get('limit') === String(defaultLimit)) next.delete('limit')
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false })
    },
    [params, pathname, router, defaultLimit],
  )

  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const limitParam = Number(params.get('limit'))
  const limit = (PAGE_SIZES as readonly number[]).includes(limitParam) ? limitParam : defaultLimit

  return {
    params,
    get: (key: string) => params.get(key) || undefined,
    page,
    limit,
    set,
    /** Drops every filter except the `keep` keys (and the page size). */
    clear: (keep: string[] = []) => {
      const next = new URLSearchParams()
      for (const key of [...keep, 'limit']) {
        const value = params.get(key)
        if (value) next.set(key, value)
      }
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false })
    },
  }
}

/**
 * The text of a search box that writes to `value` 350 ms after typing stops, without a request per
 * keystroke. A change from outside (Clear, back button) replaces the text.
 */
export function useDebouncedSearch(value: string | undefined, onSearch: (value: string | undefined) => void) {
  const [text, setText] = useState(value ?? '')
  // What this box last sent: when the URL catches up with it, the text (maybe typed further) stays.
  const sent = useRef(value)
  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value
      setText(value ?? '')
    }
  }, [value])
  // Only the typed text restarts the timer (onSearch changes with every URL change).
  useEffect(() => {
    const trimmed = text.trim() || undefined
    if (trimmed === value) return
    const timer = setTimeout(() => {
      sent.current = trimmed
      onSearch(trimmed)
    }, 350)
    return () => clearTimeout(timer)
  }, [text])
  return [text, setText] as const
}

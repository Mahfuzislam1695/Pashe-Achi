'use client'

import { createContext, type Dispatch, type SetStateAction, useContext, useEffect, useState } from 'react'

const DraftsContext = createContext<Map<string, unknown> | null>(null)

/**
 * Holds unfinished form input for the signed-in session. It lives in the (main) layout, which
 * stays mounted while the customer switches between services, so a half-filled bazar list is
 * still there after a look at the medicine screen.
 */
export function DraftsProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => new Map<string, unknown>())
  return <DraftsContext.Provider value={store}>{children}</DraftsContext.Provider>
}

const PENDING_BAZAR_ITEMS = 'bazar:pending'

/** Queues an item (a Home category or search) for the bazar form, which adds it as a row when it opens. */
export function useAddToBazar(): (name: string) => void {
  const store = useContext(DraftsContext)
  return name => store?.set(PENDING_BAZAR_ITEMS, [...((store.get(PENDING_BAZAR_ITEMS) as string[] | undefined) ?? []), name])
}

/** Hands the queued bazar items over once and empties the queue. */
export function useTakeBazarItems(): () => string[] {
  const store = useContext(DraftsContext)
  return () => {
    const items = (store?.get(PENDING_BAZAR_ITEMS) as string[] | undefined) ?? []
    store?.delete(PENDING_BAZAR_ITEMS)
    return items
  }
}

/** Like useState, but the value survives navigating away and back. */
export function useDraft<T>(key: string, initial: () => T): [T, Dispatch<SetStateAction<T>>] {
  const store = useContext(DraftsContext)
  const [value, setValue] = useState<T>(() => (store?.has(key) ? (store.get(key) as T) : initial()))
  useEffect(() => {
    store?.set(key, value)
  }, [store, key, value])
  return [value, setValue]
}

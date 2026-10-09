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

/** Like useState, but the value survives navigating away and back. */
export function useDraft<T>(key: string, initial: () => T): [T, Dispatch<SetStateAction<T>>] {
  const store = useContext(DraftsContext)
  const [value, setValue] = useState<T>(() => (store?.has(key) ? (store.get(key) as T) : initial()))
  useEffect(() => {
    store?.set(key, value)
  }, [store, key, value])
  return [value, setValue]
}

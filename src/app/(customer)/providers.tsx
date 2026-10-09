'use client'

import { isApiError } from '@/api-client'
import type { Lang } from '@/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { LangProvider } from '@/customer/lib/i18n'

export function Providers({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Retry network and server errors, never 4xx (wrong input, not found, logged out).
            retry: (failures, error) => failures < 2 && !(isApiError(error) && error.status >= 400 && error.status < 500),
          },
          mutations: { retry: false },
        },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider initialLang={initialLang}>{children}</LangProvider>
    </QueryClientProvider>
  )
}

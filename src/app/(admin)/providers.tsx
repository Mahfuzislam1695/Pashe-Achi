'use client'

import { isApiError } from '@/api-client'
import type { Lang } from '@/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'sonner'

import { LangProvider } from '@/admin/lib/i18n'

export function Providers({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: (failures, error) => failures < 2 && !(isApiError(error) && error.status >= 400 && error.status < 500),
          },
          mutations: { retry: false },
        },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider initialLang={initialLang}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </LangProvider>
    </QueryClientProvider>
  )
}

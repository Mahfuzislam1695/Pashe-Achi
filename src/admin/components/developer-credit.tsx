'use client'

import { DEVELOPED_BY, DEVELOPER } from '@/shared'
import { ArrowUpRight, CodeXml } from 'lucide-react'

import { useLang } from '@/admin/lib/i18n'
import { cn } from '@/admin/lib/utils'

/** "Developed by Aethrasoft": a pill linking to the developer's site. `dark` is for navy backgrounds. */
export function DeveloperCredit({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
  const { t, text } = useLang()
  const dark = tone === 'dark'
  return (
    <a
      href={DEVELOPER.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t(`${DEVELOPER.name} ডেভেলপ করেছে (নতুন ট্যাবে খুলবে)`, `Developed by ${DEVELOPER.name} (opens in a new tab)`)}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition motion-safe:hover:-translate-y-px',
        'focus-visible:outline-2 focus-visible:outline-offset-3',
        dark
          ? 'border-white/15 bg-white/8 text-white/75 hover:border-white/35 hover:bg-white/12 focus-visible:outline-sun'
          : 'border-brand-100 bg-brand-50/60 text-muted hover:border-brand-200 hover:bg-brand-50 hover:shadow-card focus-visible:outline-brand-600',
        className,
      )}
    >
      <CodeXml className={cn('size-3.5', dark ? 'text-teal' : 'text-teal-ink')} aria-hidden />
      <span>{text(DEVELOPED_BY)}</span>
      <strong className={cn('bg-clip-text font-bold text-transparent', dark ? 'bg-linear-to-r from-teal to-sky' : 'bg-linear-to-r from-teal-ink to-brand-600')}>{DEVELOPER.name}</strong>
      <ArrowUpRight className="size-3 opacity-60 transition group-hover:opacity-100 motion-safe:group-hover:translate-x-px motion-safe:group-hover:-translate-y-px" aria-hidden />
    </a>
  )
}

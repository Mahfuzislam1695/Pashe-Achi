'use client'

import { DEVELOPED_BY, DEVELOPER } from '@/shared'
import { ArrowUpRight, CodeXml } from 'lucide-react'

import { useLang } from '@/customer/lib/i18n'

/** "Developed by Aethrasoft": a pill linking to the developer's site. `dark` is for navy backgrounds. */
export function DeveloperCredit({ tone = 'light', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  const { t, text } = useLang()
  return (
    <a
      className={`dev-credit tone-${tone}${compact ? ' compact' : ''}`}
      href={DEVELOPER.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t(`${DEVELOPER.name} ডেভেলপ করেছে (নতুন ট্যাবে খুলবে)`, `Developed by ${DEVELOPER.name} (opens in a new tab)`)}
    >
      <CodeXml className="dev-credit-mark" size={compact ? 13 : 14} aria-hidden />
      <span>{text(DEVELOPED_BY)}</span>
      <strong>{DEVELOPER.name}</strong>
      <ArrowUpRight className="dev-credit-arrow" size={12} aria-hidden />
    </a>
  )
}

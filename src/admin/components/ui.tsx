'use client'

import { type MessageCode, MESSAGES, ORDER_STATUS_LABELS, type OrderStatus } from '@/shared'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'

import { useLang } from '@/admin/lib/i18n'
import { cn } from '@/admin/lib/utils'

// Small building blocks in the shadcn style (cva + tailwind-merge), themed with the tokens in globals.css.

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700',
        secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
        ghost: 'text-muted hover:bg-canvas hover:text-ink',
        danger: 'border border-red-200 bg-surface text-red-700 hover:bg-red-50',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, loading, children, disabled, type = 'button', ...props }, ref) {
  return (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
})

const controlClass =
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:bg-canvas disabled:text-muted'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlClass, className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(controlClass, 'pr-8', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlClass, 'h-auto min-h-20 py-2', className)} {...props} />
})

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('grid gap-1.5', className)}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Card({ title, actions, children, className }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-200',
  BOOKED: 'bg-blue-50 text-blue-800 ring-blue-200',
  IN_PROGRESS: 'bg-violet-50 text-violet-800 ring-violet-200',
  COMPLETED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  CANCELLED: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}

/** Status always shows its label, never color alone. */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const { text } = useLang()
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_STYLES[status])}>{text(ORDER_STATUS_LABELS[status])}</span>
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'danger' | 'brand' }) {
  const tones = { neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200', danger: 'bg-red-50 text-red-700 ring-red-200', brand: 'bg-brand-50 text-brand-700 ring-brand-200' }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone])}>{children}</span>
}

export function ErrorNote({ code }: { code: MessageCode | null | undefined }) {
  const { text } = useLang()
  if (!code) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {text(MESSAGES[code])}
    </p>
  )
}

export function Loading({ label }: { label?: string }) {
  const { t } = useLang()
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" />
      {label ?? t('লোড হচ্ছে…', 'Loading…')}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>
}

/** A table that scrolls sideways on small screens instead of squashing columns. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  )
}

export const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cn('border-b border-line px-3 py-2 text-left text-xs font-semibold text-muted', className)}>{children}</th>
)

export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <td className={cn('border-b border-line px-3 py-2.5 align-middle', className)}>{children}</td>
)

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div className="inline-flex rounded-lg bg-canvas p-0.5 text-xs font-semibold" role="group" aria-label="ভাষা / Language">
      {(['bn', 'en'] as const).map(option => (
        <button
          key={option}
          type="button"
          aria-pressed={lang === option}
          onClick={() => setLang(option)}
          className={cn('rounded-md px-2.5 py-1', lang === option ? 'bg-surface text-brand-700 shadow-sm' : 'text-muted')}
        >
          {option === 'bn' ? 'বাং' : 'EN'}
        </button>
      ))}
    </div>
  )
}

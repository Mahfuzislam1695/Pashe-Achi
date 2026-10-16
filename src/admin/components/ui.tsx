'use client'

import { type MessageCode, MESSAGES, ORDER_STATUS_LABELS, type OrderStatus } from '@/shared'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'

import { useLang } from '@/admin/lib/i18n'
import { cn } from '@/admin/lib/utils'

// Small building blocks in the shadcn style (cva + tailwind-merge), themed with the tokens in globals.css.

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white shadow-xs hover:bg-brand-700',
        secondary: 'border border-line bg-surface text-ink hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700',
        ghost: 'text-muted hover:bg-canvas hover:text-ink',
        danger: 'border border-danger/25 bg-surface text-danger-ink hover:border-danger/50 hover:bg-danger-soft',
      },
      size: {
        sm: 'h-8 rounded-lg px-3 text-xs',
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
  'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted/70 focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:bg-canvas disabled:text-muted'

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
    <section className={cn('min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-navy">{title}</h2>}
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
        <h1 className="text-xl font-bold tracking-tight text-navy sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-warning-soft text-warning-ink ring-warning/20',
  // Waiting for the customer to confirm the price: the pending colour, outlined.
  QUOTED: 'bg-white text-warning-ink ring-warning/50',
  BOOKED: 'bg-brand-50 text-brand-800 ring-brand-200',
  IN_PROGRESS: 'bg-violet-soft text-violet-ink ring-violet/20',
  COMPLETED: 'bg-success-soft text-success-ink ring-success/20',
  CANCELLED: 'bg-danger-soft text-danger-ink ring-danger/20',
}

/** Status always shows its label, never color alone. */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const { text } = useLang()
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset', STATUS_STYLES[status])}>{text(ORDER_STATUS_LABELS[status])}</span>
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'danger' | 'brand' }) {
  const tones = { neutral: 'bg-canvas text-muted ring-line', danger: 'bg-danger-soft text-danger-ink ring-danger/20', brand: 'bg-brand-50 text-brand-700 ring-brand-200' }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone])}>{children}</span>
}

export function ErrorNote({ code }: { code: MessageCode | null | undefined }) {
  const { text } = useLang()
  if (!code) return null
  return (
    <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-sm font-medium text-danger-ink">
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
    <div className="inline-flex rounded-xl bg-canvas p-0.5 text-xs font-semibold" role="group" aria-label="ভাষা / Language">
      {(['bn', 'en'] as const).map(option => (
        <button
          key={option}
          type="button"
          aria-pressed={lang === option}
          onClick={() => setLang(option)}
          className={cn('rounded-lg px-2.5 py-1 transition-colors', lang === option ? 'bg-surface text-brand-700 shadow-sm' : 'text-muted')}
        >
          {option === 'bn' ? 'বাং' : 'EN'}
        </button>
      ))}
    </div>
  )
}

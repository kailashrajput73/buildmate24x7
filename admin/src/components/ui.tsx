import clsx from 'clsx'
import { Loader2, X, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { Tone } from '../lib/format'

// ---------------------------------------------------------------- Buttons

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
const btn: Record<BtnVariant, string> = {
  primary: 'bg-pipe-600 text-white hover:bg-pipe-700',
  secondary: 'bg-white text-ink border border-[#C4C7CF] hover:border-pipe-500 hover:text-pipe-700',
  ghost: 'text-ink-soft hover:bg-pipe-50 hover:text-pipe-700',
  danger: 'bg-white text-brick-700 border border-brick-500/40 hover:bg-brick-50',
  success: 'bg-[#5FAF2E] text-white hover:bg-[#3D7A1A]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; busy?: boolean; size?: 'sm' | 'md'; icon?: ReactNode }>(
  function Button({ variant = 'primary', busy, size = 'md', icon, className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={clsx('inline-flex items-center justify-center gap-1.5 rounded-lg font-display font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm', btn[variant], className)}
        disabled={disabled || busy}
        {...rest}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </button>
    )
  })

// ---------------------------------------------------------------- Form fields

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-brick-700">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx('input', className)} {...rest} />
})

export function NumberInput({ value, onChange, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | undefined | null; onChange: (v: number) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value))
  useEffect(() => { if (Number(text) !== value) setText(value == null ? '' : String(value)) }, [value]) // eslint-disable-line
  return (
    <input
      inputMode="decimal"
      className={clsx('input num', className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.\-]/g, '')
        setText(t)
        const n = Number(t)
        if (!Number.isNaN(n)) onChange(n)
      }}
      {...rest}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('input pr-8', className)} {...rest}>{children}</select>
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('input min-h-[80px]', className)} {...rest} />
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className={clsx('inline-flex cursor-pointer select-none items-center gap-2 text-sm', disabled && 'opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-leaf-500' : 'bg-line')}
      >
        <span className={clsx('absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      {label}
    </label>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Search', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  useEffect(() => {
    const t = setTimeout(() => { if (v !== value) onChange(v) }, 300)
    return () => clearTimeout(t)
  }, [v]) // eslint-disable-line
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input autoFocus={autoFocus} className="input pl-8" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} />
    </div>
  )
}

// ---------------------------------------------------------------- Display

const tones: Record<Tone, string> = {
  neutral: 'bg-[#EEF1F5] text-ink-soft',
  info: 'bg-pipe-50 text-pipe-700',
  success: 'bg-leaf-50 text-leaf-700',
  warn: 'bg-tape-100 text-tape-700',
  danger: 'bg-brick-50 text-brick-700',
}
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-2xl font-display font-bold">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-ink-soft">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Section({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-bold">{title}</h2>
          {actions}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-ink-soft">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}…
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null
  return <div className="rounded-md border border-brick-500/30 bg-brick-50 px-3 py-2 text-sm text-brick-700">{error instanceof Error ? error.message : 'Something went wrong.'}</div>
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return <div className="px-3 py-2 text-xs text-ink-faint">{total} {total === 1 ? 'record' : 'records'}</div>
  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs text-ink-soft">
      <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="num px-1">{page} / {pages}</span>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'danger' | 'good' }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-semibold text-ink-soft">{label}</div>
      <div className={clsx('num mt-1 text-2xl font-display font-bold',
        tone === 'warn' && 'text-tape-700', tone === 'danger' && 'text-brick-700', tone === 'good' && 'text-leaf-700')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-faint">{sub}</div>}
    </div>
  )
}

export function KeyVal({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-ink-soft">{k}</span>
      <span className="text-right font-medium">{v ?? '—'}</span>
    </div>
  )
}

// ---------------------------------------------------------------- Overlays

export function Drawer({ open, onClose, title, children, footer, width = 'max-w-xl' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={clsx('relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl outline-none', width)}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-line bg-white px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="border-b border-line px-5 py-3"><h2 className="font-bold">{title}</h2></header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

/** Shows row-level errors from an Excel import. */
export function ImportErrors({ errors }: { errors?: { row: number; message: string }[] }) {
  if (!errors?.length) return null
  return (
    <div className="mt-3 max-h-60 overflow-y-auto rounded-md border border-brick-500/30 bg-brick-50 p-3 text-sm">
      <p className="mb-1 font-semibold text-brick-700">Fix these rows and upload again — nothing was saved:</p>
      <ul className="space-y-0.5 text-brick-700">
        {errors.map((e, i) => <li key={i}><span className="num font-semibold">Row {e.row}:</span> {e.message}</li>)}
      </ul>
    </div>
  )
}

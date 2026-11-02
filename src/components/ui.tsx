import clsx from 'clsx'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Info, Lightbulb, Minus } from 'lucide-react'
import { delta } from '../lib/format'

export function Card({ title, subtitle, actions, children, className, bodyClass }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={clsx('rounded-xl border border-black/[.08] bg-[var(--surface-1)] shadow-sm dark:border-white/10 fade-in', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-black/[.06] px-4 py-3 dark:border-white/[.08]">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('p-4', bodyClass)}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-300">{icon}</div>}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({ variant = 'secondary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
        variant === 'secondary' && 'border border-black/10 bg-white text-[var(--text-primary)] hover:bg-black/[.03] dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10',
        variant === 'ghost' && 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10',
        variant === 'danger' && 'text-[var(--critical)] hover:bg-red-500/10',
        className,
      )}
    />
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warning' | 'critical' | 'info' | 'brand'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-black/5 text-[var(--text-secondary)] dark:bg-white/10',
        tone === 'good' && 'bg-green-600/10 text-[var(--good-text)]',
        tone === 'warning' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
        tone === 'critical' && 'bg-red-600/10 text-[var(--critical)] dark:text-red-300',
        tone === 'info' && 'bg-blue-600/10 text-blue-700 dark:text-blue-300',
        tone === 'brand' && 'bg-brand-600/10 text-brand-700 dark:text-brand-300',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Kpi({ label, value, unit, hint, before, after, higherIsBetter, tone, icon }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; before?: number; after?: number; higherIsBetter?: boolean; tone?: 'good' | 'warning' | 'critical'; icon?: ReactNode }) {
  const d = before !== undefined && after !== undefined && higherIsBetter !== undefined ? delta(before, after, higherIsBetter) : null
  return (
    <div className="rounded-xl border border-black/[.08] bg-[var(--surface-1)] p-3.5 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        {icon && <span className="text-[var(--muted)]">{icon}</span>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={clsx('text-2xl font-semibold tracking-tight', tone === 'critical' && 'text-[var(--critical)]', tone === 'good' && 'text-[var(--good-text)]', tone === 'warning' && 'text-amber-600 dark:text-amber-400')}>{value}</span>
        {unit && <span className="text-sm text-[var(--text-secondary)]">{unit}</span>}
      </div>
      {d && Number.isFinite(d.change) && (
        <div className={clsx('mt-1 inline-flex items-center gap-0.5 text-xs font-medium', d.good && 'text-[var(--good-text)]', d.bad && 'text-[var(--critical)]', !d.good && !d.bad && 'text-[var(--muted)]')}>
          {d.change > 0 ? <ArrowUpRight size={13} /> : d.change < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
          {(d.change * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1, signDisplay: 'always' })} %
        </div>
      )}
      {hint && <div className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{hint}</div>}
    </div>
  )
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{hint}</span>}
    </label>
  )
}

const inputCls =
  'rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/15 dark:bg-white/5'

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={clsx(inputCls, !/(^|\s)w-/.test(p.className ?? '') && 'w-full', p.className)} />
}

export function NumberInput({ value, onChange, min, max, step, className, suffix }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string; suffix?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className={clsx('relative', className)}>
      <input
        type="number"
        className={clsx(inputCls, 'w-full tabular', suffix && 'pr-10')}
        value={draft ?? (Number.isFinite(value) ? String(value) : '')}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          setDraft(e.target.value)
          const v = parseFloat(e.target.value)
          if (Number.isFinite(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)))
        }}
        onBlur={() => setDraft(null)}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-[var(--muted)]">{suffix}</span>}
    </div>
  )
}

export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={clsx(inputCls, 'pr-7', !/(^|\s)w-/.test(className ?? '') && 'w-full', className)} />
}

export function TextArea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={clsx(inputCls, 'w-full min-h-[70px]', p.className)} />
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-black/[.08] bg-[var(--surface-1)] p-1 dark:border-white/10">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === t.id ? 'bg-brand-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Note({ children, tone = 'info', title }: { children: ReactNode; tone?: 'info' | 'tip' | 'warning'; title?: string }) {
  return (
    <div
      className={clsx(
        'flex gap-2.5 rounded-lg border p-3 text-[13px] leading-relaxed',
        tone === 'info' && 'border-blue-500/20 bg-blue-500/5',
        tone === 'tip' && 'border-brand-500/25 bg-brand-500/5',
        tone === 'warning' && 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <span className="mt-0.5 shrink-0 text-[var(--text-secondary)]">{tone === 'tip' ? <Lightbulb size={15} /> : <Info size={15} />}</span>
      <div className="min-w-0 text-[var(--text-secondary)]">
        {title && <div className="mb-0.5 font-semibold text-[var(--text-primary)]">{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function Table({ head, rows, className, dense }: { head: ReactNode[]; rows: ReactNode[][]; className?: string; dense?: boolean }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-xs text-[var(--text-secondary)] dark:border-white/10">
            {head.map((h, i) => (
              <th key={i} className={clsx('font-medium whitespace-nowrap', dense ? 'px-2 py-1.5' : 'px-3 py-2', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-black/[.05] last:border-0 hover:bg-black/[.02] dark:border-white/[.06] dark:hover:bg-white/[.03]">
              {r.map((c, j) => (
                <td key={j} className={clsx(dense ? 'px-2 py-1.5' : 'px-3 py-2', j > 0 && 'text-right')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg bg-black/[.03] px-3 py-2 dark:bg-white/[.05]">
      <div className="text-[11px] text-[var(--text-secondary)]">{label}</div>
      <div className="tabular text-base font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-[var(--muted)]">{sub}</div>}
    </div>
  )
}

export function Grid({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6; className?: string }) {
  const c = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5', 6: 'sm:grid-cols-3 lg:grid-cols-6' }[cols]
  return <div className={clsx('grid grid-cols-1 gap-3', c, className)}>{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-[var(--muted)] dark:border-white/15">{children}</div>
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <span
        onClick={() => onChange(!checked)}
        className={clsx('relative inline-block h-5 w-9 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-black/20 dark:bg-white/20')}
      >
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </label>
  )
}

export function StatusIcon({ ok }: { ok: boolean }) {
  return <span className={clsx('inline-block h-2 w-2 rounded-full', ok ? 'bg-[var(--good)]' : 'bg-[var(--critical)]')} />
}

export function Delta({ a, b, up }: { a: number; b: number; up?: boolean }) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return <span>—</span>
  const c = (b - a) / Math.abs(a)
  const good = up ? c > 0.0005 : c < -0.0005
  const bad = up ? c < -0.0005 : c > 0.0005
  return <Badge tone={good ? 'good' : bad ? 'critical' : 'neutral'}>{(c * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1, signDisplay: 'always' })} %</Badge>
}

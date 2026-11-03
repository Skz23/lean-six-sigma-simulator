import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, CheckCircle2, Lightbulb, Ruler, Search, ShieldCheck, Target } from 'lucide-react'
import { Badge } from './ui'
import { PHASES, rememberPhase, stepsOf, type PhaseId, type Tool } from '../workflow/phases'

export function PhaseIcon({ id, size = 16 }: { id: PhaseId; size?: number }) {
  const I = { define: Target, measure: Ruler, analyze: Search, improve: Lightbulb, control: ShieldCheck }[id]
  return <I size={size} />
}

/** Bandeau des 5 phases DMAIC (liens). */
export function PhaseStrip({ current, compact, gates, ongoing }: { current?: PhaseId; compact?: boolean; gates?: Partial<Record<PhaseId, boolean>>; ongoing?: PhaseId }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {PHASES.map((p) => (
        <Link
          key={p.id}
          to={`/dmaic/${p.id}`}
          className={clsx(
            'group min-w-0 rounded-lg border-2 px-2 py-2 transition-colors',
            current === p.id ? 'border-brand-500 bg-brand-500/10' : 'border-transparent bg-[var(--surface-1)] ring-1 ring-black/[.08] hover:ring-brand-500/50 dark:ring-white/10',
          )}
        >
          <div className="flex items-center justify-center gap-1.5 sm:justify-start">
            <span className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold', current === p.id ? 'bg-brand-600 text-white' : 'bg-brand-600/10 text-brand-700 dark:text-brand-300')}>{p.n}</span>
            <span className="hidden truncate text-sm font-semibold sm:inline">{p.label}</span>
            {gates?.[p.id] && <CheckCircle2 size={14} className="hidden shrink-0 text-[var(--good)] sm:block" />}
            {!gates?.[p.id] && ongoing === p.id && <span className="hidden h-2 w-2 shrink-0 rounded-full bg-amber-500 sm:block" title="Phase en cours du projet" />}
          </div>
          {!compact && <div className="mt-1 hidden truncate text-[11px] text-[var(--muted)] sm:block">{p.marp}</div>}
        </Link>
      ))}
    </div>
  )
}

export const familyTone = (f: Tool['family']) =>
  (({ Projet: 'brand', Lean: 'good', 'Six Sigma': 'info', Qualité: 'warning', Statistiques: 'neutral', Simulation: 'neutral' }) as const)[f]

export function ToolCard({ t, phase, role, footer, done }: { t: Tool; phase?: string; role?: string; footer?: React.ReactNode; done?: boolean }) {
  const where = stepsOf(t.id).filter((x) => x.phase.id !== phase)
  const card = (
    <Link
      to={t.to}
      onClick={() => phase && rememberPhase(phase)}
      className={clsx(
        'group flex flex-1 flex-col p-3.5 transition-colors',
        footer ? 'rounded-t-xl' : 'rounded-xl border border-black/[.08] bg-[var(--surface-1)] shadow-sm hover:border-brand-500/60 dark:border-white/10',
      )}
    >
      {role && <span className="mb-0.5 text-[11px] font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-300">{role}</span>}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-300">{t.name}</span>
        <ArrowRight size={15} className="mt-0.5 shrink-0 text-[var(--muted)] group-hover:text-brand-600" />
      </div>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-[var(--text-secondary)]">{t.desc}</p>
      <div className="mt-2.5 flex flex-wrap gap-1">
        <Badge tone={familyTone(t.family)}>{t.family}</Badge>
        {where.map((x) => (
          <Badge key={x.step.n} className="whitespace-normal">
            {phase ? 'aussi en ' : ''}
            {x.step.n} {x.phase.label}
            {x.role ? ` — ${x.role.toLowerCase()}` : ''}
          </Badge>
        ))}
      </div>
    </Link>
  )
  if (!footer) return card
  return (
    <div className={clsx('flex flex-col rounded-xl border bg-[var(--surface-1)] shadow-sm transition-colors hover:border-brand-500/60', done ? 'border-[var(--good)]/50' : 'border-black/[.08] dark:border-white/10')}>
      {card}
      <div className="border-t border-black/[.06] px-3.5 py-2 dark:border-white/[.08]">{footer}</div>
    </div>
  )
}

export function ProgressBar({ ratio, className }: { ratio: number; className?: string }) {
  return (
    <div className={clsx('h-2 rounded-full bg-black/[.06] dark:bg-white/10', className)}>
      <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  )
}


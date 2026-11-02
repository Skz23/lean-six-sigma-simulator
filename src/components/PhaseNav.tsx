import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, Lightbulb, Ruler, Search, ShieldCheck, Target } from 'lucide-react'
import { Badge } from './ui'
import { PHASES, rememberPhase, type PhaseId, type Tool } from '../workflow/phases'

export function PhaseIcon({ id, size = 16 }: { id: PhaseId; size?: number }) {
  const I = { define: Target, measure: Ruler, analyze: Search, improve: Lightbulb, control: ShieldCheck }[id]
  return <I size={size} />
}

/** Bandeau des 5 phases DMAIC (liens). */
export function PhaseStrip({ current, compact }: { current?: PhaseId; compact?: boolean }) {
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
          </div>
          {!compact && <div className="mt-1 hidden truncate text-[11px] text-[var(--muted)] sm:block">{p.marp}</div>}
        </Link>
      ))}
    </div>
  )
}

export const familyTone = (f: Tool['family']) =>
  (({ Projet: 'brand', Lean: 'good', 'Six Sigma': 'info', Qualité: 'warning', Statistiques: 'neutral', Simulation: 'neutral' }) as const)[f]

export function ToolCard({ t, phase }: { t: Tool; phase?: string }) {
  const others = PHASES.filter((p) => p.id !== phase && t.phases.includes(p.id))
  return (
    <Link
      to={t.to}
      onClick={() => phase && rememberPhase(phase)}
      className="group flex flex-col rounded-xl border border-black/[.08] bg-[var(--surface-1)] p-3.5 shadow-sm transition-colors hover:border-brand-500/60 dark:border-white/10"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-300">{t.name}</span>
        <ArrowRight size={15} className="mt-0.5 shrink-0 text-[var(--muted)] group-hover:text-brand-600" />
      </div>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-[var(--text-secondary)]">{t.desc}</p>
      <div className="mt-2.5 flex flex-wrap gap-1">
        <Badge tone={familyTone(t.family)}>{t.family}</Badge>
        {others.map((p) => (
          <Badge key={p.id}>{phase ? 'aussi en ' : ''}{p.n} · {p.label}</Badge>
        ))}
      </div>
    </Link>
  )
}


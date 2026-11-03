import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { ArrowLeft, Check, ChevronRight, ClipboardCheck } from 'lucide-react'
import { useCurrentProject, useStore } from '../store/useStore'
import { PHASES, lastPhase, rememberPhase, toolById, toolsAt, type PhaseId } from '../workflow/phases'
import { pathOf, type PathItem } from '../workflow/project'

const label = (x: PathItem) => x.tool.role ?? toolById(x.tool.id)!.name

/**
 * Bandeau « étape suivante » en bas de chaque outil du parcours du projet en cours :
 * position dans la phase, résultat à retenir, « Fait → outil suivant ».
 */
export function StepBar() {
  const loc = useLocation()
  const nav = useNavigate()
  const p = useCurrentProject()
  const setTools = useStore((s) => s.setTools)
  const here = toolsAt(loc.pathname, loc.search)
  const ctx = (() => {
    if (!p || here.length !== 1 || loc.pathname.startsWith('/dmaic/')) return null
    const id = here[0].id
    const order: PhaseId[] = [lastPhase() as PhaseId, p.phase, ...PHASES.map((x) => x.id)].filter(Boolean)
    for (const ph of order) {
      const path = pathOf(p, ph)
      const i = path.findIndex((x) => x.tool.id === id)
      if (i >= 0) return { path, i }
    }
    return null
  })()
  const key = ctx ? ctx.path[ctx.i].key : ''
  const [result, setResult] = useState('')
  useEffect(() => setResult(p?.results?.[key] ?? ''), [key, p?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!p || !ctx) return null

  const { path, i } = ctx
  const cur = path[i]
  const prev = path[i - 1]
  const next = path[i + 1]
  const done = !!p.done?.[cur.key]
  const go = (x: PathItem) => {
    rememberPhase(x.phase.id)
    nav(toolById(x.tool.id)!.to)
  }
  const save = (markDone: boolean) =>
    setTools((t) => {
      const x = t.dmaic.find((y) => y.id === p.id)
      if (!x) return
      ;(x.results ??= {})[cur.key] = result
      if (markDone) (x.done ??= {})[cur.key] = true
    })
  const finish = () => {
    save(true)
    if (next) go(next)
    else nav(`/dmaic/${cur.phase.id}?revue=1`)
  }
  const nDone = path.filter((x) => p.done?.[x.key] || x.key === cur.key && done).length

  return (
    <div className="no-print sticky bottom-0 z-20 border-t border-brand-500/30 bg-[var(--surface-1)]/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="mx-auto max-w-[1400px] px-4 py-2.5 sm:px-6">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-secondary)]">
          <span className="truncate font-medium text-[var(--text-primary)]">{p.name}</span>
          <ChevronRight size={12} />
          <span>Phase {cur.phase.n} · {cur.phase.label}</span>
          <ChevronRight size={12} />
          <span>
            {cur.step.n} · outil {i + 1}/{path.length}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-20 rounded-full bg-black/[.08] dark:bg-white/10">
              <span className="block h-1.5 rounded-full bg-brand-500" style={{ width: `${(nDone / path.length) * 100}%` }} />
            </span>
            {nDone}/{path.length} faits
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={clsx('hidden shrink-0 items-center gap-1 text-sm font-semibold md:flex', done && 'text-[var(--good-text)]')}>
            {done && <Check size={14} />} {label(cur)}
          </span>
          <input
            className="h-9 min-w-0 flex-1 basis-48 rounded-lg border border-black/10 bg-transparent px-2.5 text-sm dark:border-white/15"
            placeholder="Résultat à retenir (ex. %R&R = 14 %, ndc = 6)…"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            onBlur={() => result !== (p.results?.[cur.key] ?? '') && save(false)}
          />
          <div className="flex shrink-0 items-center gap-1.5">
            {prev && (
              <button onClick={() => go(prev)} className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10" title={`Précédent : ${label(prev)}`}>
                <ArrowLeft size={15} />
                <span className="hidden sm:inline">Précédent</span>
              </button>
            )}
            {next && (
              <button onClick={() => { save(false); go(next) }} className="h-9 rounded-lg px-2 text-sm text-[var(--text-secondary)] underline-offset-2 hover:underline" title="Passer sans marquer comme fait">
                Passer
              </button>
            )}
            <button onClick={finish} className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">
              {next ? <Check size={15} /> : <ClipboardCheck size={15} />}
              <span className="max-w-[46vw] truncate sm:max-w-[260px]">{next ? `Fait → ${label(next)}` : 'Fait → revue de fin de phase'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

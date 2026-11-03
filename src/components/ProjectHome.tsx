import { Link } from 'react-router-dom'
import { ArrowRight, FolderOpen, Plus } from 'lucide-react'
import { useCurrentProject } from '../store/useStore'
import { Badge, Button, Card } from './ui'
import { PhaseStrip, ProgressBar } from './PhaseNav'
import { phaseById, rememberPhase, toolById } from '../workflow/phases'
import { METHOD_LABEL, isLight, keyResults, nextTarget, nextTodo, projectProgress } from '../workflow/project'

/** Bloc « projet en cours » de l'accueil : avancement, prochaines actions, résultats retenus. */
export function ProjectHome() {
  const p = useCurrentProject()
  if (!p)
    return (
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Aucun projet. Créez-en un pour être guidé pas à pas dans la démarche DMAIC.</p>
          <Link to="/projets?new=1"><Button variant="primary"><Plus size={15} /> Nouveau projet</Button></Link>
        </div>
      </Card>
    )
  const ph = phaseById(p.phase)!
  const prog = projectProgress(p)
  const todo = nextTodo(p, 3)
  const next = nextTarget(p)
  const results = keyResults(p).slice(-4)
  return (
    <Card className="mb-4" bodyClass="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Projet en cours</div>
          <h2 className="mt-0.5 text-lg font-semibold">{p.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={isLight(p) ? 'warning' : 'info'}>{METHOD_LABEL[p.method ?? 'dmaic']}</Badge>
            <Badge tone="brand">Phase {ph.n} · {ph.label}</Badge>
            <span className="text-xs text-[var(--text-secondary)]">{prog.done} / {prog.total} outils faits</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/projets"><Button size="sm"><FolderOpen size={13} /> Mes projets</Button></Link>
          <Link to="/projets/synthese"><Button size="sm">Synthèse</Button></Link>
          <Link to={next ? toolById(next.tool.id)!.to : `/dmaic/${p.phase}`} onClick={() => next && rememberPhase(next.phase.id)}>
            <Button size="sm" variant="primary">{next ? <>Continuer : {next.tool.role ?? toolById(next.tool.id)!.name}</> : 'Continuer'} <ArrowRight size={13} /></Button>
          </Link>
        </div>
      </div>
      <ProgressBar ratio={prog.ratio} className="mt-3" />
      <div className="mt-3">
        <PhaseStrip compact gates={p.gates} ongoing={p.phase} current={p.phase} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">Prochaines actions — phase {ph.label}</div>
          {todo.length ? (
            <ul className="space-y-1">
              {todo.map((x) => {
                const t = toolById(x.tool.id)!
                return (
                  <li key={x.step.n + x.tool.id}>
                    <Link to={t.to} onClick={() => rememberPhase(x.phase.id)} className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]">
                      <span className="rounded bg-brand-600/10 px-1.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">{x.step.n}</span>
                      <span className="min-w-0 flex-1 truncate">{x.tool.role ?? t.name}</span>
                      <ArrowRight size={13} className="text-[var(--muted)] group-hover:text-brand-600" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              Tous les outils de la phase sont faits : validez la <Link to={`/dmaic/${p.phase}`} className="text-brand-600 underline">revue de fin de phase</Link>.
            </p>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">Résultats retenus</div>
          {results.length ? (
            <ul className="space-y-1 text-sm">
              {results.map((r) => (
                <li key={r.step.n + r.tool.id} className="flex gap-2">
                  <span className="shrink-0 text-[11px] font-semibold text-[var(--muted)]">{r.step.n}</span>
                  <span className="min-w-0"><span className="text-[var(--text-secondary)]">{r.tool.role ?? toolById(r.tool.id)!.name} :</span> {r.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">Notez le résultat de chaque outil dans la page de la phase (ex. « %R&R = 14 % »). Il s'affichera ici.</p>
          )}
        </div>
      </div>
    </Card>
  )
}

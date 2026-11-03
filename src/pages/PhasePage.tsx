import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, FolderOpen, HelpCircle, PackageCheck, Plus } from 'lucide-react'
import { useCurrentProject, useStore } from '../store/useStore'
import type { DmaicProject } from '../store/types'
import { Badge, Button, Card, Note } from '../components/ui'
import { ProjectExports } from '../components/ProjectExports'
import { PhaseIcon, PhaseStrip, ProgressBar, ToolCard } from '../components/PhaseNav'
import { PHASES, phaseById, rememberPhase, toolById } from '../workflow/phases'
import { PHASE_LESSONS } from '../workflow/lessons'
import { METHOD_LABEL, doneKey, isLight, pathOf, phaseProgress, stepsFor } from '../workflow/project'

export default function PhasePage() {
  const { phase: pid } = useParams()
  const phase = phaseById(pid) ?? PHASES[0]
  const proj = useCurrentProject()
  const setTools = useStore((s) => s.setTools)
  const nav = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const prev = PHASES[phase.n - 2]
  const next = PHASES[phase.n]

  useEffect(() => rememberPhase(phase.id), [phase.id])

  const set = (fn: (p: DmaicProject) => void) =>
    proj &&
    setTools((t) => {
      const x = t.dmaic.find((y) => y.id === proj.id)
      if (x) fn(x)
    })
  const light = !!proj && isLight(proj) && !showAll
  const steps = stepsFor(phase, light)
  const hidden = phase.steps.reduce((n, s) => n + s.tools.length, 0) - steps.reduce((n, s) => n + s.tools.length, 0)
  const prog = proj ? phaseProgress(proj, phase.id) : undefined
  const checks = phase.gate.map((_, i) => !!proj?.gateChecks?.[phase.id]?.[i])
  const gateOk = checks.every(Boolean)
  const toggleGate = (i: number) =>
    set((x) => {
      const g = (x.gateChecks ??= {})
      const arr = (g[phase.id] ??= phase.gate.map(() => false))
      arr[i] = !arr[i]
      x.gates[phase.id] = phase.gate.every((_, j) => arr[j])
    })
  const passNext = () => {
    set((x) => {
      x.gates[phase.id] = true
      if (next) x.phase = next.id
    })
    if (!next) return nav('/projets/synthese')
    // On enchaîne directement sur le premier outil à faire de la phase suivante
    const first = proj && pathOf({ ...proj, phase: next.id }, next.id).find((x) => !proj.done?.[x.key])
    rememberPhase(next.id)
    nav(first ? toolById(first.tool.id)!.to : `/dmaic/${next.id}`)
  }
  const [params] = useSearchParams()
  const review = params.get('revue') === '1'
  useEffect(() => {
    if (review) setTimeout(() => document.getElementById('revue')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
  }, [review, phase.id])
  const workHere = () => set((x) => (x.phase = phase.id))

  return (
    <div>
      <div className="mb-4">
        <PhaseStrip current={phase.id} gates={proj?.gates} ongoing={proj?.phase} />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white">
          <PhaseIcon id={phase.id} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Phase {phase.n} · {phase.label} <span className="text-base font-normal text-[var(--muted)]">({phase.en})</span>
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">Étape de résolution de problème : {phase.marp.toLowerCase()}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card title="Objectif de la phase" className="lg:col-span-7">
          <p className="text-sm leading-relaxed">{phase.goal}</p>
          <div className="mt-3 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Questions à se poser</div>
          <ul className="mt-1.5 space-y-1.5">
            {phase.questions.map((q) => (
              <li key={q} className="flex gap-2 text-sm">
                <HelpCircle size={15} className="mt-0.5 shrink-0 text-brand-600" />
                {q}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg bg-brand-500/[.06] p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-300"><BookOpen size={13} /> Rappel de cours</div>
            <p>{PHASE_LESSONS[phase.id].key}</p>
            <div className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">Pièges fréquents</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-[var(--text-secondary)]">
              {PHASE_LESSONS[phase.id].pitfalls.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>
        </Card>
        <Card title="Projet en cours" className="lg:col-span-5">
          {proj ? (
            <div className="space-y-3">
              <div>
                <div className="font-medium">{proj.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={isLight(proj) ? 'warning' : 'info'}>{METHOD_LABEL[proj.method ?? 'dmaic']}</Badge>
                  {proj.phase === phase.id ? <Badge tone="brand">phase en cours du projet</Badge> : <Badge>phase en cours : {phaseById(proj.phase)!.n} · {phaseById(proj.phase)!.label}</Badge>}
                </div>
              </div>
              {prog && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-[var(--text-secondary)]">
                    <span>Outils faits dans cette phase</span>
                    <span>{prog.done} / {prog.total}</span>
                  </div>
                  <ProgressBar ratio={prog.ratio} />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {proj.phase !== phase.id && <Button size="sm" onClick={workHere}>Faire de cette phase la phase en cours</Button>}
                <Button size="sm" onClick={() => nav(`/sixsigma/dmaic?phase=${phase.id}`)}>
                  <FolderOpen size={13} /> Espace projet (notes, charte…)
                </Button>
                <Link to="/projets" className="self-center text-xs text-brand-600 underline dark:text-brand-300">Changer de projet</Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[var(--text-secondary)]">Créez un projet pour suivre votre avancement outil par outil.</p>
              <Button variant="primary" onClick={() => nav('/projets?new=1')}><Plus size={15} /> Nouveau projet</Button>
            </div>
          )}
        </Card>
      </div>

      <h2 className="mt-6 mb-1 text-base font-semibold">Le chemin de la phase</h2>
      <p className="mb-3 text-sm text-[var(--text-secondary)]">
        Suivez les sous-étapes dans l'ordre. Ouvrez l'outil, puis cochez « Fait » et notez le résultat à retenir : il alimente l'accueil et le rapport du projet.
      </p>
      {proj && isLight(proj) && (
        <div className="mb-3">
          <Note tone="tip">
            {METHOD_LABEL[proj.method ?? 'dmaic']} : {showAll ? 'tous les outils sont affichés.' : `seuls les outils essentiels sont affichés (${hidden} masqués).`}{' '}
            <button className="text-brand-600 underline" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Revenir à l\'essentiel' : 'Afficher tous les outils'}</button>
          </Note>
        </div>
      )}
      <ol className="space-y-4">
        {steps.map((st) => (
          <li key={st.n} className="relative rounded-xl border border-black/[.08] bg-black/[.015] p-3.5 dark:border-white/10 dark:bg-white/[.02]">
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">{st.n}</span>
              <h3 className="text-[15px] font-semibold">{st.title}</h3>
              <span className="text-xs text-[var(--text-secondary)]">{st.hint}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {st.tools.map((x) => {
                const t = toolById(x.id)!
                const k = doneKey(st, x)
                const done = !!proj?.done?.[k]
                return (
                  <ToolCard
                    key={x.id}
                    t={t}
                    phase={phase.id}
                    role={x.role}
                    done={done}
                    footer={
                      proj && (
                        <div className="flex items-center gap-2">
                          <label className={clsx('flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium', done ? 'text-[var(--good-text)]' : 'text-[var(--text-secondary)]')}>
                            <input type="checkbox" className="accent-[var(--color-brand-600)]" checked={done} onChange={() => set((p) => ((p.done ??= {})[k] = !done))} />
                            Fait
                          </label>
                          <input
                            className="h-7 min-w-0 flex-1 rounded-md border border-black/10 bg-transparent px-2 text-xs dark:border-white/15"
                            placeholder="Résultat à retenir…"
                            value={proj.results?.[k] ?? ''}
                            onChange={(e) => set((p) => ((p.results ??= {})[k] = e.target.value))}
                          />
                        </div>
                      )
                    }
                  />
                )
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><PackageCheck size={15} /> Livrables attendus</span>}>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {phase.deliverables.map((d) => <li key={d}>{d}</li>)}
          </ul>
          {proj && (
            <div className="mt-3 border-t border-black/[.06] pt-3 dark:border-white/[.08]">
              <div className="mb-2 text-xs text-[var(--text-secondary)]">Exporter, rempli avec les données du projet :</div>
              <ProjectExports phase={phase.id} />
            </div>
          )}
        </Card>
        <div id="revue" className={clsx('rounded-xl', review && 'ring-2 ring-brand-500 ring-offset-2 ring-offset-[var(--page)]')}>
        <Card title={<span className="flex items-center gap-2"><CheckCircle2 size={15} /> Revue de fin de phase (tollgate)</span>} subtitle={review ? 'Tous les outils de la phase sont passés : vérifiez chaque point avant de passer à la suite' : 'Cochez quand c\'est vrai pour votre projet'}>
          <ul className="space-y-1.5 text-sm">
            {phase.gate.map((d, i) => (
              <li key={d}>
                <label className={clsx('flex items-start gap-2', proj && 'cursor-pointer')}>
                  {proj ? (
                    <input type="checkbox" className="mt-1 accent-[var(--color-brand-600)]" checked={checks[i]} onChange={() => toggleGate(i)} />
                  ) : (
                    <Circle size={14} className="mt-1 shrink-0 text-[var(--muted)]" />
                  )}
                  <span className={clsx(checks[i] && 'text-[var(--text-secondary)]')}>{d}</span>
                </label>
              </li>
            ))}
          </ul>
          {proj && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {gateOk ? <Badge tone="good"><CheckCircle2 size={11} /> Revue validée</Badge> : <Badge>{checks.filter(Boolean).length} / {checks.length}</Badge>}
              {gateOk && proj.phase === phase.id && (
                <Button size="sm" variant="primary" onClick={passNext}>
                  {next ? <>Passer à {next.n} · {next.label}</> : 'Clôturer : synthèse du projet'} <ArrowRight size={13} />
                </Button>
              )}
            </div>
          )}
        </Card>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-2">
        {prev ? (
          <Link to={`/dmaic/${prev.id}`}><Button><ArrowLeft size={15} /> {prev.n} · {prev.label}</Button></Link>
        ) : <span />}
        {next ? (
          <Link to={`/dmaic/${next.id}`}><Button variant="primary">{next.n} · {next.label} <ArrowRight size={15} /></Button></Link>
        ) : (
          <Link to="/reports"><Button variant="primary">Rapport de clôture <ArrowRight size={15} /></Button></Link>
        )}
      </div>
    </div>
  )
}

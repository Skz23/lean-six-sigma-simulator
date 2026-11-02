import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, FolderOpen, HelpCircle, PackageCheck } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Button, Card, Select } from '../components/ui'
import { PhaseIcon, PhaseStrip, ToolCard } from '../components/PhaseNav'
import { PHASES, phaseById, rememberPhase, toolById } from '../workflow/phases'
import { useState } from 'react'

export default function PhasePage() {
  const { phase: pid } = useParams()
  const phase = phaseById(pid) ?? PHASES[0]
  const projects = useStore((s) => s.tools.dmaic)
  const setTools = useStore((s) => s.setTools)
  const nav = useNavigate()
  const [projId, setProjId] = useState(projects[0]?.id)
  const proj = projects.find((p) => p.id === projId) ?? projects[0]
  const prev = PHASES[phase.n - 2]
  const next = PHASES[phase.n]

  useEffect(() => rememberPhase(phase.id), [phase.id])

  const openProject = () => {
    if (!proj) return nav('/sixsigma/dmaic')
    setTools((t) => {
      const x = t.dmaic.find((y) => y.id === proj.id)
      if (x) x.phase = phase.id
    })
    nav(`/sixsigma/dmaic?project=${proj.id}`)
  }

  return (
    <div>
      <div className="mb-4">
        <PhaseStrip current={phase.id} />
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
        </Card>
        <Card title="Mon projet" subtitle="Charte, causes, solutions et revue de phase sont saisies dans l'espace projet" className="lg:col-span-5">
          {proj ? (
            <div className="space-y-3">
              {projects.length > 1 && (
                <Select value={proj.id} onChange={(e) => setProjId(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              )}
              <div className="text-sm font-medium">{proj.name}</div>
              <div className="flex flex-wrap gap-1">
                {PHASES.map((p) => (
                  <Badge key={p.id} tone={proj.gates[p.id] ? 'good' : p.id === proj.phase ? 'brand' : 'neutral'}>
                    {proj.gates[p.id] ? <CheckCircle2 size={11} /> : <Circle size={11} />} {p.n} {p.label}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Revue de la phase {phase.label} : <b>{proj.gates[phase.id] ? 'validée' : 'non validée'}</b>
              </p>
              <Button variant="primary" onClick={openProject}>
                <FolderOpen size={15} /> Ouvrir la phase dans le projet
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={() => nav('/sixsigma/dmaic')}>
              <FolderOpen size={15} /> Créer un projet
            </Button>
          )}
        </Card>
      </div>

      <h2 className="mt-6 mb-1 text-base font-semibold">Le chemin de la phase</h2>
      <p className="mb-3 text-sm text-[var(--text-secondary)]">Suivez les sous-étapes dans l'ordre. Chacune utilise un ou plusieurs outils.</p>
      <ol className="space-y-4">
        {phase.steps.map((st) => (
          <li key={st.n} className="relative rounded-xl border border-black/[.08] bg-black/[.015] p-3.5 dark:border-white/10 dark:bg-white/[.02]">
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">{st.n}</span>
              <h3 className="text-[15px] font-semibold">{st.title}</h3>
              <span className="text-xs text-[var(--text-secondary)]">{st.hint}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {st.tools.map((x) => {
                const t = toolById(x.id)!
                return <ToolCard key={x.id} t={t} phase={phase.id} role={x.role} />
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
        </Card>
        <Card title={<span className="flex items-center gap-2"><CheckCircle2 size={15} /> Revue de fin de phase (tollgate)</span>} subtitle="Pour passer à la phase suivante">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {phase.gate.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </Card>
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

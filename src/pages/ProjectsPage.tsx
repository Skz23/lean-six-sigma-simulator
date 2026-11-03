import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, CheckCircle2, Circle, Copy, FolderOpen, Plus, Trash2, X } from 'lucide-react'
import { useStore, uid, workspaceOf } from '../store/useStore'
import type { DmaicProject, MrpMethod } from '../store/types'
import { Badge, Button, Card, Field, Input, Note, PageHeader, Select, TextArea } from '../components/ui'
import { ProgressBar } from '../components/PhaseNav'
import { ask } from '../lib/dialog'
import { blankScenario } from '../data/realScenario'
import { PHASES } from '../workflow/phases'
import { METHOD_LABEL, emptyProject, isLight, phaseProgress, projectProgress } from '../workflow/project'

const BLANK = '__blank'

const CHOICES: { id: MrpMethod; title: string; when: string }[] = [
  { id: 'dmaic', title: 'DMAIC complet', when: 'Cause inconnue, variabilité, données à analyser. Plusieurs semaines à plusieurs mois. Tous les outils, statistiques comprises.' },
  { id: 'kaizen', title: 'Kaizen / PDCA', when: 'Problème simple, solution à portée de main, traité en quelques jours. Parcours allégé.' },
  { id: 'a3', title: 'A3', when: 'Problème de complexité moyenne, à résumer sur une page. Parcours allégé.' },
  { id: '8d', title: '8D', when: 'Réclamation client ou défaut à contenir vite, puis éradiquer. Parcours allégé.' },
]

export function NewProject({ onClose, blank = false }: { onClose: () => void; blank?: boolean }) {
  const scenarios = useStore((s) => s.scenarios)
  const activeId = useStore((s) => s.activeId)
  const setTools = useStore((s) => s.setTools)
  const duplicateScenario = useStore((s) => s.duplicateScenario)
  const openProject = useStore((s) => s.openProject)
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [problem, setProblem] = useState('')
  const [method, setMethod] = useState<MrpMethod>('dmaic')
  const addScenario = useStore((s) => s.addScenario)
  const [source, setSource] = useState(blank ? BLANK : activeId)
  const [copy, setCopy] = useState(true)

  const create = () => {
    const n = name.trim() || 'Nouveau projet'
    let scId = source
    if (source === BLANK) {
      scId = uid('sc')
      addScenario(blankScenario(scenarios[0], `${n} — ma ligne`, scId))
    } else if (copy) scId = duplicateScenario(source, `${n} — état actuel`)
    const p = emptyProject(uid('dmaic'), n, scId, method, problem.trim())
    setTools((t) => t.dmaic.push(p))
    openProject(p.id)
    nav('/dmaic/define')
  }

  return (
    <Card title="Nouveau projet" actions={<Button size="sm" variant="ghost" onClick={onClose}><X size={14} /></Button>} className="mb-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Nom du projet">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Rebuts au tournage, retards de livraison…" autoFocus />
          </Field>
          <Field label="Le problème en une phrase" hint="Vous le détaillerez ensuite avec le QQOQCPC et la charte.">
            <TextArea rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} />
          </Field>
          <Field label="Ligne de production étudiée (scénario de départ)">
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value={BLANK}>Ligne vierge — je décris ma propre ligne</option>
              {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          {source === BLANK ? (
            <p className="text-xs text-[var(--muted)]">Une ligne de 3 postes génériques est créée. Vous la décrirez en phase Définir (1.3 « Ligne de production ») ou en important vos données (2.3 « Mes données »).</p>
          ) : (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 accent-[var(--color-brand-600)]" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
            <span>
              Créer une copie de ce scénario pour le projet <span className="text-[var(--muted)]">(recommandé)</span>
              <span className="block text-xs text-[var(--muted)]">SMED, Kanban, 5S, spaghetti et réglages auront alors des données propres à ce projet, sans toucher aux autres.</span>
            </span>
          </label>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-sm font-medium">Démarche</div>
          <div className="space-y-2">
            {CHOICES.map((c) => (
              <button
                key={c.id}
                onClick={() => setMethod(c.id)}
                className={clsx('w-full rounded-lg border-2 p-2.5 text-left transition-colors', method === c.id ? 'border-brand-500 bg-brand-500/10' : 'border-transparent ring-1 ring-black/[.08] hover:ring-black/20 dark:ring-white/10')}
              >
                <div className="text-sm font-semibold">{c.title}</div>
                <div className="text-xs text-[var(--text-secondary)]">{c.when}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Hésitation ? L'outil <Link to="/methode/choose" className="text-brand-600 underline">Choisir la démarche</Link> vous aide. Toutes les démarches suivent les 5 phases ; le parcours allégé n'affiche que les outils essentiels (vous pouvez toujours afficher les autres).
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="primary" onClick={create}><Plus size={15} /> Créer et commencer</Button>
      </div>
    </Card>
  )
}

function ProjectCard({ p, current }: { p: DmaicProject; current: boolean }) {
  const scenarios = useStore((s) => s.scenarios)
  const openProject = useStore((s) => s.openProject)
  const setTools = useStore((s) => s.setTools)
  const duplicateScenario = useStore((s) => s.duplicateScenario)
  const nav = useNavigate()
  const prog = projectProgress(p)
  const phase = PHASES.find((x) => x.id === p.phase)!
  const sc = scenarios.find((s) => s.id === p.scenarioId)
  const shared = useStore((s) => s.tools.dmaic.filter((x) => x.scenarioId === p.scenarioId).length > 1)

  const open = () => {
    openProject(p.id)
    nav(`/dmaic/${p.phase}`)
  }
  const duplicate = () => {
    const name = `${p.name} (copie)`
    const scId = sc ? duplicateScenario(p.scenarioId, `${name} — état actuel`) : p.scenarioId
    const c: DmaicProject = { ...structuredClone(p), id: uid('dmaic'), name, scenarioId: scId, createdAt: new Date().toISOString(), ws: structuredClone(workspaceOf(useStore.getState(), p)) }
    setTools((t) => t.dmaic.push(c))
    openProject(c.id)
  }
  const remove = () => {
    if (!ask(`Supprimer le projet « ${p.name} » ? Son scénario reste disponible dans Scénarios.`)) return
    const others = useStore.getState().tools.dmaic.filter((x) => x.id !== p.id)
    if (current && others.length) openProject(others[0].id)
    setTools((t) => {
      t.dmaic = t.dmaic.filter((x) => x.id !== p.id)
    })
  }

  return (
    <div className={clsx('flex flex-col rounded-xl border bg-[var(--surface-1)] p-4 shadow-sm', current ? 'border-brand-500 ring-1 ring-brand-500/40' : 'border-black/[.08] dark:border-white/10')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {current && <Badge tone="brand">En cours</Badge>}
            <Badge tone={isLight(p) ? 'warning' : 'info'}>{METHOD_LABEL[p.method ?? 'dmaic']}</Badge>
          </div>
          <h3 className="mt-1.5 font-semibold">{p.name}</h3>
          {p.charter.problem && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">{p.charter.problem}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {PHASES.map((ph) => {
          const r = phaseProgress(p, ph.id)
          return (
            <Badge key={ph.id} tone={p.gates[ph.id] ? 'good' : ph.id === p.phase ? 'brand' : 'neutral'}>
              {p.gates[ph.id] ? <CheckCircle2 size={11} /> : <Circle size={11} />} {ph.n} {ph.label} {r.done}/{r.total}
            </Badge>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <ProgressBar ratio={prog.ratio} className="flex-1" />
        {Math.round(prog.ratio * 100)} %
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Phase en cours : <b>{phase.n} · {phase.label}</b> · scénario : {sc?.name ?? '—'}
        {shared && ' (partagé avec un autre projet)'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={open}><FolderOpen size={13} /> Continuer</Button>
        <Button size="sm" onClick={() => { openProject(p.id); nav('/sixsigma/dmaic') }}>Espace projet</Button>
        <Button size="sm" variant="ghost" onClick={duplicate} title="Dupliquer"><Copy size={13} /></Button>
        <Button size="sm" variant="ghost" onClick={remove} title="Supprimer"><Trash2 size={13} /></Button>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const projects = useStore((s) => s.tools.dmaic)
  const currentId = useStore((s) => s.currentProjectId) ?? projects[0]?.id
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(params.get('new') === '1' || params.get('new') === 'blank' || projects.length === 0)
  const close = () => {
    setCreating(false)
    if (params.get('new')) setParams({}, { replace: true })
  }
  return (
    <div>
      <PageHeader
        icon={<FolderOpen size={20} />}
        title="Mes projets"
        subtitle="Un projet = un problème traité de bout en bout selon la démarche, avec son avancement et ses données"
        actions={!creating && <Button variant="primary" onClick={() => setCreating(true)}><Plus size={15} /> Nouveau projet</Button>}
      />
      {creating && <NewProject onClose={close} blank={params.get('new') === 'blank'} />}
      {projects.length === 0 ? (
        <Note>Aucun projet pour l'instant. Créez-en un pour commencer la démarche.</Note>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.id} p={p} current={p.id === currentId} />)}
        </div>
      )}
      <p className="mt-6 flex items-center gap-1 text-xs text-[var(--muted)]">
        Le projet en cours se change aussi en haut de l'écran. <ArrowRight size={12} /> Ses outils, son scénario et son avancement suivent partout.
      </p>
    </div>
  )
}

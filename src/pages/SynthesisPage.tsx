import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, FileText, Printer } from 'lucide-react'
import { useCurrentProject, useStore } from '../store/useStore'
import { runScenario } from '../store/useSimulation'
import { Badge, Button, Card, Delta, Note, PageHeader, Table } from '../components/ui'
import { PhaseStrip, ProgressBar } from '../components/PhaseNav'
import { ProjectExports } from '../components/ProjectExports'
import { PHASES } from '../workflow/phases'
import { METHOD_LABEL, phaseProgress, projectProgress } from '../workflow/project'
import { chosenSolutions, phaseResults, rootCauses } from '../report/projectContent'
import { duration, eur, fmt, fmtFixed, pct } from '../lib/format'

/** Synthèse du projet lisible en deux minutes (professeur, manager, revue). */
export default function SynthesisPage() {
  const p = useCurrentProject()
  const scenarios = useStore((s) => s.scenarios)
  if (!p) return <Note>Aucun projet. <Link to="/projets?new=1" className="underline">Créez-en un</Link>.</Note>
  const ch = p.charter
  const prog = projectProgress(p)
  const before = scenarios.find((s) => s.id === p.scenarioId)
  const after = scenarios.find((s) => s.id === p.improvedScenarioId)
  const kb = before && runScenario(before).kpis
  const ka = after && runScenario(after).kpis
  const causes = rootCauses(p)
  const sols = chosenSolutions(p)
  const block = (title: string, text: string) => (
    <div>
      <div className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{title}</div>
      <p className="mt-0.5 text-sm whitespace-pre-line">{text.trim() || <span className="text-[var(--muted)]">À compléter dans la charte.</span>}</p>
    </div>
  )

  return (
    <div>
      <PageHeader
        icon={<FileText size={20} />}
        title={`Synthèse — ${p.name}`}
        subtitle={`${METHOD_LABEL[p.method ?? 'dmaic']} · ${[ch.leader && `pilote ${ch.leader}`, ch.sponsor && `sponsor ${ch.sponsor}`, ch.startDate && `depuis le ${ch.startDate}`].filter(Boolean).join(' · ')}`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <ProjectExports />
            <Button size="sm" onClick={() => window.print()}><Printer size={13} /> Imprimer</Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Le problème" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {block('Problème', ch.problem)}
            {block('Enjeu', ch.businessCase)}
            {block('Objectif', [ch.goal, ch.targetMetric && `Cible : ${ch.targetMetric}`, ch.endDate && `Échéance : ${ch.endDate}`].filter(Boolean).join('\n'))}
            {block('Périmètre', ch.scope)}
          </div>
        </Card>
        <Card title="Avancement">
          <div className="mb-1 flex justify-between text-sm">
            <span>{prog.done} / {prog.total} outils faits</span>
            <b>{Math.round(prog.ratio * 100)} %</b>
          </div>
          <ProgressBar ratio={prog.ratio} />
          <ul className="mt-3 space-y-1.5 text-sm">
            {PHASES.map((ph) => {
              const r = phaseProgress(p, ph.id)
              return (
                <li key={ph.id} className="flex items-center gap-2">
                  {p.gates[ph.id] ? <CheckCircle2 size={15} className="text-[var(--good)]" /> : <Circle size={15} className={ph.id === p.phase ? 'text-amber-500' : 'text-[var(--muted)]'} />}
                  <span className="flex-1">{ph.n}. {ph.label}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{r.done}/{r.total}</span>
                  {p.gates[ph.id] ? <Badge tone="good">revue validée</Badge> : ph.id === p.phase ? <Badge tone="warning">en cours</Badge> : null}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <div className="no-print mt-4">
        <PhaseStrip compact gates={p.gates} ongoing={p.phase} current={p.phase} />
      </div>

      <Card title="Résultats obtenus" subtitle="Situation de départ du projet comparée au scénario amélioré" className="mt-4">
        {kb && ka && before && after ? (
          <Table
            dense
            head={['Indicateur', `Départ (${before.name})`, `Après (${after.name})`, 'Écart']}
            rows={[
              ['Pièces bonnes / jour', fmt(kb.good, 0), fmt(ka.good, 0), <Delta key="1" a={kb.good} b={ka.good} up />],
              ['Taux de défauts', pct(1 - kb.yield, 2), pct(1 - ka.yield, 2), <Delta key="2" a={1 - kb.yield} b={1 - ka.yield} />],
              ['Lead Time', duration(kb.leadTime), duration(ka.leadTime), <Delta key="3" a={kb.leadTime} b={ka.leadTime} />],
              ['TRS', pct(kb.oee, 1), pct(ka.oee, 1), <Delta key="4" a={kb.oee} b={ka.oee} up />],
              ['Cpk', fmtFixed(kb.dimension?.cpk, 2), fmtFixed(ka.dimension?.cpk, 2), <Delta key="5" a={kb.dimension?.cpk ?? NaN} b={ka.dimension?.cpk ?? NaN} up />],
              ['Marge / jour', eur(kb.costs.margin), eur(ka.costs.margin), <Delta key="6" a={kb.costs.margin} b={ka.costs.margin} up />],
              ['Gain annuel estimé', '', <b key="g">{eur((ka.costs.margin - kb.costs.margin) * after.costs.workingDaysPerYear)}</b>, ''],
            ]}
          />
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Pas encore de scénario amélioré : choisissez-le dans l'<Link to="/sixsigma/dmaic" className="text-brand-600 underline">espace projet</Link> (champ « Scénario amélioré ») pour afficher les gains.
          </p>
        )}
        <p className="mt-2 text-[11px] text-[var(--muted)]">Valeurs simulées sur une journée avec les mêmes aléas ; confirmez par la mesure réelle en phase Contrôler.</p>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Causes racines">
          {causes.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{causes.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="text-sm text-[var(--muted)]">Pas encore identifiées (phase Analyser).</p>}
        </Card>
        <Card title="Solutions retenues">
          {sols.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{sols.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="text-sm text-[var(--muted)]">Pas encore choisies (phase Innover).</p>}
        </Card>
      </div>

      <Card title="Résultats retenus, phase par phase" className="mt-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PHASES.map((ph) => {
            const rs = phaseResults(p, ph.id)
            return (
              <div key={ph.id}>
                <div className="text-sm font-semibold">{ph.n}. {ph.label}</div>
                {rs.length ? (
                  <ul className="mt-1 space-y-0.5 text-sm">{rs.map((r) => <li key={r}>{r}</li>)}</ul>
                ) : (
                  <p className="mt-1 text-xs text-[var(--muted)]">Aucun résultat noté.</p>
                )}
              </div>
            )
          })}
        </div>
      </Card>
      {p.controlPlan.length > 0 && (
        <Card title="Pérennisation" className="mt-4">
          <p className="text-sm">{p.controlPlan.length} caractéristique(s) sous surveillance : {p.controlPlan.map((c) => c.characteristic).filter(Boolean).join(', ')}.</p>
        </Card>
      )}
    </div>
  )
}

import { ask } from '../../lib/dialog'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ClipboardList, Copy, Plus, Trash2 } from 'lucide-react'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { useStore, uid } from '../../store/useStore'
import { runScenario } from '../../store/useSimulation'
import type { DmaicPhase, DmaicProject, SipocRow } from '../../store/types'
import { Badge, Button, Card, Delta, Field, Input, Kpi, Note, NumberInput, PageHeader, Select, Stat, Table, TextArea } from '../../components/ui'
import { ChartBox, ControlChartView, ParetoChart, S, axisProps, tooltipStyle } from '../../components/charts'
import { FiveWhyEditor, IshikawaDiagram, IshikawaEditor } from '../../components/QualityTools'
import { DoeTool } from '../../components/DoeTool'
import { sigmaMetrics } from '../../stats/sigma'
import { pearson } from '../../stats/inference'
import { imrChart, pChart } from '../../stats/spc'
import { summarize } from '../../stats/descriptive'
import { replicate } from '../../engine/simulation'
import { computeKpis } from '../../engine/kpi'
import { demoDmaic } from '../../data/demoTools'
import { fmt, fmtFixed, pct, eur } from '../../lib/format'

const PHASES: { id: DmaicPhase; label: string; desc: string }[] = [
  { id: 'define', label: 'Define', desc: 'Définir le problème, le client et les objectifs' },
  { id: 'measure', label: 'Measure', desc: 'Mesurer la performance actuelle' },
  { id: 'analyze', label: 'Analyze', desc: 'Identifier et vérifier les causes racines' },
  { id: 'improve', label: 'Improve', desc: 'Tester et sélectionner les solutions' },
  { id: 'control', label: 'Control', desc: 'Pérenniser les gains' },
]

export default function DmaicPage() {
  const projects = useStore((s) => s.tools.dmaic)
  const setTools = useStore((s) => s.setTools)
  const scenarios = useStore((s) => s.scenarios)
  const activeId = useStore((s) => s.activeId)
  const [sel, setSel] = useState<string | undefined>(projects[0]?.id)
  const p = projects.find((x) => x.id === sel)
  const set = (fn: (p: DmaicProject) => void) =>
    setTools((t) => {
      const x = t.dmaic.find((y) => y.id === sel)
      if (x) fn(x)
    })

  const create = () => {
    const base = demoDmaic(activeId)
    const np: DmaicProject = {
      ...base,
      id: uid('dmaic'),
      name: 'Nouveau projet DMAIC',
      phase: 'define',
      charter: { ...base.charter, problem: '', businessCase: '', goal: '', scope: '', baselineMetric: '', targetMetric: '' },
      voc: [],
      sipoc: [],
      causes: [],
      whys: [],
      solutions: [],
      controlPlan: [],
      gates: { define: false, measure: false, analyze: false, improve: false, control: false },
    }
    setTools((t) => t.dmaic.push(np))
    setSel(np.id)
  }

  return (
    <div>
      <PageHeader
        icon={<ClipboardList size={20} />}
        title="Projets DMAIC"
        subtitle="Espace de conduite de projet Six Sigma : Define · Measure · Analyze · Improve · Control"
        actions={
          <>
            <Select value={sel} onChange={(e) => setSel(e.target.value)} className="w-80">
              {projects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
            <Button variant="primary" onClick={create}>
              <Plus size={15} /> Nouveau projet
            </Button>
          </>
        }
      />
      {!p ? (
        <Card>Aucun projet. Créez-en un.</Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-5 gap-1.5">
            {PHASES.map((ph, i) => (
              <button
                key={ph.id}
                onClick={() => set((x) => (x.phase = ph.id))}
                className={clsx(
                  'relative rounded-lg border-2 px-2 py-2 text-left transition-colors',
                  p.phase === ph.id ? 'border-brand-500 bg-brand-500/10' : 'border-transparent bg-[var(--surface-1)] ring-1 ring-black/[.08] hover:ring-black/20 dark:ring-white/10',
                )}
              >
                <div className="flex items-center gap-1.5">
                  {p.gates[ph.id] ? <CheckCircle2 size={15} className="text-[var(--good)]" /> : <Circle size={15} className="text-[var(--muted)]" />}
                  <span className="text-sm font-semibold">
                    {i + 1}. {ph.label}
                  </span>
                </div>
                <div className="mt-0.5 hidden text-[11px] text-[var(--muted)] md:block">{ph.desc}</div>
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <Field label="Nom du projet" className="min-w-72 flex-1">
              <Input value={p.name} onChange={(e) => set((x) => (x.name = e.target.value))} />
            </Field>
            <Field label="Scénario de référence (données)">
              <Select value={p.scenarioId} onChange={(e) => set((x) => (x.scenarioId = e.target.value))} className="w-56">
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Scénario amélioré">
              <Select value={p.improvedScenarioId ?? ''} onChange={(e) => set((x) => (x.improvedScenarioId = e.target.value || undefined))} className="w-56">
                <option value="">— non défini —</option>
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <div className="flex items-end gap-2 pt-5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[var(--color-brand-600)]" checked={p.gates[p.phase]} onChange={(e) => set((x) => (x.gates[x.phase] = e.target.checked))} />
                Revue de phase « {PHASES.find((x) => x.id === p.phase)!.label} » validée
              </label>
              <Button size="sm" variant="danger" onClick={() => { if (ask('Supprimer ce projet ?')) { setTools((t) => { t.dmaic = t.dmaic.filter((x) => x.id !== p.id) }); setSel(projects.find((x) => x.id !== p.id)?.id) } }}>
                <Trash2 size={13} />
              </Button>
            </div>
          </div>
          {p.phase === 'define' && <Define p={p} set={set} />}
          {p.phase === 'measure' && <Measure p={p} />}
          {p.phase === 'analyze' && <Analyze p={p} set={set} />}
          {p.phase === 'improve' && <Improve p={p} set={set} />}
          {p.phase === 'control' && <Control p={p} set={set} />}
          <Card title="Notes de phase" className="mt-4">
            <TextArea rows={3} value={p.notes[p.phase]} onChange={(e) => set((x) => (x.notes[x.phase] = e.target.value))} placeholder="Décisions, constats, points ouverts…" />
          </Card>
        </>
      )}
    </div>
  )
}

type SetFn = (fn: (p: DmaicProject) => void) => void

function Define({ p, set }: { p: DmaicProject; set: SetFn }) {
  const ch = p.charter
  const f = (k: keyof DmaicProject['charter'], label: string, area = false) => (
    <Field label={label}>
      {area ? <TextArea rows={3} value={ch[k]} onChange={(e) => set((x) => (x.charter[k] = e.target.value))} /> : <Input value={ch[k]} onChange={(e) => set((x) => (x.charter[k] = e.target.value))} />}
    </Field>
  )
  const sipocKeys: (keyof SipocRow)[] = ['supplier', 'input', 'process', 'output', 'customer']
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Charte projet">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{f('problem', 'Énoncé du problème', true)}</div>
          <div className="sm:col-span-2">{f('businessCase', 'Enjeu (business case)', true)}</div>
          <div className="sm:col-span-2">{f('goal', 'Objectif SMART', true)}</div>
          <div className="sm:col-span-2">{f('scope', 'Périmètre')}</div>
          {f('baselineMetric', 'Situation de départ')}
          {f('targetMetric', 'Cible')}
          {f('sponsor', 'Sponsor')}
          {f('leader', 'Chef de projet')}
          <div className="sm:col-span-2">{f('team', 'Équipe')}</div>
          <Field label="Début"><Input type="date" value={ch.startDate} onChange={(e) => set((x) => (x.charter.startDate = e.target.value))} /></Field>
          <Field label="Fin prévue"><Input type="date" value={ch.endDate} onChange={(e) => set((x) => (x.charter.endDate = e.target.value))} /></Field>
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Voix du client (VOC) → CTQ" actions={<Button size="sm" onClick={() => set((x) => x.voc.push({ id: uid('v'), voice: '', need: '', ctq: '', measure: '', target: '' }))}><Plus size={13} /> VOC</Button>}>
          <div className="space-y-2">
            {p.voc.map((v, i) => (
              <div key={v.id} className="grid grid-cols-2 gap-1.5 rounded-lg border border-black/[.06] p-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_28px] dark:border-white/10">
                <Input placeholder="Verbatim client" value={v.voice} onChange={(e) => set((x) => (x.voc[i].voice = e.target.value))} />
                <Input placeholder="Besoin" value={v.need} onChange={(e) => set((x) => (x.voc[i].need = e.target.value))} />
                <Input placeholder="CTQ" value={v.ctq} onChange={(e) => set((x) => (x.voc[i].ctq = e.target.value))} />
                <Input placeholder="Mesure" value={v.measure} onChange={(e) => set((x) => (x.voc[i].measure = e.target.value))} />
                <Input placeholder="Cible" value={v.target} onChange={(e) => set((x) => (x.voc[i].target = e.target.value))} />
                <button onClick={() => set((x) => x.voc.splice(i, 1))} className="text-[var(--muted)] hover:text-[var(--critical)]" aria-label="Supprimer"><Trash2 size={13} /></button>
              </div>
            ))}
            <p className="text-[11px] text-[var(--muted)]">Verbatim → besoin → caractéristique critique mesurable (CTQ) → cible.</p>
          </div>
        </Card>
        <Card title="SIPOC" subtitle="Suppliers · Inputs · Process · Outputs · Customers" actions={<Button size="sm" onClick={() => set((x) => x.sipoc.push({ supplier: '', input: '', process: '', output: '', customer: '' }))}><Plus size={13} /> Ligne</Button>}>
          <div className="overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-[repeat(5,1fr)_24px] gap-1.5 text-xs">
              {['Fournisseurs', 'Entrées', 'Processus', 'Sorties', 'Clients', ''].map((h) => (
                <div key={h} className="font-semibold text-[var(--text-secondary)]">{h}</div>
              ))}
              {p.sipoc.map((r, i) => (
                <div key={i} className="contents">
                  {sipocKeys.map((k) => (
                    <Input key={k} value={r[k]} onChange={(e) => set((x) => (x.sipoc[i][k] = e.target.value))} className="text-xs" />
                  ))}
                  <button onClick={() => set((x) => x.sipoc.splice(i, 1))} className="text-[var(--muted)] hover:text-[var(--critical)]" aria-label="Supprimer"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Measure({ p }: { p: DmaicProject }) {
  const scenarios = useStore((s) => s.scenarios)
  const sc = scenarios.find((s) => s.id === p.scenarioId) ?? scenarios[0]
  const { results: r, kpis: k } = runScenario(sc)
  const [opps, setOpps] = useState(1)
  const dims = r.products.filter((x) => x.dimension !== undefined).map((x) => x.dimension!)
  const s = dims.length > 3 ? summarize(dims) : null
  const out = r.good + r.scrap
  const sm = sigmaMetrics(r.scrap, out, opps)
  const smDim = sigmaMetrics(k.dimensionNc, k.measured, 1)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Kpi label="Unités produites" value={out} />
        <Kpi label="Défectueux" value={r.scrap} tone="critical" />
        <Kpi label="DPMO (global)" value={fmt(sm.dpmo, 0)} />
        <Kpi label="Niveau sigma (global)" value={fmtFixed(sm.sigmaLevel, 2)} unit="σ" />
        <Kpi label="DPMO diamètre" value={fmt(smDim.dpmo, 0)} />
        <Kpi label="Niveau sigma diamètre" value={fmtFixed(smDim.sigmaLevel, 2)} unit="σ" />
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Collecte de données" subtitle={`Source : simulation du scénario « ${sc.name} » — ${dims.length} mesures`} className="xl:col-span-7">
          {s && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Moyenne" value={fmtFixed(s.mean, 4)} />
              <Stat label="Écart-type" value={fmtFixed(s.stdDev, 5)} />
              <Stat label="Variance" value={s.variance.toExponential(3)} />
              <Stat label="Étendue" value={fmtFixed(s.range, 4)} />
              <Stat label="Cp" value={fmtFixed(k.dimension?.cp, 2)} />
              <Stat label="Cpk" value={fmtFixed(k.dimension?.cpk, 2)} />
              <Stat label="Pp" value={fmtFixed(k.dimension?.pp, 2)} />
              <Stat label="Ppk" value={fmtFixed(k.dimension?.ppk, 2)} />
            </div>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">
            Analyse détaillée : <Link className="text-brand-600 underline" to="/sixsigma/capability">capabilité</Link> · <Link className="text-brand-600 underline" to="/sixsigma/spc">cartes de contrôle</Link>.
          </p>
        </Card>
        <Card title="Calcul du DPMO" className="xl:col-span-5">
          <Field label="Opportunités de défaut par unité" hint="Nombre de CTQ contrôlés par pièce">
            <NumberInput value={opps} min={1} step={1} onChange={(v) => setOpps(Math.round(v))} />
          </Field>
          <Table
            className="mt-3"
            dense
            head={['Indicateur', 'Formule', 'Valeur']}
            rows={[
              ['DPU', 'D / U', fmtFixed(sm.dpu, 4)],
              ['DPO', 'D / (U × O)', fmtFixed(sm.dpo, 5)],
              ['DPMO', 'DPO × 10⁶', fmt(sm.dpmo, 0)],
              ['Rendement', '1 − DPO', pct(sm.yield, 2)],
              ['Z long terme', 'Φ⁻¹(1 − DPO)', fmtFixed(sm.zLongTerm, 2)],
              ['Niveau sigma', 'Z + 1,5', fmtFixed(sm.sigmaLevel, 2)],
            ]}
          />
          <p className="mt-2 text-[11px] text-[var(--muted)]">Le décalage de 1,5σ est une convention (dérive long terme supposée) ; il est indiqué explicitement.</p>
        </Card>
      </div>
      <Card title="Analyse des défauts mesurés">
        <ParetoChart items={k.defectsByType.map((d) => ({ label: d.type, count: d.count }))} height={260} />
      </Card>
    </div>
  )
}

function Analyze({ p, set }: { p: DmaicProject; set: SetFn }) {
  const scenarios = useStore((s) => s.scenarios)
  const sc = scenarios.find((s) => s.id === p.scenarioId) ?? scenarios[0]
  const { results: r } = runScenario(sc)
  const d = r.products.filter((x) => x.dimension !== undefined)
  const corrs = (['temperature', 'pressure', 'speed'] as const).map((k) => ({ k, c: pearson(d.map((x) => x.params![k]), d.map((x) => x.dimension!)) }))
  const names = { temperature: 'Température', pressure: 'Pression', speed: 'Vitesse' }
  return (
    <div className="space-y-4">
      <Card title="Diagramme d'Ishikawa">
        <IshikawaDiagram effect={p.charter.problem.split('.')[0].slice(0, 60) || p.name} causes={p.causes} />
        <div className="mt-3">
          <IshikawaEditor causes={p.causes} onChange={(c) => set((x) => (x.causes = c))} />
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="5 Pourquoi">
          <FiveWhyEditor chains={p.whys} onChange={(w) => set((x) => (x.whys = w))} />
        </Card>
        <Card title="Vérification statistique des causes" subtitle="Corrélation de chaque paramètre avec le diamètre (données simulées)">
          <Table dense head={['Paramètre', 'r', 'R²', 'p-valeur', 'Conclusion']} rows={corrs.map(({ k, c }) => [names[k], fmtFixed(c.r, 3), pct(c.r2, 1), c.pValue < 0.0001 ? '< 0,0001' : fmtFixed(c.pValue, 4), c.pValue < 0.05 ? <Badge key="s" tone="critical">cause confirmée</Badge> : <Badge key="n">non confirmée</Badge>])} />
          <div className="mt-3">
            <Note tone="tip">
              Une corrélation significative confirme qu'un paramètre <i>transmet</i> sa variation au diamètre. Elle ne dit pas tout : un décalage de consigne (moyenne décentrée) ne se voit pas dans r. Utilisez le DOE (phase Improve) pour quantifier l'effet des consignes. Outils complémentaires : <Link className="underline" to="/sixsigma/stats">régression, ANOVA par lot</Link>.
            </Note>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Improve({ p, set }: { p: DmaicProject; set: SetFn }) {
  const scenarios = useStore((s) => s.scenarios)
  const duplicate = useStore((s) => s.duplicateScenario)
  const setActive = useStore((s) => s.setActive)
  const base = scenarios.find((s) => s.id === p.scenarioId) ?? scenarios[0]
  const imp = scenarios.find((s) => s.id === p.improvedScenarioId)
  const kb = runScenario(base).kpis
  const ki = imp ? runScenario(imp).kpis : null
  const score = (s: DmaicProject['solutions'][number]) => (s.impact * 2) / (s.effort + s.cost + s.risk)
  return (
    <div className="space-y-4">
      <Card title="Propositions de solutions — matrice de sélection" subtitle="Score = 2 × impact / (effort + coût + risque) · notes de 1 à 5" actions={<Button size="sm" onClick={() => set((x) => x.solutions.push({ id: uid('s'), label: 'Nouvelle solution', impact: 3, effort: 3, cost: 3, risk: 3, selected: false }))}><Plus size={13} /> Solution</Button>}>
        <div className="space-y-2">
          <div className="hidden grid-cols-[28px_1fr_80px_80px_80px_80px_70px_28px] gap-2 text-[11px] font-medium text-[var(--muted)] md:grid">
            <span /><span>Solution</span><span>Impact</span><span>Effort</span><span>Coût</span><span>Risque</span><span>Score</span><span />
          </div>
          {[...p.solutions].sort((a, b) => score(b) - score(a)).map((s) => {
            const i = p.solutions.findIndex((x) => x.id === s.id)
            return (
              <div key={s.id} className="grid grid-cols-[28px_1fr] items-center gap-2 md:grid-cols-[28px_1fr_80px_80px_80px_80px_70px_28px]">
                <input type="checkbox" checked={s.selected} className="accent-[var(--color-brand-600)]" onChange={(e) => set((x) => (x.solutions[i].selected = e.target.checked))} title="Retenue" />
                <Input value={s.label} onChange={(e) => set((x) => (x.solutions[i].label = e.target.value))} />
                {(['impact', 'effort', 'cost', 'risk'] as const).map((k) => (
                  <NumberInput key={k} value={s[k]} min={1} max={5} step={1} onChange={(v) => set((x) => (x.solutions[i][k] = Math.round(v)))} />
                ))}
                <Badge tone={score(s) >= 1.5 ? 'good' : score(s) >= 0.8 ? 'warning' : 'neutral'}>{fmtFixed(score(s), 2)}</Badge>
                <button onClick={() => set((x) => x.solutions.splice(i, 1))} className="text-[var(--muted)] hover:text-[var(--critical)]" aria-label="Supprimer"><Trash2 size={13} /></button>
              </div>
            )
          })}
        </div>
      </Card>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Plan d'expériences sur le scénario « {base.name} »</h3>
        <DoeTool sc={base} />
      </div>
      <Card
        title="Simulation des changements et comparaison"
        subtitle="Créez une copie du scénario de référence, appliquez-y les solutions (paramètres procédé, ligne…), puis comparez"
        actions={
          <Button
            onClick={() => {
              const id = duplicate(base.id, `${base.name} — ${p.name.slice(0, 30)} (amélioré)`)
              set((x) => (x.improvedScenarioId = id))
              setActive(id)
            }}
          >
            <Copy size={14} /> Créer le scénario amélioré
          </Button>
        }
      >
        {ki ? (
          <Table
            dense
            head={['Indicateur', base.name, imp!.name, 'Écart']}
            rows={[
              ['Cpk diamètre', fmtFixed(kb.dimension?.cpk, 2), fmtFixed(ki.dimension?.cpk, 2), <Delta key="1" a={kb.dimension?.cpk ?? NaN} b={ki.dimension?.cpk ?? NaN} up />],
              ['Ppk diamètre', fmtFixed(kb.dimension?.ppk, 2), fmtFixed(ki.dimension?.ppk, 2), <Delta key="2" a={kb.dimension?.ppk ?? NaN} b={ki.dimension?.ppk ?? NaN} up />],
              ['σ diamètre (µm)', fmtFixed((kb.dimension?.sigmaOverall ?? NaN) * 1000, 1), fmtFixed((ki.dimension?.sigmaOverall ?? NaN) * 1000, 1), <Delta key="3" a={kb.dimension?.sigmaOverall ?? NaN} b={ki.dimension?.sigmaOverall ?? NaN} />],
              ['DPMO', fmt(kb.sigma.dpmo, 0), fmt(ki.sigma.dpmo, 0), <Delta key="4" a={kb.sigma.dpmo} b={ki.sigma.dpmo} />],
              ['Niveau sigma', fmtFixed(kb.sigma.sigmaLevel, 2), fmtFixed(ki.sigma.sigmaLevel, 2), <Delta key="5" a={kb.sigma.sigmaLevel} b={ki.sigma.sigmaLevel} up />],
              ['Pièces bonnes / jour', fmt(kb.good, 0), fmt(ki.good, 0), <Delta key="6" a={kb.good} b={ki.good} up />],
              ['Coût de non-qualité / jour', eur(kb.costs.copq), eur(ki.costs.copq), <Delta key="7" a={kb.costs.copq} b={ki.costs.copq} />],
            ]}
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">Aucun scénario amélioré associé. Créez-le, puis modifiez-le dans « Paramètres procédé » ou appliquez le réglage DOE (le scénario créé devient le scénario actif).</p>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">Solution(s) retenue(s) : {p.solutions.filter((s) => s.selected).map((s) => s.label).join(' · ') || 'aucune'}</p>
      </Card>
    </div>
  )
}

function Control({ p, set }: { p: DmaicProject; set: SetFn }) {
  const scenarios = useStore((s) => s.scenarios)
  const sc = scenarios.find((s) => s.id === (p.improvedScenarioId ?? p.scenarioId)) ?? scenarios[0]
  const { results: r } = runScenario(sc)
  const dims = r.products.filter((x) => x.dimension !== undefined).sort((a, b) => a.id - b.id).map((x) => x.dimension!)
  const imr = dims.length > 10 ? imrChart(dims, [1, 2, 3, 5]) : null
  const days = useMemo(() => replicate(sc, 10).map((res) => ({ res, k: computeKpis(sc, res) })), [sc])
  const pc = pChart(days.map((d) => d.res.scrap), days.map((d) => d.res.scrap + d.res.good), [1, 2, 3])
  const c = sc.process.characteristic
  const upd = (i: number, k: keyof DmaicProject['controlPlan'][number], v: string) => set((x) => ((x.controlPlan[i] as unknown as Record<string, string>)[k] = v))
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Carte I-MR du diamètre — ${sc.name}`} subtitle="Surveillance de la caractéristique après amélioration">
          {imr && <ControlChartView series={imr.primary} spec={{ lsl: c.lsl, usl: c.usl }} digits={4} xLabel="Pièce" height={240} />}
          <p className="mt-1 text-xs text-[var(--muted)]">{imr?.primary.signals.length ? `${imr.primary.signals.length} signaux de dérive détectés.` : 'Aucune dérive détectée.'}</p>
        </Card>
        <Card title="Suivi dans le temps — 10 journées simulées" subtitle="Graines indépendantes : variabilité naturelle d'un jour à l'autre">
          <ChartBox height={200}>
            <LineChart data={days.map((d, i) => ({ j: `J${i + 1}`, cpk: d.k.dimension?.cpk, good: d.k.good }))} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="j" {...axisProps} />
              <YAxis {...axisProps} domain={['auto', 'auto']} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [fmt(Number(v), 2), n]} />
              <Legend verticalAlign="top" height={22} iconSize={10} />
              <Line dataKey="cpk" name="Cpk journalier" stroke={S(0)} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ChartBox>
          <ControlChartView series={pc.primary} digits={4} xLabel="Jour" height={180} />
          <p className="text-xs text-[var(--muted)]">Carte p du taux de rebut journalier : {pc.primary.signals.length ? 'dérive détectée' : 'stable'} (p̄ = {pct(pc.primary.center, 2)}).</p>
        </Card>
      </div>
      <Card title="Plan de contrôle" actions={<Button size="sm" onClick={() => set((x) => x.controlPlan.push({ id: uid('cp'), characteristic: '', spec: '', method: '', frequency: '', sampleSize: '', chart: '', reaction: '', owner: '' }))}><Plus size={13} /> Ligne</Button>}>
        <div className="overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-[repeat(8,1fr)_24px] gap-1.5 text-xs">
            {['Caractéristique', 'Spécification', 'Moyen de mesure', 'Fréquence', 'Échantillon', 'Carte', 'Réaction', 'Responsable', ''].map((h) => (
              <div key={h} className="font-semibold text-[var(--text-secondary)]">{h}</div>
            ))}
            {p.controlPlan.map((row, i) => (
              <div key={row.id} className="contents">
                {(['characteristic', 'spec', 'method', 'frequency', 'sampleSize', 'chart', 'reaction', 'owner'] as const).map((k) => (
                  <Input key={k} value={row[k]} onChange={(e) => upd(i, k, e.target.value)} className="text-xs" />
                ))}
                <button onClick={() => set((x) => x.controlPlan.splice(i, 1))} className="text-[var(--muted)] hover:text-[var(--critical)]" aria-label="Supprimer"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card title="Suivi des indicateurs du projet">
        <Table
          dense
          head={['Jour', 'Pièces bonnes', 'Rebuts', 'Taux de défauts', 'Cpk', 'Ppk', 'TRS']}
          rows={days.map((d, i) => [`J${i + 1}`, d.k.good, d.k.scrap, pct(1 - d.k.yield, 2), fmtFixed(d.k.dimension?.cpk, 2), fmtFixed(d.k.dimension?.ppk, 2), pct(d.k.oee, 1)])}
        />
      </Card>
    </div>
  )
}

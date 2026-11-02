import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, Combine, CheckCircle2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { runScenario } from '../store/useSimulation'
import { METRICS, profitability, type MetricGroup } from '../engine/compare'
import { replicate } from '../engine/simulation'
import { computeKpis, type Kpis } from '../engine/kpi'
import { analyzeMuda } from '../lean/muda'
import { Badge, Card, Delta, Kpi, Note, PageHeader, Select, Table, Toggle } from '../components/ui'
import { ChartBox, S, axisProps, tooltipStyle } from '../components/charts'
import { eur, fmt, fmtFixed, pct } from '../lib/format'
import { mean, stdDev } from '../stats/descriptive'
import { tInv } from '../stats/distributions'
import type { Scenario } from '../engine/types'

const GROUPS: { id: MetricGroup; label: string }[] = [
  { id: 'lean', label: 'Gains Lean' },
  { id: 'sixsigma', label: 'Gains Six Sigma' },
  { id: 'combined', label: 'Gains combinés' },
]

function useKpiSamples(sc: Scenario, reps: number): Kpis[] {
  return useMemo(() => (reps <= 1 ? [runScenario(sc).kpis] : replicate(sc, reps).map((r) => computeKpis(sc, r))), [sc, reps])
}

export default function LssPage() {
  const scenarios = useStore((s) => s.scenarios)
  const baselineId = useStore((s) => s.baselineId)
  const comparisonId = useStore((s) => s.comparisonId)
  const setBaseline = useStore((s) => s.setBaseline)
  const setComparison = useStore((s) => s.setComparison)
  const projects = useStore((s) => s.tools.dmaic)
  const [robust, setRobust] = useState(false)
  const base = scenarios.find((s) => s.id === baselineId) ?? scenarios[0]
  const after = scenarios.find((s) => s.id === comparisonId) ?? scenarios[scenarios.length - 1]
  const reps = robust ? 8 : 1
  const kbS = useKpiSamples(base, reps)
  const kaS = useKpiSamples(after, reps)
  const kb = kbS[0]
  const rb = runScenario(base)
  const prof = profitability(runScenario(base).kpis, runScenario(after).kpis, base, after)
  const mudaCount = analyzeMuda(base, rb.results, rb.kpis).filter((m) => m.severity !== 'faible').length
  const proj = projects[0]

  const stat = (samples: Kpis[], sc: Scenario, get: (k: Kpis, s: Scenario) => number) => {
    const v = samples.map((k) => get(k, sc)).filter(Number.isFinite)
    if (v.length <= 1) return { m: v[0] ?? NaN, ci: NaN }
    return { m: mean(v), ci: (tInv(0.975, v.length - 1) * stdDev(v)) / Math.sqrt(v.length) }
  }

  const steps = [
    { n: 1, title: 'Analyser les flux (Lean)', done: true, to: '/lean/vsm', info: `Lead Time ${fmt(kb.leadTime / 60, 0)} min · ${mudaCount} gaspillages significatifs · goulot : ${rb.results.stations[rb.results.bottleneckIndex].name}` },
    { n: 2, title: 'Identifier la variabilité (Six Sigma)', done: true, to: '/sixsigma/capability', info: `Cpk ${fmtFixed(kb.dimension?.cpk, 2)} · Ppk ${fmtFixed(kb.dimension?.ppk, 2)} · ${fmt(kb.sigma.dpmo, 0)} DPMO` },
    { n: 3, title: 'Définir un projet DMAIC', done: !!proj, to: '/sixsigma/dmaic', info: proj ? `${proj.name} — phase ${proj.phase}` : 'Aucun projet' },
    { n: 4, title: 'Tester des améliorations', done: scenarios.length > 1, to: '/scenarios', info: `${scenarios.length} scénarios disponibles (SMED, kanban, DOE, paramètres…)` },
    { n: 5, title: 'Comparer les résultats', done: base.id !== after.id, to: '#compare', info: `${base.name} → ${after.name}` },
    { n: 6, title: 'Mesurer les gains globaux', done: Number.isFinite(prof.annualGain), to: '#gains', info: `Gain annuel ${eur(prof.annualGain)} · ROI ${Number.isFinite(prof.roi) ? fmt(prof.roi * 100, 0) + ' %' : '—'}` },
  ]

  const allRuns = scenarios.map((s) => ({ s, k: runScenario(s).kpis }))

  return (
    <div>
      <PageHeader icon={<Combine size={20} />} title="Lean Six Sigma" subtitle="Projet complet d'amélioration continue : flux (Lean) + variabilité (Six Sigma) → gains mesurés" />
      <div className="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {steps.map((s) => {
          const inner = (
            <div className={clsx('h-full rounded-xl border bg-[var(--surface-1)] p-3 transition-colors hover:border-brand-500', 'border-black/[.08] dark:border-white/10')}>
              <div className="flex items-center gap-2">
                <span className={clsx('grid h-6 w-6 place-items-center rounded-full text-xs font-bold', s.done ? 'bg-brand-600 text-white' : 'bg-black/10 dark:bg-white/10')}>{s.done ? <CheckCircle2 size={14} /> : s.n}</span>
                <span className="text-sm font-semibold">{s.title}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">{s.info}</p>
            </div>
          )
          return s.to.startsWith('#') ? <a key={s.n} href={undefined} onClick={() => document.getElementById(s.to.slice(1))?.scrollIntoView({ behavior: 'smooth' })} className="cursor-pointer">{inner}</a> : <Link key={s.n} to={s.to}>{inner}</Link>
        })}
      </div>

      <Card className="mb-4" bodyClass="flex flex-wrap items-center gap-3 p-3">
        <span className="text-sm text-[var(--text-secondary)]">Avant</span>
        <Select value={base.id} onChange={(e) => setBaseline(e.target.value)} className="w-56">
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <ArrowRight size={16} className="text-[var(--muted)]" />
        <span className="text-sm text-[var(--text-secondary)]">Après</span>
        <Select value={after.id} onChange={(e) => setComparison(e.target.value)} className="w-56">
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <div className="ml-auto">
          <Toggle checked={robust} onChange={setRobust} label={<span className="text-xs">Robustesse : moyenne de 8 journées (IC 95 %)</span>} />
        </div>
      </Card>

      <div id="compare" className="grid gap-4 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <Card key={g.id} title={g.label}>
            <Table
              dense
              head={['Indicateur', 'Avant', 'Après', 'Gain']}
              rows={METRICS.filter((m) => m.group === g.id).map((m) => {
                const b = stat(kbS, base, m.get)
                const a = stat(kaS, after, m.get)
                return [
                  <span key="l" className="text-xs">{m.label}</span>,
                  <span key="b" className="text-xs">{m.format(b.m)}{robust && Number.isFinite(b.ci) ? <span className="block text-[10px] text-[var(--muted)]">± {fmt(b.ci, 2)}</span> : null}</span>,
                  <span key="a" className="text-xs font-semibold">{m.format(a.m)}{robust && Number.isFinite(a.ci) ? <span className="block text-[10px] font-normal text-[var(--muted)]">± {fmt(a.ci, 2)}</span> : null}</span>,
                  <Delta key="d" a={b.m} b={a.m} up={m.higherIsBetter} />,
                ]
              })}
            />
          </Card>
        ))}
      </div>

      <div id="gains" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Gain de marge / jour" value={eur(prof.dailyGain)} tone={prof.dailyGain > 0 ? 'good' : 'critical'} />
        <Kpi label="Gain annuel" value={eur(prof.annualGain)} hint={`${after.costs.workingDaysPerYear} jours ouvrés`} />
        <Kpi label="Investissement" value={eur(prof.investment)} hint={`${after.actions.length} actions`} />
        <Kpi label="ROI annuel" value={Number.isFinite(prof.roi) ? `${fmt(prof.roi * 100, 0)} %` : '—'} />
        <Kpi label="Retour sur investissement" value={Number.isFinite(prof.paybackMonths) ? fmt(prof.paybackMonths, 1) : '—'} unit="mois" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Lead Time et encours par scénario">
          <ChartBox height={260}>
            <BarChart data={allRuns.map(({ s, k }) => ({ name: s.name, lt: k.leadTime / 60, wip: k.wipAvg }))} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [fmt(Number(v), 1), n]} />
              <Legend verticalAlign="top" height={22} iconSize={10} />
              <Bar dataKey="lt" name="Lead Time (min)" fill={S(0)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="wip" name="WIP moyen (pcs)" fill={S(1)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Qualité par scénario">
          <ChartBox height={260}>
            <BarChart data={allRuns.map(({ s, k }) => ({ name: s.name, cpk: k.dimension?.cpk ?? 0, sig: k.sigma.sigmaLevel }))} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [fmtFixed(Number(v), 2), n]} />
              <Legend verticalAlign="top" height={22} iconSize={10} />
              <Bar dataKey="cpk" name="Cpk diamètre" fill={S(2)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="sig" name="Niveau sigma global" fill={S(6)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Synthèse de tous les scénarios" className="xl:col-span-2">
          <Table
            dense
            head={['Scénario', 'Pièces bonnes', 'Débit', 'Lead Time', 'WIP', 'TRS', 'Défauts', 'Cpk', 'Marge / jour', '']}
            rows={allRuns.map(({ s, k }) => [
              <b key="n">{s.name}</b>,
              fmt(k.good, 0),
              `${fmt(k.throughputPerHour, 1)} pcs/h`,
              `${fmt(k.leadTime / 60, 0)} min`,
              fmt(k.wipAvg, 0),
              pct(k.oee),
              pct(1 - k.yield, 2),
              fmtFixed(k.dimension?.cpk, 2),
              eur(k.costs.margin),
              s.id === base.id ? <Badge key="b">avant</Badge> : s.id === after.id ? <Badge key="a" tone="brand">après</Badge> : '',
            ])}
          />
        </Card>
      </div>
      <div className="mt-4">
        <Note title="Lecture">
          Le Lean agit sur le <b>temps</b> (attentes, stocks, changements de série, goulot) ; le Six Sigma agit sur la <b>variabilité</b> (centrage, dispersion, défauts). Leur combinaison est plus que la somme : moins de rebuts libèrent de la capacité au goulot, et des flux courts détectent plus vite les dérives. Les comparaisons utilisent la même graine aléatoire (nombres aléatoires communs) ; activez la robustesse pour vérifier que les écarts dépassent la variabilité d'un jour à l'autre.
        </Note>
      </div>
    </div>
  )
}

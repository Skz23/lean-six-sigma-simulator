import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutDashboard, Settings2, Timer, Gauge, Package, AlertTriangle, TrendingUp, Clock } from 'lucide-react'
import { useActiveScenario, useStore } from '../store/useStore'
import { runScenario, useSimulation } from '../store/useSimulation'
import { Badge, Button, Card, Kpi, Note, PageHeader, Table } from '../components/ui'
import { ChartBox, OeeBars, ParetoChart, S, StationStatesChart, axisProps, tooltipStyle } from '../components/charts'
import { DASHBOARD_WIDGETS, type WidgetId } from '../store/types'
import { clock, duration, eur, fmt, fmtFixed, pct } from '../lib/format'
import { verdict } from '../stats/capability'

export default function Dashboard() {
  const sc = useActiveScenario()
  const { results: r, kpis: k } = useSimulation(sc)
  const scenarios = useStore((s) => s.scenarios)
  const widgets = useStore((s) => s.widgets)
  const setWidgets = useStore((s) => s.setWidgets)
  const [editing, setEditing] = useState(false)

  const series = useMemo(
    () =>
      r.timeSeries.map((p, i, arr) => {
        const prev = arr[Math.max(0, i - 30)]
        const dt = (p.t - prev.t) / 3600
        return { t: clock(p.t), wip: p.wip, good: p.good, rate: dt > 0 ? (p.good - prev.good) / dt : 0 }
      }),
    [r],
  )
  // Cible cumulée au takt : uniquement pendant le temps de production
  const cumTarget = useMemo(() => {
    let operating = 0
    return r.timeSeries.map((p, i) => {
      if (i > 0) {
        const m = (r.timeSeries[i - 1].t + p.t) / 2 / 60
        const inBreak = sc.shift.breaks.some((b) => m >= b.start && m < b.start + b.duration)
        if (!inBreak) operating += p.t - r.timeSeries[i - 1].t
      }
      return Number.isFinite(r.taktTime) ? operating / r.taktTime : 0
    })
  }, [r, sc.shift.breaks])
  const prodData = series.map((p, i) => ({ ...p, target: Math.round(cumTarget[i]) }))

  const compare = useMemo(() => scenarios.map((s) => ({ s, run: runScenario(s) })), [scenarios])

  const show = (id: WidgetId) => widgets.includes(id)
  const order = (id: WidgetId) => widgets.indexOf(id)
  const move = (id: WidgetId, dir: -1 | 1) => {
    const i = widgets.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= widgets.length) return
    const w = [...widgets]
    ;[w[i], w[j]] = [w[j], w[i]]
    setWidgets(w)
  }
  const toggle = (id: WidgetId) => setWidgets(widgets.includes(id) ? widgets.filter((x) => x !== id) : [...widgets, id])

  const bn = r.stations[r.bottleneckIndex]
  const capVerdict = verdict(k.dimension?.cpk)

  const W: Record<WidgetId, { span: string; node: React.ReactNode }> = {
    kpis: {
      span: 'lg:col-span-12',
      node: (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Takt Time" value={fmt(k.taktTime, 1)} unit="s" icon={<Timer size={15} />} hint={`Demande ${sc.demand} pcs/j`} />
          <Kpi label="Temps de cycle goulot" value={fmt(k.bottleneckCycleTime, 1)} unit="s" icon={<Gauge size={15} />} tone={k.bottleneckCycleTime > k.taktTime ? 'critical' : 'good'} hint={bn.name} />
          <Kpi label="Lead Time" value={duration(k.leadTime)} icon={<Clock size={15} />} hint="Loi de Little (WIP / débit)" />
          <Kpi label="Débit" value={fmt(k.throughputPerHour, 1)} unit="pcs/h" icon={<TrendingUp size={15} />} hint={`${k.good} bonnes / ${sc.demand} demandées`} tone={k.good < sc.demand ? 'warning' : undefined} />
          <Kpi label="Encours moyen" value={fmt(k.wipAvg, 0)} unit="pcs" icon={<Package size={15} />} hint={`${eur((k.wipAvg + k.fgStock) * sc.costs.wipUnitValue)} immobilisés`} />
          <Kpi label="Taux de défauts" value={pct(1 - k.yield, 2)} icon={<AlertTriangle size={15} />} hint={`DPMO ${fmt(k.sigma.dpmo, 0)} · ${fmtFixed(k.sigma.sigmaLevel, 2)} σ`} tone={1 - k.yield > 0.03 ? 'critical' : undefined} />
        </div>
      ),
    },
    oee: {
      span: 'lg:col-span-5',
      node: (
        <Card title="TRS / OEE de la ligne" subtitle={`Calculé sur le goulot (${bn.name})`}>
          <OeeBars a={k.oeeAvailability} p={k.oeePerformance} q={k.oeeQuality} oee={k.oee} />
        </Card>
      ),
    },
    production: {
      span: 'lg:col-span-7',
      node: (
        <Card title="Production cumulée vs besoin client" subtitle="Pièces bonnes cumulées et cible au rythme du takt">
          <ChartBox height={230}>
            <LineChart data={prodData} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="t" {...axisProps} interval={59} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Legend verticalAlign="top" height={24} iconSize={10} />
              <Line dataKey="good" name="Pièces bonnes" stroke={S(0)} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="target" name="Cible (takt)" stroke={S(1)} strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ChartBox>
        </Card>
      ),
    },
    wip: {
      span: 'lg:col-span-6',
      node: (
        <Card title="Évolution des encours (WIP)" subtitle="Pièces présentes dans la ligne (files, machines, manutention)">
          <ChartBox height={220}>
            <AreaChart data={prodData} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="t" {...axisProps} interval={59} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Area dataKey="wip" name="WIP" stroke={S(0)} fill={S(0)} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ChartBox>
        </Card>
      ),
    },
    stations: {
      span: 'lg:col-span-6',
      node: (
        <Card title="États des postes" subtitle={<>Goulot détecté : <b>{bn.name}</b> (taux d'activité {pct(bn.activeRatio, 0)})</>}>
          <StationStatesChart stations={r.stations} />
        </Card>
      ),
    },
    quality: {
      span: 'lg:col-span-4',
      node: (
        <Card title="Qualité & capabilité" subtitle={sc.process.characteristic.name} actions={<Link to="/sixsigma/capability" className="text-xs text-brand-600 hover:underline">Détails</Link>}>
          {k.dimension ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Mini label="Cp (court terme)" value={fmtFixed(k.dimension.cp, 2)} />
                <Mini label="Cpk (court terme)" value={fmtFixed(k.dimension.cpk, 2)} />
                <Mini label="Pp (long terme)" value={fmtFixed(k.dimension.pp, 2)} />
                <Mini label="Ppk (long terme)" value={fmtFixed(k.dimension.ppk, 2)} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge tone={capVerdict === 'non-capable' ? 'critical' : capVerdict === 'limite' ? 'warning' : 'good'}>{capVerdict}</Badge>
                <span className="text-[var(--text-secondary)]">
                  {k.dimensionNc} hors tolérance sur {k.measured} mesurées
                </span>
              </div>
              <div className="text-xs text-[var(--muted)]">
                Moyenne {fmtFixed(k.dimension.mean, 4)} mm · σ global {fmtFixed(k.dimension.sigmaOverall * 1000, 1)} µm · RTY {pct(k.rty, 1)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Pas assez de mesures.</p>
          )}
        </Card>
      ),
    },
    pareto: {
      span: 'lg:col-span-8',
      node: (
        <Card title="Pareto des défauts (simulation)" actions={<Link to="/sixsigma/defects" className="text-xs text-brand-600 hover:underline">Analyse</Link>}>
          {k.defectsByType.length ? <ParetoChart items={k.defectsByType.map((d) => ({ label: d.type, count: d.count }))} height={250} /> : <p className="text-sm text-[var(--muted)]">Aucun défaut.</p>}
        </Card>
      ),
    },
    scenarios: {
      span: 'lg:col-span-7',
      node: (
        <Card title="Comparaison des scénarios" subtitle="Même graine aléatoire : seules les configurations diffèrent" actions={<Link to="/lss" className="text-xs text-brand-600 hover:underline">Tableau comparatif</Link>}>
          <ChartBox height={240}>
            <BarChart
              data={compare.map(({ s, run }) => ({ name: s.name, lt: run.kpis.leadTime / 60, oee: run.kpis.oee * 100 }))}
              margin={{ top: 8, right: 12, bottom: 0, left: -10 }}
              barGap={2}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={(v, nme) => [fmt(Number(v), 1), nme]} />
              <Legend verticalAlign="top" height={24} iconSize={10} />
              <Bar dataKey="lt" name="Lead Time (min)" fill={S(0)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="oee" name="TRS (%)" fill={S(2)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartBox>
        </Card>
      ),
    },
    costs: {
      span: 'lg:col-span-5',
      node: (
        <Card title="Économie journalière" subtitle="Modèle de coûts du scénario">
          <Table
            dense
            head={['Poste', 'Montant / jour']}
            rows={[
              ['Chiffre d\'affaires expédié', eur(k.costs.revenue)],
              ['Matière consommée', eur(-k.costs.material)],
              ['Main-d\'œuvre', eur(-k.costs.labor)],
              ['Possession des stocks', eur(-k.costs.holding)],
              ['Pénalités de retard', eur(-k.costs.latePenalty)],
              [<b key="m">Marge</b>, <b key="mv">{eur(k.costs.margin)}</b>],
              ['dont coût de non-qualité (rebuts)', eur(k.costs.copq)],
              ['Coût de revient pièce bonne', eur(k.costs.costPerGoodPart, 2)],
            ]}
          />
        </Card>
      ),
    },
  }

  const visible = (DASHBOARD_WIDGETS.map((w) => w.id) as WidgetId[]).filter(show).sort((a, b) => order(a) - order(b))

  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard size={20} />}
        title="Dashboard général"
        subtitle={
          <>
            {sc.company.name} — {sc.name} · journée de {sc.shift.duration / 60} h · simulation reproductible (graine {sc.seed})
          </>
        }
        actions={
          <Button onClick={() => setEditing((e) => !e)} variant={editing ? 'primary' : 'secondary'}>
            <Settings2 size={15} /> Personnaliser
          </Button>
        }
      />
      {editing && (
        <Card title="Widgets du tableau de bord" subtitle="Afficher, masquer et réordonner" className="mb-4">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {[...DASHBOARD_WIDGETS]
              .sort((a, b) => (order(a.id) < 0 ? 99 : order(a.id)) - (order(b.id) < 0 ? 99 : order(b.id)))
              .map((w) => (
                <div key={w.id} className="flex items-center gap-2 rounded-lg border border-black/[.06] px-2.5 py-1.5 text-sm dark:border-white/10">
                  <button onClick={() => toggle(w.id)} className="text-[var(--text-secondary)]" aria-label="Afficher/masquer">
                    {show(w.id) ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <span className={show(w.id) ? '' : 'text-[var(--muted)] line-through'}>{w.label}</span>
                  <span className="ml-auto flex gap-0.5">
                    <button onClick={() => move(w.id, -1)} disabled={!show(w.id)} className="rounded p-0.5 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10" aria-label="Monter">
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => move(w.id, 1)} disabled={!show(w.id)} className="rounded p-0.5 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10" aria-label="Descendre">
                      <ArrowDown size={14} />
                    </button>
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}
      {k.good < sc.demand && (
        <div className="mb-4">
          <Note tone="warning" title="Capacité insuffisante">
            La ligne a produit {k.good} pièces bonnes pour une demande de {sc.demand}. Le goulot <b>{bn.name}</b> a un temps de cycle effectif de {fmt(k.bottleneckCycleTime, 1)} s (pannes et changements de série inclus) pour un takt de {fmt(k.taktTime, 1)} s. Voir <Link className="underline" to="/lean/kpi">l'analyse du goulot</Link>.
          </Note>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {visible.map((id) => (
          <div key={id} className={W[id].span}>
            {W[id].node}
          </div>
        ))}
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/[.03] px-2.5 py-1.5 dark:bg-white/[.05]">
      <div className="text-[11px] text-[var(--text-secondary)]">{label}</div>
      <div className="tabular font-semibold">{value}</div>
    </div>
  )
}


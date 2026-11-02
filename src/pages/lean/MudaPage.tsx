import { useState } from 'react'
import clsx from 'clsx'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { Boxes, Brain, Factory, Footprints, Hourglass, Layers, Recycle, Truck, XCircle } from 'lucide-react'
import { useActiveScenario } from '../../store/useStore'
import { useSimulation } from '../../store/useSimulation'
import { analyzeMuda, type Muda } from '../../lean/muda'
import { Badge, Card, Kpi, Note, PageHeader } from '../../components/ui'
import { ChartBox, axisProps, tooltipStyle } from '../../components/charts'
import { eur, fmt } from '../../lib/format'

const ICONS: Record<string, React.ReactNode> = {
  Factory: <Factory size={18} />,
  Hourglass: <Hourglass size={18} />,
  Truck: <Truck size={18} />,
  Layers: <Layers size={18} />,
  Boxes: <Boxes size={18} />,
  Footprints: <Footprints size={18} />,
  XCircle: <XCircle size={18} />,
  Brain: <Brain size={18} />,
}

const tone = (m: Muda) => (m.severity === 'élevé' ? 'critical' : m.severity === 'modéré' ? 'warning' : 'good')
const color = (m: Muda) => (m.severity === 'élevé' ? 'var(--critical)' : m.severity === 'modéré' ? 'var(--warning)' : 'var(--good)')

export default function MudaPage() {
  const sc = useActiveScenario()
  const { results, kpis } = useSimulation(sc)
  const mudas = analyzeMuda(sc, results, kpis)
  const [sel, setSel] = useState(mudas[0].key)
  const m = mudas.find((x) => x.key === sel)!
  const total = mudas.reduce((s, x) => s + x.dailyCost, 0)

  return (
    <div>
      <PageHeader icon={<Recycle size={20} />} title="Analyse des 8 gaspillages (Muda)" subtitle="Détection automatique à partir des données de la journée simulée, quantification et pistes d'amélioration" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Coût estimé des gaspillages" value={eur(total)} unit="/ jour" />
        <Kpi label="Sur une année" value={eur(total * sc.costs.workingDaysPerYear)} />
        <Kpi label="Gaspillages critiques" value={mudas.filter((x) => x.severity === 'élevé').length} unit="/ 8" tone="critical" />
        <Kpi label="Gaspillages modérés" value={mudas.filter((x) => x.severity === 'modéré').length} unit="/ 8" tone="warning" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {mudas.map((x) => (
          <button
            key={x.key}
            onClick={() => setSel(x.key)}
            className={clsx(
              'rounded-xl border-2 bg-[var(--surface-1)] p-3 text-left transition-all',
              sel === x.key ? 'border-brand-500 shadow-md' : 'border-transparent ring-1 ring-black/[.08] hover:ring-black/20 dark:ring-white/10',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">{ICONS[x.icon]}</span>
              <Badge tone={tone(x)}>{x.severity}</Badge>
            </div>
            <div className="mt-2 text-sm font-semibold">
              {x.index}. {x.name}
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-black/[.06] dark:bg-white/10">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, x.score)}%`, background: color(x) }} />
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">{eur(x.dailyCost)} / jour</div>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Card title={`${m.index}. ${m.name}`} subtitle={`Score de sévérité ${fmt(m.score, 0)} / 100`} className="lg:col-span-7" actions={<Badge tone={tone(m)}>{m.severity}</Badge>}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Données détectées</h4>
              <dl className="space-y-1.5 text-sm">
                {m.metrics.map((x) => (
                  <div key={x.label} className="flex justify-between gap-3 border-b border-black/[.05] pb-1 dark:border-white/[.06]">
                    <dt className="text-[var(--text-secondary)]">{x.label}</dt>
                    <dd className="text-right font-medium tabular">{x.value}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 pt-1">
                  <dt className="text-[var(--text-secondary)]">Impact estimé</dt>
                  <dd className="font-semibold">{eur(m.dailyCost)} / jour</dd>
                </div>
              </dl>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Causes potentielles</h4>
                <ul className="list-disc space-y-1 pl-4 text-sm text-[var(--text-secondary)]">
                  {m.causes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Améliorations proposées</h4>
                <ul className="space-y-1 text-sm">
                  {m.improvements.map((c) => (
                    <li key={c} className="flex gap-2">
                      <span className="text-brand-600">→</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <Note tone="tip" title="Gain potentiel">
                {m.potentialGain}
              </Note>
            </div>
          </div>
        </Card>
        <Card title="Coût journalier estimé par gaspillage" className="lg:col-span-5">
          <ChartBox height={300}>
            <BarChart data={mudas.map((x) => ({ name: x.name, cost: x.dailyCost, m: x }))} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `${v} €`} />
              <YAxis type="category" dataKey="name" width={150} {...axisProps} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => [eur(Number(v)), 'Coût / jour']} />
              <Bar dataKey="cost" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {mudas.map((x) => (
                  <Cell key={x.key} fill={color(x)} />
                ))}
              </Bar>
            </BarChart>
          </ChartBox>
          <p className="mt-2 text-[11px] text-[var(--muted)]">Estimations à partir des paramètres économiques du scénario (main-d'œuvre, valeur des encours, taux de possession). Les règles de détection et seuils sont documentés dans « Hypothèses & formules ».</p>
        </Card>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { KanbanSquare } from 'lucide-react'
import { useActiveScenario, useStore } from '../../store/useStore'
import { runScenario, useSimulation } from '../../store/useSimulation'
import { kanbanCards, availableTime } from '../../lean/tools'
import { Button, Card, Delta, Field, Kpi, Note, NumberInput, PageHeader, Table } from '../../components/ui'
import { ChartBox, S, axisProps, tooltipStyle } from '../../components/charts'
import { duration, fmt, pct } from '../../lib/format'

export default function KanbanPage() {
  const sc = useActiveScenario()
  const update = useStore((s) => s.updateScenario)
  const { results, kpis } = useSimulation(sc)
  const [container, setContainer] = useState(5)
  const [safety, setSafety] = useState(0.15)
  const [loopMin, setLoopMin] = useState<number | null>(null)
  const dayS = availableTime(sc)

  // Délai de réapprovisionnement par boucle : temps de cycle effectif du poste fournisseur
  // sur un conteneur + transport + délai de signal (par défaut 15 min).
  const loops = sc.stations.slice(0, -1).map((s, i) => {
    const ct = results.stations[i].nominalCycleTime / s.capacity / Math.max(0.01, s.availability) + (s.changeoverTime * 60) / Math.max(1, sc.batchSize)
    const replenish = (loopMin ?? 15) * 60 + ct * container + s.distanceToNext / Math.max(0.01, sc.transportSpeed)
    const L = replenish / dayS
    const n = kanbanCards({ dailyDemand: sc.demand, leadTimeDays: L, safety, containerSize: container })
    return { from: s.name, to: sc.stations[i + 1].name, id: s.id, replenish, cards: n, maxWip: n * container, current: results.stations[i + 1].avgQueue, cap: s.bufferCapacity }
  })
  const fgCards = kanbanCards({ dailyDemand: sc.demand, leadTimeDays: ((loopMin ?? 15) * 60 + kpis.bottleneckCycleTime * container) / dayS, safety, containerSize: container })

  const trial = structuredClone(sc)
  trial.releasePolicy = 'pull'
  loops.forEach((l, i) => (trial.stations[i].bufferCapacity = Math.max(1, l.maxWip)))
  trial.finishedGoodsCap = Math.max(container, fgCards * container)
  const tk = runScenario(trial).kpis

  return (
    <div>
      <PageHeader icon={<KanbanSquare size={20} />} title="Kanban — flux tiré" subtitle="Dimensionnement des boucles, plafonnement des encours et simulation du passage en flux tiré" />
      <div className="mb-4 grid gap-4 lg:grid-cols-12">
        <Card title="Paramètres" className="lg:col-span-4">
          <div className="space-y-3">
            <Field label="Demande journalière (D)">
              <NumberInput value={sc.demand} onChange={() => {}} min={1} suffix="pcs/j" className="pointer-events-none opacity-70" />
            </Field>
            <Field label="Taille du conteneur (C)">
              <NumberInput value={container} min={1} step={1} suffix="pcs" onChange={(v) => setContainer(Math.round(v))} />
            </Field>
            <Field label="Coefficient de sécurité (α)">
              <NumberInput value={Math.round(safety * 100)} min={0} max={100} step={5} suffix="%" onChange={(v) => setSafety(v / 100)} />
            </Field>
            <Field label="Délai de signal / collecte" hint="Temps entre la libération d'une carte et sa prise en compte">
              <NumberInput value={loopMin ?? 15} min={0} step={5} suffix="min" onChange={(v) => setLoopMin(v)} />
            </Field>
            <div className="rounded-lg bg-black/[.03] p-3 text-center text-sm dark:bg-white/[.05]">
              <div className="text-xs text-[var(--text-secondary)]">Formule de Toyota</div>
              <div className="mt-1 font-mono text-base">N = D × L × (1 + α) / C</div>
              <div className="mt-1 text-[11px] text-[var(--muted)]">L = délai de réapprovisionnement de la boucle (en jours)</div>
            </div>
          </div>
        </Card>
        <Card title="Boucles kanban calculées" className="lg:col-span-8">
          <Table
            dense
            head={['Boucle', 'Délai (L)', 'Cartes (N)', 'Encours max', 'Plafond actuel', 'Encours moyen simulé']}
            rows={[
              ...loops.map((l) => [`${l.from} → ${l.to}`, duration(l.replenish), <b key="n">{l.cards}</b>, `${l.maxWip} pcs`, `${l.cap} pcs`, `${fmt(l.current, 1)} pcs`]),
              ['Supermarché produits finis', '—', <b key="f">{fgCards}</b>, `${fgCards * container} pcs`, sc.releasePolicy === 'pull' ? `${sc.finishedGoodsCap} pcs` : 'illimité (push)', `${results.fgStock} pcs (fin)`],
            ]}
          />
          <ChartBox height={220}>
            <BarChart data={loops.map((l) => ({ name: l.to, actuel: l.current, kanban: l.maxWip }))} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [`${fmt(Number(v), 1)} pcs`, n]} />
              <Legend verticalAlign="top" height={22} iconSize={10} />
              <Bar dataKey="actuel" name="Encours moyen actuel (file amont)" fill={S(1)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="kanban" name="Encours max kanban" fill={S(0)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartBox>
        </Card>
      </div>
      <Card title="Simulation du flux tiré" subtitle="Plafonds d'encours = cartes × conteneur ; supermarché produits finis dimensionné par la même formule">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <Table
            dense
            head={['Indicateur', sc.releasePolicy === 'push' ? 'Actuel (poussé)' : 'Actuel', 'Kanban', 'Écart']}
            rows={[
              ['Encours moyen (WIP)', fmt(kpis.wipAvg, 1), fmt(tk.wipAvg, 1), <Delta key="w" a={kpis.wipAvg} b={tk.wipAvg} />],
              ['Lead Time', duration(kpis.leadTime), duration(tk.leadTime), <Delta key="l" a={kpis.leadTime} b={tk.leadTime} />],
              ['Pièces bonnes', fmt(kpis.good, 0), fmt(tk.good, 0), <Delta key="g" a={kpis.good} b={tk.good} up />],
              ['Surproduction', fmt(kpis.overproduction, 0), fmt(tk.overproduction, 0), <Delta key="o" a={kpis.overproduction} b={tk.overproduction} />],
              ['Taux de service', pct(kpis.serviceLevel), pct(tk.serviceLevel), <Delta key="s" a={kpis.serviceLevel} b={tk.serviceLevel} up />],
              ['Stock produits finis (fin)', fmt(kpis.fgStock, 0), fmt(tk.fgStock, 0), <Delta key="f" a={kpis.fgStock} b={tk.fgStock} />],
            ]}
          />
          <div className="space-y-3">
            <Kpi label="Réduction des encours" value={pct(1 - tk.wipAvg / kpis.wipAvg, 0)} tone="good" />
            <Button
              variant="primary"
              className="w-full"
              onClick={() =>
                update(
                  sc.id,
                  (s) => {
                    s.releasePolicy = 'pull'
                    loops.forEach((l, i) => (s.stations[i].bufferCapacity = Math.max(1, l.maxWip)))
                    s.finishedGoodsCap = Math.max(container, fgCards * container)
                  },
                  'Avant mise en place kanban',
                )
              }
            >
              Appliquer les kanbans au scénario
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <Note>
            Si les plafonds sont trop bas par rapport à la variabilité (pannes, changements de série), le goulot est affamé ou bloqué : le débit baisse. Ajustez α ou la taille de conteneur et observez le compromis encours / taux de service.
          </Note>
        </div>
      </Card>
    </div>
  )
}

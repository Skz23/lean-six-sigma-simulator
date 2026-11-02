import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { Plus, Timer, Trash2, Wand2 } from 'lucide-react'
import { useActiveScenario, useStore, uid } from '../../store/useStore'
import { useSimulation, runScenario } from '../../store/useSimulation'
import { smedAnalysis, minimalBatch, type SmedOperation } from '../../lean/tools'
import { Button, Card, Delta, Field, Input, Kpi, Note, NumberInput, PageHeader, Select, Table } from '../../components/ui'
import { ChartBox, S, axisProps, tooltipStyle } from '../../components/charts'
import { duration, fmt, pct } from '../../lib/format'

export default function SmedPage() {
  const sc = useActiveScenario()
  const tools = useStore((s) => s.tools)
  const setTools = useStore((s) => s.setTools)
  const update = useStore((s) => s.updateScenario)
  const { kpis } = useSimulation(sc)
  const [stationId, setStationId] = useState(sc.process.stationId)
  const [newBatch, setNewBatch] = useState(sc.batchSize)
  const station = sc.stations.find((s) => s.id === stationId) ?? sc.stations[0]
  const key = `${sc.id}:${station.id}`
  const ops: SmedOperation[] = tools.smed[key] ?? []
  const a = smedAnalysis(ops)

  const setOps = (fn: (o: SmedOperation[]) => void) =>
    setTools((t) => {
      const list = t.smed[key] ?? []
      fn(list)
      t.smed[key] = list
    })

  // Simulation des gains : application du nouveau C/O et éventuellement d'une nouvelle taille de lot
  const trial = structuredClone(sc)
  const tst = trial.stations.find((x) => x.id === station.id)!
  tst.changeoverTime = Math.round(a.after * 10) / 10
  trial.batchSize = newBatch
  const tr = ops.length ? runScenario(trial).kpis : null
  const minB = minimalBatch(a.after, station.cycleTime / station.capacity / station.availability, kpis.taktTime)

  return (
    <div>
      <PageHeader icon={<Timer size={20} />} title="SMED — Single Minute Exchange of Die" subtitle="Décomposer le changement de série, externaliser, rationaliser, puis simuler le gain sur la ligne" actions={
        <Select value={station.id} onChange={(e) => setStationId(e.target.value)} className="w-56">
          {sc.stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — C/O {s.changeoverTime} min
            </option>
          ))}
        </Select>
      } />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="C/O actuel (relevé)" value={fmt(a.before, 1)} unit="min" hint={`Paramètre du poste : ${station.changeoverTime} min`} />
        <Kpi label="C/O après SMED" value={fmt(a.after, 1)} unit="min" tone="good" />
        <Kpi label="Réduction" value={pct(a.gainPct, 0)} />
        <Kpi label="Lot minimal compatible takt" value={Number.isFinite(minB) ? fmt(minB, 0) : '∞'} unit="pcs" hint="C/O / (takt − CT effectif)" />
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Card
          title={`Opérations de changement — ${station.name}`}
          subtitle="Interne = machine arrêtée · Externe = réalisable machine en marche"
          className="xl:col-span-8"
          actions={
            <Button size="sm" onClick={() => setOps((o) => o.push({ id: uid('op'), label: 'Nouvelle opération', duration: 2, type: 'internal', convertible: false, reduction: 0 }))}>
              <Plus size={13} /> Opération
            </Button>
          }
        >
          {ops.length ? (
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_80px_120px_110px_110px_32px] gap-2 text-[11px] font-medium text-[var(--muted)] md:grid">
                <span>Opération</span>
                <span>Durée</span>
                <span>Type actuel</span>
                <span>Externalisable</span>
                <span>Réduction</span>
                <span />
              </div>
              {ops.map((o, i) => (
                <div key={o.id} className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_80px_120px_110px_110px_32px]">
                  <Input className="col-span-2 md:col-span-1" value={o.label} onChange={(e) => setOps((l) => (l[i].label = e.target.value))} />
                  <NumberInput value={o.duration} min={0} step={0.5} suffix="min" onChange={(v) => setOps((l) => (l[i].duration = v))} />
                  <Select value={o.type} onChange={(e) => setOps((l) => (l[i].type = e.target.value as 'internal' | 'external'))}>
                    <option value="internal">Interne</option>
                    <option value="external">Externe</option>
                  </Select>
                  <Select value={o.convertible ? '1' : '0'} onChange={(e) => setOps((l) => (l[i].convertible = e.target.value === '1'))}>
                    <option value="1">Oui</option>
                    <option value="0">Non</option>
                  </Select>
                  <NumberInput value={Math.round(o.reduction * 100)} min={0} max={100} step={5} suffix="%" onChange={(v) => setOps((l) => (l[i].reduction = v / 100))} />
                  <Button size="sm" variant="danger" onClick={() => setOps((l) => l.splice(i, 1))} aria-label="Supprimer">
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <p>Aucune décomposition pour ce poste.</p>
              <Button
                onClick={() =>
                  setOps((l) => {
                    const c = station.changeoverTime
                    l.push(
                      { id: uid('op'), label: 'Préparation outils et documents', duration: +(c * 0.3).toFixed(1), type: 'internal', convertible: true, reduction: 0 },
                      { id: uid('op'), label: 'Démontage / montage', duration: +(c * 0.4).toFixed(1), type: 'internal', convertible: false, reduction: 0.5 },
                      { id: uid('op'), label: 'Réglages et essais', duration: +(c * 0.3).toFixed(1), type: 'internal', convertible: false, reduction: 0.5 },
                    )
                  })
                }
              >
                <Wand2 size={14} /> Initialiser à partir du C/O actuel
              </Button>
            </div>
          )}
        </Card>
        <Card title="Avant / après" className="xl:col-span-4">
          <ChartBox height={240}>
            <BarChart
              data={[
                { name: 'Avant', interne: a.before, externe: 0 },
                { name: 'Séparation', interne: a.internalBefore, externe: a.externalBefore },
                { name: 'Conversion', interne: a.after + a.rationalizedGain, externe: a.convertedTime },
                { name: 'Après', interne: a.after, externe: a.convertedTime },
              ]}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} unit=" min" />
              <Tooltip {...tooltipStyle} formatter={(v, nme) => [`${fmt(Number(v), 1)} min`, nme]} />
              <Legend verticalAlign="top" height={22} iconSize={10} />
              <Bar dataKey="interne" name="Interne (machine arrêtée)" stackId="a" fill={S(1)} stroke="var(--surface-1)" isAnimationActive={false} />
              <Bar dataKey="externe" name="Externe" stackId="a" fill={S(0)} stroke="var(--surface-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Simulation des gains sur la ligne" subtitle="Même graine aléatoire : seul le changement de série (et la taille de lot) diffère" className="xl:col-span-12">
          {tr ? (
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className="space-y-3">
                <Field label="Nouvelle taille de lot" hint="Le SMED permet de réduire les lots sans perdre de capacité">
                  <NumberInput value={newBatch} min={1} step={10} suffix="pcs" onChange={(v) => setNewBatch(Math.round(v))} />
                </Field>
                <Button
                  variant="primary"
                  onClick={() =>
                    update(
                      sc.id,
                      (s) => {
                        s.stations.find((x) => x.id === station.id)!.changeoverTime = Math.round(a.after * 10) / 10
                        s.batchSize = newBatch
                      },
                      `Avant SMED ${station.name}`,
                    )
                  }
                >
                  Appliquer au scénario
                </Button>
                <p className="text-[11px] text-[var(--muted)]">Une version de sauvegarde est créée automatiquement (Gestion des scénarios).</p>
              </div>
              <Table
                dense
                head={['Indicateur', 'Actuel', 'Après SMED', 'Écart']}
                rows={[
                  ['Pièces bonnes / jour', fmt(kpis.good, 0), fmt(tr.good, 0), <Delta key="g" a={kpis.good} b={tr.good} up />],
                  ['Lead Time', duration(kpis.leadTime), duration(tr.leadTime), <Delta key="l" a={kpis.leadTime} b={tr.leadTime} />],
                  ['Encours moyen', fmt(kpis.wipAvg, 0), fmt(tr.wipAvg, 0), <Delta key="w" a={kpis.wipAvg} b={tr.wipAvg} />],
                  ['TRS', pct(kpis.oee), pct(tr.oee), <Delta key="o" a={kpis.oee} b={tr.oee} up />],
                  ['CT effectif goulot', `${fmt(kpis.bottleneckCycleTime, 1)} s`, `${fmt(tr.bottleneckCycleTime, 1)} s`, <Delta key="c" a={kpis.bottleneckCycleTime} b={tr.bottleneckCycleTime} />],
                ]}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Décomposez d'abord le changement de série.</p>
          )}
        </Card>
      </div>
      <div className="mt-4">
        <Note title="Méthode SMED (Shigeo Shingo)">1. Observer et chronométrer · 2. Séparer interne / externe · 3. Convertir l'interne en externe (préparation, préréglage) · 4. Rationaliser l'interne (serrage rapide, standardisation, opérations en parallèle) · 5. Standardiser.</Note>
      </div>
    </div>
  )
}

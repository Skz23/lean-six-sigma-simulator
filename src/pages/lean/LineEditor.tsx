import { ask, notify } from '../../lib/dialog'
import { useState } from 'react'
import { ArrowDown, ArrowUp, Factory, Plus, Save, Trash2 } from 'lucide-react'
import { useActiveScenario, useStore } from '../../store/useStore'
import { useSimulation } from '../../store/useSimulation'
import { Badge, Button, Card, Field, Input, Note, NumberInput, PageHeader, Select, Table, Toggle } from '../../components/ui'
import { FlowDiagram } from '../../components/FlowDiagram'
import type { Scenario, Station } from '../../engine/types'
import { theoreticalCapacity } from '../../engine/kpi'
import { fmt, pct } from '../../lib/format'

export default function LineEditor() {
  const sc = useActiveScenario()
  const update = useStore((s) => s.updateScenario)
  const saveVersion = useStore((s) => s.saveVersion)
  const { results, kpis } = useSimulation(sc)
  const [sel, setSel] = useState<string>(sc.stations[0]?.id)
  const station = sc.stations.find((s) => s.id === sel) ?? sc.stations[0]
  const idx = sc.stations.findIndex((s) => s.id === station?.id)

  const set = (fn: (s: Scenario) => void) => update(sc.id, fn)
  const setSt = (patch: Partial<Station>) => set((s) => Object.assign(s.stations.find((x) => x.id === station.id)!, patch))
  const reorder = (from: number, to: number) =>
    set((s) => {
      const [m] = s.stations.splice(from, 1)
      s.stations.splice(to, 0, m)
    })
  const add = () => {
    const id = `S${Math.max(0, ...sc.stations.map((s) => parseInt(s.id.replace(/\D/g, '')) || 0)) + 1}`
    set((s) =>
      s.stations.push({
        id,
        name: 'Nouveau poste',
        cycleTime: 40,
        cycleTimeCV: 0.1,
        changeoverTime: 10,
        operators: 1,
        availability: 0.95,
        mttr: 10,
        defectRate: 0.005,
        capacity: 1,
        bufferCapacity: 30,
        initialWip: 5,
        valueAdded: true,
        distanceToNext: 10,
        x: 10 + s.stations.length * 6,
        y: 14,
        defectTypes: ['Défaut divers'],
      }),
    )
    setSel(id)
  }
  const remove = () => {
    if (sc.stations.length <= 2) return
    if (sc.process.stationId === station.id) return notify('Ce poste porte la caractéristique critique (CTQ) : choisissez d\'abord un autre poste qualité dans « Paramètres procédé ».')
    if (!ask(`Supprimer le poste « ${station.name} » ?`)) return
    set((s) => {
      s.stations = s.stations.filter((x) => x.id !== station.id)
    })
    setSel(sc.stations[0].id)
  }

  const cap = theoreticalCapacity(
    sc,
    results.stations.map((s) => s.nominalCycleTime),
  )
  const minCap = Math.min(...cap.map((c) => c.goodPartsPerHour))

  return (
    <div>
      <PageHeader
        icon={<Factory size={20} />}
        title="Ligne de production"
        subtitle="Construisez la ligne : postes, temps, fiabilité, stocks et flux. Toute modification relance la simulation."
        actions={
          <>
            <Button onClick={() => saveVersion(sc.id, `Version manuelle — ${new Date().toLocaleString('fr-FR')}`)}>
              <Save size={15} /> Enregistrer une version
            </Button>
            <Button variant="primary" onClick={add}>
              <Plus size={15} /> Ajouter un poste
            </Button>
          </>
        }
      />

      <Card title="Flux de production" subtitle="Cliquez sur un poste pour le modifier · glissez-déposez pour le déplacer · triangles = stocks intermédiaires (moyen / max)" className="mb-4">
        <FlowDiagram sc={sc} selected={station?.id} onSelect={setSel} onReorder={reorder} bottleneck={results.bottleneckIndex} buffers={results.stations.map((_, i) => (i < results.stations.length - 1 ? results.stations[i + 1].avgQueue : results.fgStock))} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          {station && (
            <Card
              title={`Poste ${station.id} — ${station.name}`}
              subtitle={sc.process.stationId === station.id ? 'Poste portant la caractéristique critique (CTQ) — temps de cycle modulé par la vitesse de coupe' : undefined}
              actions={
                <>
                  <Button size="sm" onClick={() => idx > 0 && reorder(idx, idx - 1)} disabled={idx <= 0} aria-label="Monter">
                    <ArrowUp size={14} />
                  </Button>
                  <Button size="sm" onClick={() => idx < sc.stations.length - 1 && reorder(idx, idx + 1)} disabled={idx >= sc.stations.length - 1} aria-label="Descendre">
                    <ArrowDown size={14} />
                  </Button>
                  <Button size="sm" variant="danger" onClick={remove} disabled={sc.stations.length <= 2}>
                    <Trash2 size={14} /> Supprimer
                  </Button>
                </>
              }
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Field label="Nom du poste" className="col-span-2 md:col-span-3">
                  <Input value={station.name} onChange={(e) => setSt({ name: e.target.value })} />
                </Field>
                <Field label="Temps de cycle (Cycle Time)" hint="Par pièce et par machine">
                  <NumberInput value={station.cycleTime} min={1} step={1} suffix="s" onChange={(v) => setSt({ cycleTime: v })} />
                </Field>
                <Field label="Variabilité du temps de cycle" hint="Coefficient de variation (loi log-normale)">
                  <NumberInput value={station.cycleTimeCV} min={0} max={1} step={0.05} onChange={(v) => setSt({ cycleTimeCV: v })} />
                </Field>
                <Field label="Changement de série (C/O)">
                  <NumberInput value={station.changeoverTime} min={0} step={1} suffix="min" onChange={(v) => setSt({ changeoverTime: v })} />
                </Field>
                <Field label="Nombre d'opérateurs">
                  <NumberInput value={station.operators} min={0} step={1} onChange={(v) => setSt({ operators: Math.round(v) })} />
                </Field>
                <Field label="Disponibilité machine" hint="MTBF / (MTBF + MTTR)">
                  <NumberInput value={+(station.availability * 100).toFixed(2)} min={1} max={100} step={0.5} suffix="%" onChange={(v) => setSt({ availability: v / 100 })} />
                </Field>
                <Field label="Temps d'arrêt moyen (MTTR)" hint={`MTBF déduit : ${station.availability < 1 ? fmt((station.mttr * station.availability) / (1 - station.availability), 0) + ' min' : '∞'}`}>
                  <NumberInput value={station.mttr} min={0.5} step={1} suffix="min" onChange={(v) => setSt({ mttr: v })} />
                </Field>
                <Field label="Taux de défauts du poste" hint="Hors caractéristique CTQ">
                  <NumberInput value={+(station.defectRate * 100).toFixed(3)} min={0} max={100} step={0.1} suffix="%" onChange={(v) => setSt({ defectRate: v / 100 })} />
                </Field>
                <Field label="Capacité (machines en parallèle)">
                  <NumberInput value={station.capacity} min={1} max={10} step={1} onChange={(v) => setSt({ capacity: Math.round(v) })} />
                </Field>
                <Field label="Stock aval max (WIP)">
                  <NumberInput value={station.bufferCapacity} min={1} step={1} suffix="pcs" onChange={(v) => setSt({ bufferCapacity: Math.round(v) })} />
                </Field>
                <Field label="Stock aval initial">
                  <NumberInput value={station.initialWip} min={0} step={1} suffix="pcs" onChange={(v) => setSt({ initialWip: Math.round(v) })} />
                </Field>
                <Field label="Distance vers le poste suivant">
                  <NumberInput value={station.distanceToNext} min={0} step={1} suffix="m" onChange={(v) => setSt({ distanceToNext: v })} />
                </Field>
                <Field label="Type d'opération">
                  <Select value={station.valueAdded ? 'va' : 'nva'} onChange={(e) => setSt({ valueAdded: e.target.value === 'va' })}>
                    <option value="va">Valeur ajoutée</option>
                    <option value="nva">Sans valeur ajoutée (contrôle, emballage…)</option>
                  </Select>
                </Field>
                <Field label="Catégories de défauts" hint="Séparées par des virgules" className="col-span-2 md:col-span-3">
                  <Input value={station.defectTypes.join(', ')} onChange={(e) => setSt({ defectTypes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                </Field>
              </div>
            </Card>
          )}

          <Card title="Capacité théorique par poste" subtitle="Temps effectif par pièce = CT / (capacité × disponibilité) + C/O / taille de lot">
            <Table
              dense
              head={['Poste', 'CT effectif', 's / pièce', 'Pièces bonnes / h', 'Charge vs takt', '']}
              rows={cap.map((c, i) => [
                c.name,
                `${fmt(results.stations[i].nominalCycleTime, 1)} s`,
                `${fmt(c.secondsPerPart, 1)} s`,
                fmt(c.goodPartsPerHour, 1),
                pct(c.secondsPerPart / kpis.taktTime, 0),
                c.goodPartsPerHour === minCap ? <Badge tone="critical">goulot théorique</Badge> : c.secondsPerPart > kpis.taktTime ? <Badge tone="warning">&gt; takt</Badge> : <Badge tone="good">OK</Badge>,
              ])}
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Takt : {fmt(kpis.taktTime, 1)} s · Goulot observé en simulation : <b>{results.stations[results.bottleneckIndex].name}</b> (méthode du taux d'activité : production + panne + changement). Les deux peuvent différer à cause des blocages et des aléas.
            </p>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-5">
          <Card title="Paramètres de la journée">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Durée de travail">
                <NumberInput value={sc.shift.duration} min={60} max={1440} step={15} suffix="min" onChange={(v) => set((s) => (s.shift.duration = v))} />
              </Field>
              <Field label="Demande client">
                <NumberInput value={sc.demand} min={1} step={10} suffix="pcs/j" onChange={(v) => set((s) => (s.demand = Math.round(v)))} />
              </Field>
              <Field label="Taille de lot">
                <NumberInput value={sc.batchSize} min={1} step={10} suffix="pcs" onChange={(v) => set((s) => (s.batchSize = Math.round(v)))} />
              </Field>
              <Field label="Vitesse de manutention">
                <NumberInput value={sc.transportSpeed} min={0.1} step={0.1} suffix="m/s" onChange={(v) => set((s) => (s.transportSpeed = v))} />
              </Field>
              <Field label="Pilotage du flux">
                <Select value={sc.releasePolicy} onChange={(e) => set((s) => (s.releasePolicy = e.target.value as 'push' | 'pull'))}>
                  <option value="push">Flux poussé (push)</option>
                  <option value="pull">Flux tiré (pull / kanban)</option>
                </Select>
              </Field>
              <Field label="Plafond produits finis" hint="Actif en flux tiré">
                <NumberInput value={sc.finishedGoodsCap} min={1} step={5} suffix="pcs" onChange={(v) => set((s) => (s.finishedGoodsCap = Math.round(v)))} />
              </Field>
              <Field label="Graine aléatoire" hint="Même graine = mêmes aléas">
                <NumberInput value={sc.seed} min={1} step={1} onChange={(v) => set((s) => (s.seed = Math.round(v)))} />
              </Field>
              <Field label="Mise en régime">
                <div className="pt-1.5">
                  <Toggle checked={sc.warmup} onChange={(v) => set((s) => (s.warmup = v))} label={<span className="text-xs">Simuler une journée préalable</span>} />
                </div>
              </Field>
            </div>
          </Card>

          <Card title="Pauses" actions={<Button size="sm" onClick={() => set((s) => s.shift.breaks.push({ start: 300, duration: 10, label: 'Pause' }))}><Plus size={13} /> Pause</Button>}>
            <div className="space-y-2">
              {sc.shift.breaks.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_90px_32px] items-end gap-2">
                  <Field label="Libellé">
                    <Input value={b.label} onChange={(e) => set((s) => (s.shift.breaks[i].label = e.target.value))} />
                  </Field>
                  <Field label="Début">
                    <NumberInput value={b.start} min={0} max={sc.shift.duration} step={5} suffix="min" onChange={(v) => set((s) => (s.shift.breaks[i].start = v))} />
                  </Field>
                  <Field label="Durée">
                    <NumberInput value={b.duration} min={1} step={5} suffix="min" onChange={(v) => set((s) => (s.shift.breaks[i].duration = v))} />
                  </Field>
                  <Button size="sm" variant="danger" onClick={() => set((s) => s.shift.breaks.splice(i, 1))} aria-label="Supprimer">
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-[var(--muted)]">
                Temps planifié : {fmt(kpis.plannedTime / 60, 0)} min · Takt Time : {fmt(kpis.taktTime, 1)} s
              </p>
            </div>
          </Card>
          <Note tone="tip" title="Conseil">
            Pour simuler un goulot, augmentez le temps de cycle ou baissez la disponibilité d'un poste : le débit, les encours et le Lead Time réagissent immédiatement dans tous les modules.
          </Note>
        </div>
      </div>
    </div>
  )
}

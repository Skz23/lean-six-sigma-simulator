import { useState } from 'react'
import { useActiveScenario, useStore } from '../store/useStore'
import { useSimulation } from '../store/useSimulation'
import { Field, Select, TextArea, Badge } from './ui'
import { parseNumbers } from '../lib/format'
import type { MeasureSpec } from '../data/import'
import { subgroupSizeOf } from '../data/realScenario'

/** 'sim' : simulation · 'manual' : saisie · sinon identifiant d'un jeu de mesures importé. */
export type SourceKind = string

/**
 * Sélection de la source de données d'un outil Six Sigma : mesures de la simulation,
 * jeu de mesures réelles importé (Mes données) ou saisie / collage manuel.
 */
export function useMeasurements() {
  const sc = useActiveScenario()
  const { results } = useSimulation(sc)
  const datasets = useStore((s) => s.datasets).filter((d) => d.kind === 'measures')
  const [kind, setKind] = useState<SourceKind>(datasets.length ? datasets[datasets.length - 1].id : 'sim')
  const [text, setText] = useState('')
  const ds = datasets.find((d) => d.id === kind)
  const sid = sc.process.stationId
  const simValues = results.products
    .filter((p) => p.dimension !== undefined)
    .sort((a, b) => a.history.find((h) => h.stationId === sid)!.start - b.history.find((h) => h.stationId === sid)!.start)
    .map((p) => p.dimension!)
  const values = ds ? (ds.values ?? []) : kind === 'manual' ? parseNumbers(text) : simValues
  const spec: MeasureSpec | undefined = ds?.spec ?? (kind !== 'manual' ? { name: sc.process.characteristic.name, unit: sc.process.characteristic.unit, lsl: sc.process.characteristic.lsl, usl: sc.process.characteristic.usl, target: sc.process.characteristic.nominal } : undefined)
  const subgroupSize = ds ? subgroupSizeOf(ds.groups) : undefined
  const ui = (
    <div className="space-y-2">
      <Field label="Source des données">
        <Select value={ds || kind === 'manual' ? kind : 'sim'} onChange={(e) => setKind(e.target.value)}>
          <option value="sim">Simulation — {sc.process.characteristic.name} ({sc.name})</option>
          {datasets.length > 0 && (
            <optgroup label="Mes données réelles">
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </optgroup>
          )}
          <option value="manual">Saisie manuelle / copier-coller</option>
        </Select>
      </Field>
      {kind === 'manual' ? (
        <Field label="Valeurs mesurées" hint="Séparateurs : espace, retour à la ligne, point-virgule. Ordre chronologique (sous-groupes consécutifs).">
          <TextArea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="25.012 24.998 25.031 …" />
        </Field>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          <Badge tone="brand">{values.length} mesures</Badge>{' '}
          {ds ? `données réelles importées${subgroupSize && subgroupSize > 1 ? `, sous-groupes de ${subgroupSize}` : ''}.` : 'pièces mesurées au poste CTQ dans l\'ordre de fabrication.'}
        </p>
      )}
    </div>
  )
  return { values, ui, kind, sc, results, spec, subgroupSize }
}

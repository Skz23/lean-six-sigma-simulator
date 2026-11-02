import { useState } from 'react'
import { useActiveScenario } from '../store/useStore'
import { useSimulation } from '../store/useSimulation'
import { Field, Select, TextArea, Badge } from './ui'
import { parseNumbers } from '../lib/format'

export type SourceKind = 'sim' | 'manual'

/**
 * Sélection de la source de données d'un outil Six Sigma :
 * mesures de la simulation (scénario actif) ou saisie / collage manuel.
 */
export function useMeasurements() {
  const sc = useActiveScenario()
  const { results } = useSimulation(sc)
  const [kind, setKind] = useState<SourceKind>('sim')
  const [text, setText] = useState('')
  const simValues = results.products.filter((p) => p.dimension !== undefined).sort((a, b) => a.history.find((h) => h.stationId === sc.process.stationId)!.start - b.history.find((h) => h.stationId === sc.process.stationId)!.start).map((p) => p.dimension!)
  const values = kind === 'sim' ? simValues : parseNumbers(text)
  const ui = (
    <div className="space-y-2">
      <Field label="Source des données">
        <Select value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
          <option value="sim">Simulation — {sc.process.characteristic.name} ({sc.name})</option>
          <option value="manual">Saisie manuelle / copier-coller</option>
        </Select>
      </Field>
      {kind === 'manual' ? (
        <Field label="Valeurs mesurées" hint="Séparateurs : espace, retour à la ligne, point-virgule. Ordre chronologique (sous-groupes consécutifs).">
          <TextArea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="25.012 24.998 25.031 …" />
        </Field>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          <Badge tone="brand">{simValues.length} mesures</Badge> pièces mesurées au poste CTQ dans l'ordre de fabrication. Modifiez les paramètres procédé pour voir l'effet.
        </p>
      )}
    </div>
  )
  return { values, ui, kind, sc, results }
}

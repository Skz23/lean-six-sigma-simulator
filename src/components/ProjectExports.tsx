import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { useCurrentProject, useStore, workspaceOf } from '../store/useStore'
import type { PhaseId } from '../workflow/phases'
import { PHASES } from '../workflow/phases'
import { Button } from './ui'

/** Boutons d'export des livrables du projet en cours (PDF générés à partir de ses données). */
export function ProjectExports({ phase }: { phase?: PhaseId }) {
  const p = useCurrentProject()
  const [busy, setBusy] = useState<string | null>(null)
  if (!p) return null
  const run = async (k: string, fn: (m: typeof import('../report/projectPdf')) => Promise<unknown>) => {
    setBusy(k)
    try {
      const m = await import('../report/projectPdf')
      await fn(m)
    } finally {
      setBusy(null)
    }
  }
  const ws = () => workspaceOf(useStore.getState(), p)
  const ph = phase && PHASES.find((x) => x.id === phase)
  return (
    <div className="flex flex-wrap gap-2">
      {ph && (
        <Button size="sm" onClick={() => run('phase', (m) => m.projectReport(p, ws(), { phase }))} disabled={!!busy}>
          <FileDown size={13} /> {busy === 'phase' ? 'Génération…' : `Revue de phase ${ph.n} (PDF)`}
        </Button>
      )}
      <Button size="sm" onClick={() => run('full', (m) => m.projectReport(p, ws()))} disabled={!!busy}>
        <FileDown size={13} /> {busy === 'full' ? 'Génération…' : 'Rapport de projet'}
      </Button>
      <Button size="sm" onClick={() => run('a3', (m) => m.a3Report(p, ws()))} disabled={!!busy}>
        <FileDown size={13} /> {busy === 'a3' ? 'Génération…' : 'A3'}
      </Button>
      <Button size="sm" onClick={() => run('8d', (m) => m.eightDReport(p, ws()))} disabled={!!busy}>
        <FileDown size={13} /> {busy === '8d' ? 'Génération…' : '8D'}
      </Button>
    </div>
  )
}

import { useState } from 'react'
import { FileDown, FileText } from 'lucide-react'
import { useStore } from '../store/useStore'
import { runScenario } from '../store/useSimulation'
import { SECTIONS } from '../report/sections'
import { METRICS, profitability } from '../engine/compare'
import { Button, Card, Delta, Field, Input, Note, PageHeader, Select, Table } from '../components/ui'
import { eur, fmt } from '../lib/format'

export default function ReportsPage() {
  const scenarios = useStore((s) => s.scenarios)
  const tools = useStore((s) => s.tools)
  const baselineId = useStore((s) => s.baselineId)
  const comparisonId = useStore((s) => s.comparisonId)
  const [b, setB] = useState(baselineId)
  const [a, setA] = useState(comparisonId)
  const [title, setTitle] = useState('Rapport d\'amélioration Lean Six Sigma')
  const [author, setAuthor] = useState('')
  const [sections, setSections] = useState<boolean[]>(SECTIONS.map(() => true))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const sb = scenarios.find((s) => s.id === b) ?? scenarios[0]
  const sa = scenarios.find((s) => s.id === a) ?? scenarios[scenarios.length - 1]
  const rb = runScenario(sb)
  const ra = runScenario(sa)
  const prof = profitability(rb.kpis, ra.kpis, sb, sa)

  const generate = async () => {
    setBusy(true)
    setErr('')
    try {
      const { generateReport } = await import('../report/pdf')
      await generateReport({ title, author, before: { sc: sb, r: rb.results, k: rb.kpis }, after: { sc: sa, r: ra.results, k: ra.kpis }, tools, sections })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader icon={<FileText size={20} />} title="Rapports et analyses" subtitle="Génération d'un rapport PDF professionnel à partir des scénarios et des outils renseignés" />
      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Paramètres du rapport" className="xl:col-span-4">
          <div className="space-y-3">
            <Field label="Titre"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Auteur"><Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Nom, fonction" /></Field>
            <Field label="Situation initiale (avant)">
              <Select value={sb.id} onChange={(e) => setB(e.target.value)}>{scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </Field>
            <Field label="Situation finale (après)">
              <Select value={sa.id} onChange={(e) => setA(e.target.value)}>{scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </Field>
            <div>
              <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Sections</div>
              <div className="space-y-1">
                {SECTIONS.map((s, i) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-[var(--color-brand-600)]" checked={sections[i]} onChange={(e) => setSections(sections.map((x, j) => (j === i ? e.target.checked : x)))} />
                    {i + 1}. {s}
                  </label>
                ))}
              </div>
            </div>
            <Button variant="primary" className="w-full" onClick={generate} disabled={busy || !sections.some(Boolean)}>
              <FileDown size={16} /> {busy ? 'Génération…' : 'Générer le rapport PDF'}
            </Button>
            {err && <p className="text-sm text-[var(--critical)]">{err}</p>}
          </div>
        </Card>
        <div className="space-y-4 xl:col-span-8">
          <Card title="Aperçu — comparaison des indicateurs" subtitle={`${sb.name} → ${sa.name}`}>
            <Table
              dense
              head={['Indicateur', 'Avant', 'Après', 'Variation']}
              rows={METRICS.map((m) => [m.label, m.format(m.get(rb.kpis, sb)), m.format(m.get(ra.kpis, sa)), <Delta key="d" a={m.get(rb.kpis, sb)} b={m.get(ra.kpis, sa)} up={m.higherIsBetter} />])}
            />
          </Card>
          <Card title="Aperçu — gains économiques">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div><div className="text-xs text-[var(--muted)]">Gain annuel</div><div className="text-lg font-semibold">{eur(prof.annualGain)}</div></div>
              <div><div className="text-xs text-[var(--muted)]">Investissement</div><div className="text-lg font-semibold">{eur(prof.investment)}</div></div>
              <div><div className="text-xs text-[var(--muted)]">ROI</div><div className="text-lg font-semibold">{Number.isFinite(prof.roi) ? `${fmt(prof.roi * 100, 0)} %` : '—'}</div></div>
              <div><div className="text-xs text-[var(--muted)]">Retour</div><div className="text-lg font-semibold">{Number.isFinite(prof.paybackMonths) ? `${fmt(prof.paybackMonths, 1)} mois` : '—'}</div></div>
            </div>
          </Card>
          <Note>Le rapport reprend les données de la journée simulée de chaque scénario, l'analyse des gaspillages, la capabilité, le projet DMAIC associé au scénario initial, les actions et Kaizen, ainsi que des recommandations générées à partir des écarts restants.</Note>
        </div>
      </div>
    </div>
  )
}

import { ask, notify } from '../lib/dialog'
import { saveFile } from '../lib/download'
import { useRef, useState } from 'react'
import clsx from 'clsx'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { Copy, Download, FolderKanban, History, Play, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { useStore } from '../store/useStore'
import { runScenario } from '../store/useSimulation'
import { METRICS, profitability } from '../engine/compare'
import type { ScenarioKind } from '../engine/types'
import { Badge, Button, Card, Delta, Input, Note, PageHeader, Select, Table, TextArea } from '../components/ui'
import { ChartBox, S, axisProps, tooltipStyle } from '../components/charts'
import { eur, fmt } from '../lib/format'

const KIND: Record<ScenarioKind, { label: string; tone: 'neutral' | 'info' | 'good' | 'brand' | 'warning' }> = {
  initial: { label: 'Situation initiale', tone: 'neutral' },
  lean: { label: 'Amélioration Lean', tone: 'info' },
  sixsigma: { label: 'Amélioration Six Sigma', tone: 'warning' },
  lss: { label: 'Lean Six Sigma', tone: 'good' },
  custom: { label: 'Personnalisé', tone: 'brand' },
}

export default function ScenariosPage() {
  const st = useStore()
  const { scenarios, activeId, versions } = st
  const [selected, setSelected] = useState<string[]>(scenarios.map((s) => s.id))
  const [metric, setMetric] = useState('leadTime')
  const [histFor, setHistFor] = useState(activeId)
  const fileRef = useRef<HTMLInputElement>(null)
  const sel = scenarios.filter((s) => selected.includes(s.id))
  const base = sel[0]
  const runs = sel.map((s) => ({ s, k: runScenario(s).kpis }))
  const m = METRICS.find((x) => x.key === metric)!

  const exportJson = () => {
    const data = JSON.stringify({ app: 'lean-six-sigma-simulator', version: 1, exportedAt: new Date().toISOString(), scenarios, tools: st.tools, versions }, null, 2)
    saveFile(`lss-simulator-${new Date().toISOString().slice(0, 10)}.json`, new Blob([data], { type: 'application/json' })).catch((e) => notify((e as Error).message))
  }
  const importJson = async (f: File) => {
    try {
      const d = JSON.parse(await f.text())
      if (!Array.isArray(d.scenarios) || !d.scenarios.length) throw new Error('Fichier invalide : aucun scénario')
      st.importAll({ scenarios: d.scenarios, tools: d.tools ?? st.tools, versions: d.versions ?? {}, activeId: d.scenarios[0].id, baselineId: d.scenarios[0].id, comparisonId: d.scenarios[d.scenarios.length - 1].id })
      setSelected(d.scenarios.map((s: { id: string }) => s.id))
    } catch (e) {
      notify(`Import impossible : ${(e as Error).message}`)
    }
  }

  const hist = versions[histFor] ?? []

  return (
    <div>
      <PageHeader
        icon={<FolderKanban size={20} />}
        title="Gestion des scénarios"
        subtitle="Sauvegarder, comparer et restaurer des configurations de production"
        actions={
          <>
            <Button onClick={exportJson}><Download size={15} /> Exporter</Button>
            <Button onClick={() => fileRef.current?.click()}><Upload size={15} /> Importer</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            <Button variant="danger" onClick={() => ask('Réinitialiser toutes les données avec le jeu de démonstration ?') && st.resetDemo()}><RotateCcw size={15} /> Données de démo</Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {scenarios.map((s) => {
          const k = runScenario(s).kpis
          return (
            <div key={s.id} className={clsx('flex flex-col rounded-xl border-2 bg-[var(--surface-1)] p-3', s.id === activeId ? 'border-brand-500' : 'border-black/[.08] dark:border-white/10')}>
              <div className="flex items-start justify-between gap-2">
                <Badge tone={KIND[s.kind].tone}>{KIND[s.kind].label}</Badge>
                <input type="checkbox" className="accent-[var(--color-brand-600)]" title="Inclure dans la comparaison" checked={selected.includes(s.id)} onChange={(e) => setSelected(e.target.checked ? scenarios.filter((x) => x.id === s.id || selected.includes(x.id)).map((x) => x.id) : selected.filter((x) => x !== s.id))} />
              </div>
              <Input className="mt-2 font-semibold" value={s.name} onChange={(e) => st.updateScenario(s.id, (x) => (x.name = e.target.value))} />
              <TextArea className="mt-1.5 min-h-[56px] text-xs" value={s.description} onChange={(e) => st.updateScenario(s.id, (x) => (x.description = e.target.value))} />
              <Select className="mt-1.5 text-xs" value={s.kind} onChange={(e) => st.updateScenario(s.id, (x) => (x.kind = e.target.value as ScenarioKind))}>
                {Object.entries(KIND).map(([k2, v]) => <option key={k2} value={k2}>{v.label}</option>)}
              </Select>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
                <div className="rounded bg-black/[.03] py-1 dark:bg-white/[.05]"><div className="text-[var(--muted)]">LT</div><b>{fmt(k.leadTime / 60, 0)} min</b></div>
                <div className="rounded bg-black/[.03] py-1 dark:bg-white/[.05]"><div className="text-[var(--muted)]">Bonnes</div><b>{k.good}</b></div>
                <div className="rounded bg-black/[.03] py-1 dark:bg-white/[.05]"><div className="text-[var(--muted)]">Cpk</div><b>{fmt(k.dimension?.cpk, 2)}</b></div>
              </div>
              <div className="mt-2 text-[10px] text-[var(--muted)]">Modifié le {new Date(s.updatedAt).toLocaleString('fr-FR')} · {(versions[s.id] ?? []).length} version(s)</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant={s.id === activeId ? 'primary' : 'secondary'} onClick={() => st.setActive(s.id)}><Play size={12} /> {s.id === activeId ? 'Actif' : 'Activer'}</Button>
                <Button size="sm" onClick={() => st.duplicateScenario(s.id)} title="Dupliquer"><Copy size={12} /></Button>
                <Button size="sm" onClick={() => st.saveVersion(s.id, `Version du ${new Date().toLocaleString('fr-FR')}`)} title="Enregistrer une version"><Save size={12} /></Button>
                <Button size="sm" onClick={() => setHistFor(s.id)} title="Historique"><History size={12} /></Button>
                <Button size="sm" variant="danger" disabled={scenarios.length <= 1} onClick={() => ask(`Supprimer « ${s.name} » ?`) && st.deleteScenario(s.id)} title="Supprimer"><Trash2 size={12} /></Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Comparaison avant / après" subtitle={base ? `Référence : ${base.name} (premier scénario coché)` : 'Cochez des scénarios'} className="xl:col-span-8">
          {base && (
            <Table
              dense
              head={['Indicateur', ...runs.map((r) => r.s.name), ...(runs.length > 1 ? [`Écart ${runs[runs.length - 1].s.name}`] : [])]}
              rows={METRICS.map((mt) => [
                <span key="l" className="text-xs">{mt.label}</span>,
                ...runs.map((r) => <span key={r.s.id} className="text-xs">{mt.format(mt.get(r.k, r.s))}</span>),
                ...(runs.length > 1 ? [<Delta key="d" a={mt.get(runs[0].k, runs[0].s)} b={mt.get(runs[runs.length - 1].k, runs[runs.length - 1].s)} up={mt.higherIsBetter} />] : []),
              ])}
            />
          )}
        </Card>
        <div className="space-y-4 xl:col-span-4">
          <Card title="Évolution d'un indicateur" actions={
            <Select value={metric} onChange={(e) => setMetric(e.target.value)} className="w-48">
              {METRICS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </Select>
          }>
            <ChartBox height={220}>
              <LineChart data={runs.map((r) => ({ name: r.s.name, v: m.get(r.k, r.s) }))} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 9 }} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipStyle} formatter={(v) => [m.format(Number(v)), m.label]} />
                <Legend verticalAlign="top" height={20} iconSize={10} />
                <Line dataKey="v" name={m.label} stroke={S(0)} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ChartBox>
          </Card>
          <Card title="Gains économiques vs référence">
            {base && runs.length > 1 ? (
              <Table
                dense
                head={['Scénario', 'Gain / an', 'Invest.', 'Retour']}
                rows={runs.slice(1).map((r) => {
                  const p = profitability(runs[0].k, r.k, runs[0].s, r.s)
                  return [r.s.name, eur(p.annualGain), eur(p.investment), Number.isFinite(p.paybackMonths) ? `${fmt(p.paybackMonths, 1)} mois` : '—']
                })}
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">Sélectionnez au moins deux scénarios.</p>
            )}
          </Card>
        </div>
        <Card title="Historique des versions" subtitle="Une version est créée à chaque sauvegarde manuelle et avant chaque modification appliquée depuis un outil (SMED, kanban, DOE…)" className="xl:col-span-12" actions={
          <Select value={histFor} onChange={(e) => setHistFor(e.target.value)} className="w-56">
            {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        }>
          {hist.length ? (
            <Table
              dense
              head={['Date', 'Libellé', 'Lead Time', 'Pièces bonnes', 'Cpk', '']}
              rows={hist.map((v) => {
                const k = runScenario(v.scenario).kpis
                return [
                  new Date(v.at).toLocaleString('fr-FR'),
                  v.label,
                  `${fmt(k.leadTime / 60, 0)} min`,
                  k.good,
                  fmt(k.dimension?.cpk, 2),
                  <Button key="r" size="sm" onClick={() => ask('Restaurer cette version ? L\'état actuel sera sauvegardé.') && st.restoreVersion(histFor, v.id)}><RotateCcw size={12} /> Restaurer</Button>,
                ]
              })}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">Aucune version enregistrée pour ce scénario.</p>
          )}
        </Card>
      </div>
      <div className="mt-4">
        <Note>Les données sont enregistrées dans le navigateur (localStorage). Utilisez Exporter / Importer pour les sauvegarder dans un fichier ou les transférer sur un autre poste.</Note>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Download, Plus, SearchCheck, Trash2 } from 'lucide-react'
import { useActiveScenario, useStore, uid } from '../../store/useStore'
import { useSimulation } from '../../store/useSimulation'
import { Button, Card, Field, Input, Kpi, Note, NumberInput, PageHeader, Select, Table, Tabs } from '../../components/ui'
import { ParetoChart } from '../../components/charts'
import { FiveWhyEditor, FmeaTable, IshikawaDiagram, IshikawaEditor, rpn } from '../../components/QualityTools'
import { eur, fmt, pct } from '../../lib/format'
import type { DmaicProject } from '../../store/types'

type Tab = 'log' | 'pareto' | 'ishikawa' | 'why' | 'fmea' | 'root'

export default function DefectsPage() {
  const sc = useActiveScenario()
  const { kpis, results } = useSimulation(sc)
  const tools = useStore((s) => s.tools)
  const setTools = useStore((s) => s.setTools)
  const [tab, setTab] = useState<Tab>('pareto')
  const [source, setSource] = useState<'sim' | 'log'>('sim')
  const [paretoBy, setParetoBy] = useState<'count' | 'cost'>('count')
  const [threshold, setThreshold] = useState(100)
  const [projectId, setProjectId] = useState(tools.dmaic[0]?.id)
  const project = tools.dmaic.find((p) => p.id === projectId)
  const setProject = (fn: (p: DmaicProject) => void) =>
    setTools((t) => {
      const p = t.dmaic.find((x) => x.id === projectId)
      if (p) fn(p)
    })

  const log = tools.defectLog
  const simItems = kpis.defectsByType.map((d) => {
    const stName = sc.stations.find((s) => s.id === d.stationId)?.name ?? d.stationId
    return { label: d.type, count: d.count, station: stName }
  })
  const logAgg = Object.values(
    log.reduce<Record<string, { label: string; count: number; cost: number }>>((acc, d) => {
      const e = acc[d.category] ?? { label: d.category, count: 0, cost: 0 }
      e.count += d.count
      e.cost += d.count * d.cost
      acc[d.category] = e
      return acc
    }, {}),
  )
  const paretoItems = source === 'sim' ? simItems.map((x) => ({ label: x.label, count: x.count })) : logAgg.map((x) => ({ label: x.label, count: paretoBy === 'cost' ? Math.round(x.cost) : x.count }))
  const total = paretoItems.reduce((s, x) => s + x.count, 0)
  const sortedP = [...paretoItems].sort((a, b) => b.count - a.count)
  let cum = 0
  const vital = sortedP.filter((x) => {
    const before = cum
    cum += x.count
    return before / total < 0.8
  })

  const importFromSim = () =>
    setTools((t) => {
      const d = new Date().toISOString().slice(0, 10)
      for (const x of simItems) t.defectLog.push({ id: uid('d'), date: d, category: x.label, station: x.station, count: x.count, consequence: 'Rebut', cost: sc.costs.materialCost })
    })

  return (
    <div>
      <PageHeader icon={<SearchCheck size={20} />} title="Analyse des défauts" subtitle="Registre, Pareto, Ishikawa 6M, 5 Pourquoi, AMDEC et causes racines" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Défauts simulés (jour)" value={results.scrap} hint={`${pct(1 - kpis.yield, 2)} des pièces sorties`} />
        <Kpi label="Coût de non-qualité" value={eur(kpis.costs.copq)} unit="/ jour" />
        <Kpi label="Défauts enregistrés (registre)" value={fmt(log.reduce((s, d) => s + d.count, 0), 0)} />
        <Kpi label="NPR max (AMDEC)" value={Math.max(0, ...tools.fmea.map(rpn))} tone={Math.max(0, ...tools.fmea.map(rpn)) >= threshold ? 'critical' : undefined} />
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'pareto', label: 'Pareto' },
          { id: 'log', label: 'Registre des défauts' },
          { id: 'ishikawa', label: 'Ishikawa 6M' },
          { id: 'why', label: '5 Pourquoi' },
          { id: 'fmea', label: 'AMDEC / NPR' },
          { id: 'root', label: 'Causes racines' },
        ]}
      />
      {tab === 'pareto' && (
        <div className="grid gap-4 xl:grid-cols-12">
          <Card title="Diagramme de Pareto" subtitle="Barres : part de chaque catégorie · courbe : cumul · seuil 80 % (loi de Pareto)" className="xl:col-span-8" actions={
            <div className="flex gap-2">
              <Select value={source} onChange={(e) => setSource(e.target.value as 'sim' | 'log')} className="w-44">
                <option value="sim">Simulation (jour)</option>
                <option value="log">Registre des défauts</option>
              </Select>
              {source === 'log' && (
                <Select value={paretoBy} onChange={(e) => setParetoBy(e.target.value as 'count' | 'cost')} className="w-32">
                  <option value="count">Fréquence</option>
                  <option value="cost">Coût (€)</option>
                </Select>
              )}
            </div>
          }>
            {paretoItems.length ? <ParetoChart items={paretoItems} height={330} /> : <p className="text-sm text-[var(--muted)]">Aucun défaut.</p>}
          </Card>
          <Card title="Catégories vitales" subtitle="≈ 80 % des défauts" className="xl:col-span-4">
            <Table dense head={['Catégorie', 'Nombre', 'Part']} rows={sortedP.map((x) => [vital.includes(x) ? <b key="b">{x.label}</b> : x.label, fmt(x.count, 0), pct(x.count / total, 1)])} />
            <div className="mt-3">
              <Note tone="tip">Concentrer l'effort sur les {vital.length} catégorie(s) vitale(s) : {vital.map((v) => v.label).join(', ')}.</Note>
            </div>
          </Card>
        </div>
      )}
      {tab === 'log' && (
        <Card title="Registre des défauts" subtitle="Enregistrement manuel : catégorie, poste, fréquence et conséquence" actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={importFromSim}><Download size={13} /> Importer la simulation</Button>
            <Button size="sm" variant="primary" onClick={() => setTools((t) => t.defectLog.push({ id: uid('d'), date: new Date().toISOString().slice(0, 10), category: 'Nouveau défaut', station: sc.stations[0].name, count: 1, consequence: 'Rebut', cost: 10 }))}><Plus size={13} /> Défaut</Button>
          </div>
        }>
          <div className="space-y-2">
            <div className="hidden grid-cols-[130px_1.3fr_1fr_90px_130px_110px_32px] gap-2 text-[11px] font-medium text-[var(--muted)] md:grid">
              <span>Date</span><span>Catégorie</span><span>Poste</span><span>Fréquence</span><span>Conséquence</span><span>Coût unitaire</span><span />
            </div>
            {log.map((d, i) => (
              <div key={d.id} className="grid grid-cols-2 gap-2 md:grid-cols-[130px_1.3fr_1fr_90px_130px_110px_32px]">
                <Input type="date" value={d.date} onChange={(e) => setTools((t) => (t.defectLog[i].date = e.target.value))} />
                <Input value={d.category} onChange={(e) => setTools((t) => (t.defectLog[i].category = e.target.value))} />
                <Select value={d.station} onChange={(e) => setTools((t) => (t.defectLog[i].station = e.target.value))}>
                  {[...new Set([d.station, ...sc.stations.map((s) => s.name)])].map((s) => <option key={s}>{s}</option>)}
                </Select>
                <NumberInput value={d.count} min={0} step={1} onChange={(v) => setTools((t) => (t.defectLog[i].count = Math.round(v)))} />
                <Select value={d.consequence} onChange={(e) => setTools((t) => (t.defectLog[i].consequence = e.target.value))}>
                  {['Rebut', 'Retouche', 'Dérogation', 'Réclamation client'].map((s) => <option key={s}>{s}</option>)}
                </Select>
                <NumberInput value={d.cost} min={0} step={1} suffix="€" onChange={(v) => setTools((t) => (t.defectLog[i].cost = v))} />
                <Button size="sm" variant="danger" onClick={() => setTools((t) => t.defectLog.splice(i, 1))} aria-label="Supprimer"><Trash2 size={13} /></Button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">Coût total enregistré : {eur(log.reduce((s, d) => s + d.count * d.cost, 0))}</p>
        </Card>
      )}
      {(tab === 'ishikawa' || tab === 'why' || tab === 'root') && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">Projet DMAIC :</span>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-96">
            {tools.dmaic.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
      )}
      {tab === 'ishikawa' && project && (
        <div className="space-y-4">
          <Card title="Diagramme d'Ishikawa (6M)">
            <IshikawaDiagram effect={project.charter.problem.split('.')[0].slice(0, 60) || project.name} causes={project.causes} />
          </Card>
          <Card title="Causes par catégorie">
            <IshikawaEditor causes={project.causes} onChange={(c) => setProject((p) => (p.causes = c))} />
          </Card>
        </div>
      )}
      {tab === 'why' && project && (
        <Card title="Méthode des 5 Pourquoi" subtitle="Remonter la chaîne causale jusqu'à une cause sur laquelle agir">
          <FiveWhyEditor chains={project.whys} onChange={(w) => setProject((p) => (p.whys = w))} />
        </Card>
      )}
      {tab === 'fmea' && (
        <Card title="AMDEC — Analyse des Modes de Défaillance, de leurs Effets et de leur Criticité" subtitle="NPR (RPN) = Gravité × Occurrence × Détection · trié par criticité décroissante" actions={
          <Field label="Seuil de criticité NPR"><NumberInput value={threshold} min={1} max={1000} step={10} onChange={setThreshold} className="w-28" /></Field>
        }>
          <FmeaTable rows={tools.fmea} onChange={(r) => setTools((t) => (t.fmea = r))} threshold={threshold} />
        </Card>
      )}
      {tab === 'root' && project && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Synthèse des causes racines">
            <ul className="space-y-2 text-sm">
              {project.whys.filter((w) => w.rootCause).map((w) => (
                <li key={w.id} className="rounded-lg bg-black/[.03] p-2.5 dark:bg-white/[.05]">
                  <div className="text-xs text-[var(--muted)]">{w.problem}</div>
                  <div className="font-semibold text-[var(--critical)]">{w.rootCause}</div>
                </li>
              ))}
              {project.causes.filter((c) => c.likely).map((c) => (
                <li key={c.id} className="flex items-center gap-2"><span className="text-xs text-[var(--muted)]">{c.category}</span> {c.text}</li>
              ))}
            </ul>
          </Card>
          <Card title="Vérification par les données">
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <p>Une cause racine supposée doit être <b>confirmée statistiquement</b> avant d'agir :</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Corrélation / régression entre le paramètre suspecté (ex. température) et la caractéristique — <i>Statistiques avancées</i>.</li>
                <li>Comparaison avant/après ou entre lots (test t, ANOVA).</li>
                <li>Plan d'expériences pour quantifier les effets et interactions.</li>
                <li>Cartes de contrôle pour relier les signaux aux événements (changements de série).</li>
              </ul>
              <Note>Dans le jeu de démonstration, la température de broche explique une large part du décalage de moyenne : vérifiez-le avec la régression « Température → Diamètre ».</Note>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

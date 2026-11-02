import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { Gauge } from 'lucide-react'
import { useActiveScenario } from '../../store/useStore'
import { useSimulation } from '../../store/useSimulation'
import { Card, Kpi, Note, PageHeader, Table, Badge } from '../../components/ui'
import { ChartBox, OeeBars, S, StationStatesChart, axisProps, tooltipStyle } from '../../components/charts'
import { lineBalance } from '../../lean/tools'
import { duration, fmt, pct, eur } from '../../lib/format'
import { histogram } from '../../stats/descriptive'

export default function LeanKpis() {
  const sc = useActiveScenario()
  const { results: r, kpis: k } = useSimulation(sc)
  const effCT = r.stations.map((s, i) => s.nominalCycleTime / Math.max(sc.stations[i].availability, 0.01) + (sc.stations[i].changeoverTime * 60) / Math.max(1, sc.batchSize))
  const bal = lineBalance(sc, effCT, k.taktTime)
  const lts = r.products.filter((p) => !p.preloaded && p.status === 'good' && p.exit !== undefined).map((p) => (p.exit! - p.release) / 60)
  const ltHist = histogram(lts, 20)

  const rows: [string, string, string, string][] = [
    ['Takt Time', `${fmt(k.taktTime, 1)} s`, 'Temps disponible / demande client', 'Rythme imposé par le client'],
    ['Cycle Time (goulot effectif)', `${fmt(k.bottleneckCycleTime, 1)} s`, 'CT / (capacité × dispo.) + C/O / lot', k.bottleneckCycleTime <= k.taktTime ? 'Inférieur au takt : capacité suffisante' : 'Supérieur au takt : la demande ne peut pas être tenue'],
    ['Cycle Time ligne (observé)', `${fmt(k.lineCycleTime, 1)} s`, 'Temps planifié / pièces bonnes', 'Intervalle moyen entre deux pièces bonnes'],
    ['Lead Time (Little)', duration(k.leadTime), 'WIP moyen / débit de sortie', 'Temps de traversée moyen'],
    ['Lead Time observé', duration(k.leadTimeObserved * 1), 'Moyenne (sortie − lancement) des pièces lancées et terminées le jour même', 'Biaisé vers le bas si les pièces lentes ne sortent pas le jour même'],
    ['Throughput', `${fmt(k.throughputPerHour, 1)} pcs/h`, 'Pièces bonnes / heures planifiées', `${k.good} pièces bonnes`],
    ['Work In Progress', `${fmt(k.wipAvg, 1)} pcs`, 'Moyenne temporelle des pièces dans la ligne', `Fin de journée : ${k.wipEnd} pcs`],
    ['TRS / OEE', pct(k.oee), 'Temps utile / temps requis = Disponibilité × Performance × Qualité (goulot)', k.oee >= 0.85 ? 'World class' : k.oee >= 0.65 ? 'Acceptable' : 'Faible'],
    ['TRG', pct(k.trg), 'Temps utile / temps d\'ouverture (pauses et arrêts planifiés compris)', 'Toujours ≤ TRS : mesure l\'utilisation globale du temps d\'ouverture'],
    ['Productivité', `${fmt(k.productivity, 2)} pcs/h·op`, 'Pièces bonnes / (opérateurs × heures d\'ouverture)', `${k.operators} opérateurs`],
    ['Taux de rendement (yield)', pct(k.yield, 2), 'Pièces bonnes / pièces sorties', `RTY = Π qualités postes = ${pct(k.rty, 1)}`],
    ['Temps à valeur ajoutée', `${fmt(k.vaTime, 0)} s`, 'Σ CT des opérations à valeur ajoutée', 'Ce que le client paie'],
    ['Temps sans valeur ajoutée', duration(k.nvaTime), 'Lead Time − temps VA', 'Attentes, transports, contrôles…'],
    ['Process Cycle Efficiency', pct(k.pce, 2), 'Temps VA / Lead Time', k.pce < 0.05 ? 'Typique d\'un flux poussé (< 5 %)' : 'Flux performant'],
    ['Ratio de tension de flux (RTF)', pct(k.rtf, 2), 'Σ VA / (Σ VA + Takt × Σ en-cours)', 'Part de valeur ajoutée dans le flux (analyse rouge / vert)'],
  ]

  return (
    <div>
      <PageHeader icon={<Gauge size={20} />} title="Indicateurs Lean" subtitle={`${sc.name} — calculés automatiquement à partir de la journée simulée`} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Takt Time" value={fmt(k.taktTime, 1)} unit="s" />
        <Kpi label="CT goulot" value={fmt(k.bottleneckCycleTime, 1)} unit="s" tone={k.bottleneckCycleTime > k.taktTime ? 'critical' : 'good'} />
        <Kpi label="Lead Time" value={duration(k.leadTime)} />
        <Kpi label="Throughput" value={fmt(k.throughputPerHour, 1)} unit="pcs/h" />
        <Kpi label="WIP moyen" value={fmt(k.wipAvg, 0)} unit="pcs" />
        <Kpi label="PCE" value={pct(k.pce, 1)} hint="Temps VA / Lead Time" />
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Tableau des indicateurs" subtitle="Valeur, formule et interprétation" className="xl:col-span-7">
          <Table dense head={['Indicateur', 'Valeur', 'Formule', 'Lecture']} rows={rows.map((r2) => [<b key="l">{r2[0]}</b>, r2[1], <span key="f" className="text-xs text-[var(--text-secondary)]">{r2[2]}</span>, <span key="c" className="text-xs text-[var(--muted)]">{r2[3]}</span>])} />
        </Card>
        <div className="space-y-4 xl:col-span-5">
          <Card title="TRS / OEE">
            <OeeBars a={k.oeeAvailability} p={k.oeePerformance} q={k.oeeQuality} oee={k.oee} />
          </Card>
          <Card title="Temps VA / NVA d'une pièce">
            <div className="space-y-2">
              <div className="flex h-6 overflow-hidden rounded-md">
                <div style={{ width: `${Math.max(1.5, k.pce * 100)}%`, background: 'var(--good)' }} title="VA" />
                <div className="flex-1" style={{ background: 'var(--serious)', opacity: 0.6 }} title="NVA" />
              </div>
              <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                <span>VA : {fmt(k.vaTime, 0)} s</span>
                <span>NVA : {duration(k.nvaTime)}</span>
              </div>
              <p className="text-xs text-[var(--muted)]">Attente moyenne en file par pièce : {duration(k.avgWaitPerPart)} · manutention : {duration(k.avgTransportPerPart)}</p>
            </div>
          </Card>
        </div>

        <Card title="Équilibrage de ligne (Yamazumi)" subtitle={`Charge effective par poste vs takt · efficience d'équilibrage ${pct(bal.efficiency, 0)} · nombre minimal théorique de postes : ${bal.minStations}`} className="xl:col-span-7">
          <ChartBox height={260}>
            <BarChart data={bal.loads.map((l) => ({ name: l.name, load: l.load }))} margin={{ top: 16, right: 50, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis {...axisProps} unit=" s" />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${fmt(Number(v), 1)} s`, 'Temps effectif']} />
              <ReferenceLine y={k.taktTime} stroke="var(--critical)" strokeDasharray="6 4" label={{ value: `Takt ${fmt(k.taktTime, 1)} s`, position: 'right', fill: 'var(--critical)', fontSize: 11 }} />
              <Bar dataKey="load" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={56}>
                {bal.loads.map((l, i) => (
                  <Cell key={i} fill={l.load > k.taktTime ? 'var(--critical)' : S(0)} />
                ))}
              </Bar>
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Répartition du temps par poste" className="xl:col-span-5">
          <StationStatesChart stations={r.stations} />
        </Card>

        <Card title="TRS par poste" className="xl:col-span-7">
          <Table
            dense
            head={['Poste', 'Disponibilité', 'Performance', 'Qualité', 'TRS', 'Pannes', 'C/O', 'File moy.', '']}
            rows={r.stations.map((s, i) => [
              s.name,
              pct(s.oee.availability),
              pct(s.oee.performance),
              pct(s.oee.quality),
              <b key="o">{pct(s.oee.oee)}</b>,
              s.failures,
              s.changeovers,
              fmt(s.avgQueue, 1),
              i === r.bottleneckIndex ? <Badge tone="critical">goulot</Badge> : '',
            ])}
          />
          <p className="mt-2 text-xs text-[var(--muted)]">La performance d'un poste non goulot est faible par construction (famine/blocage) : seul le TRS du goulot pilote le débit de la ligne.</p>
        </Card>
        <Card title="Distribution du Lead Time observé" subtitle={`${lts.length} pièces lancées et terminées dans la journée`} className="xl:col-span-5">
          {lts.length > 5 ? (
            <ChartBox height={230}>
              <BarChart data={ltHist.map((b) => ({ x: fmt(b.mid, 0), n: b.count }))} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={1}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="x" {...axisProps} unit=" min" minTickGap={20} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Pièces']} labelFormatter={(l) => `${l} min`} />
                <Legend verticalAlign="top" height={0} />
                <Bar dataKey="n" fill={S(0)} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartBox>
          ) : (
            <p className="text-sm text-[var(--muted)]">Trop peu de pièces traversent la ligne dans la journée : le Lead Time dépasse la journée (voir loi de Little).</p>
          )}
        </Card>
      </div>
      <Card title="Théorie des contraintes (TOC) appliquée à votre ligne" subtitle="Les 5 étapes de focalisation de Goldratt : une heure perdue au goulot est une heure perdue pour tout le système" className="mt-4">
        <ol className="grid gap-3 text-sm md:grid-cols-5">
          {[
            ['Identifier', `La contrainte est « ${r.stations[r.bottleneckIndex].name} » (actif ${pct(r.stations[r.bottleneckIndex].activeRatio, 0)} du temps).`],
            ['Exploiter', `Ne jamais l'arrêter : TRS du goulot ${pct(r.stations[r.bottleneckIndex].oee.oee, 0)} — réduire pannes (TPM), changements de série (SMED) et rebuts en amont de lui.`],
            ['Subordonner', 'Caler le reste du flux sur son rythme : tampon de protection devant le goulot, lancement au rythme du goulot (Drum-Buffer-Rope / kanban).'],
            ['Élever', 'Si ce n\'est pas suffisant : augmenter sa capacité (machine supplémentaire, rééquilibrage, heures supplémentaires sur ce poste seulement).'],
            ['Recommencer', 'Une fois levée, la contrainte se déplace : refaire l\'analyse (Plan d\'amélioration).'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-lg bg-black/[.03] p-3 dark:bg-white/[.05]">
              <div className="font-semibold">{i + 1}. {t}</div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{d}</p>
            </li>
          ))}
        </ol>
      </Card>
      <div className="mt-4">
        <Note title="Économie de la journée">
          Marge : <b>{eur(k.costs.margin)}</b> · coût de possession des encours : {eur(k.costs.holding)} · pénalités de retard : {eur(k.costs.latePenalty)} · coût de revient d'une pièce bonne : {eur(k.costs.costPerGoodPart, 2)}.
        </Note>
      </div>
    </div>
  )
}

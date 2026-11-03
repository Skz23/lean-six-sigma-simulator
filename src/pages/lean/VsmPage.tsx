import { Map as MapIcon, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveScenario } from '../../store/useStore'
import { useSimulation } from '../../store/useSimulation'
import { vsmData } from '../../lean/tools'
import { Button, Card, Kpi, Note, PageHeader, Table } from '../../components/ui'
import { duration, fmt, pct } from '../../lib/format'

export default function VsmPage() {
  const sc = useActiveScenario()
  const { results } = useSimulation(sc)
  const v = vsmData(sc, results)
  const n = v.boxes.length
  const BW = 130
  const GAP = 70
  const X0 = 30
  const W = X0 * 2 + n * BW + (n - 1) * GAP + 40
  const H = 470
  const procY = 170
  const secPerDay = (sc.shift.duration - sc.shift.breaks.reduce((s, b) => s + b.duration, 0)) * 60

  const opportunities = [
    ...v.boxes.filter((b) => b.inventoryDays > 0.25).map((b) => `Stock élevé après « ${b.name} » : ${fmt(b.inventoryAfter, 0)} pcs (${fmt(b.inventoryDays, 2)} j) → plafonner par kanban / FIFO.`),
    ...v.boxes.filter((b) => b.co >= 15).map((b) => `Changement de série long sur « ${b.name} » (${b.co} min) → chantier SMED.`),
    ...v.boxes.filter((b) => b.uptime < 0.93).map((b) => `Disponibilité faible sur « ${b.name} » (${pct(b.uptime, 0)}) → TPM.`),
    ...v.boxes.filter((b) => !b.valueAdded).map((b) => `« ${b.name} » est sans valeur ajoutée → réduire / intégrer (autocontrôle, emballage au poste).`),
    ...(sc.releasePolicy === 'push' ? ['Flux poussé : mettre en place un supermarché et un flux tiré depuis l\'expédition (point de pilotage unique).'] : []),
  ]

  return (
    <div>
      <PageHeader
        icon={<MapIcon size={20} />}
        title="Value Stream Mapping (VSM)"
        subtitle={`Calculée automatiquement à partir de la ligne « ${sc.name} » et de sa journée simulée`}
        actions={<Link to="/lean/line"><Button><Pencil size={14} /> Modifier la ligne</Button></Link>}
      />
      <div className="mb-4">
        <Note>La VSM n'a pas de données propres : elle est recalculée à chaque modification de la ligne (postes, temps de cycle, changements de série, stocks, demande). Pour la changer, modifiez la ligne de production.</Note>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Lead Time global" value={fmt(v.leadDays, 2)} unit="jours" hint={duration(v.leadSeconds)} />
        <Kpi label="Temps à valeur ajoutée" value={fmt(v.vaSeconds, 0)} unit="s" />
        <Kpi label="Temps sans valeur ajoutée" value={duration(v.nvaSeconds)} />
        <Kpi label="Process Cycle Efficiency" value={pct(v.pce, 2)} hint="VA / Lead Time" tone={v.pce < 0.01 ? 'critical' : undefined} />
        <Kpi label="Temps de manutention" value={fmt(v.transportSeconds, 0)} unit="s/pièce" />
      </div>
      <Card title="Cartographie de la chaîne de valeur" subtitle="État actuel du scénario sélectionné · stocks = encours moyens simulés" className="mb-4" bodyClass="p-2">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 900 }} className="h-auto w-full font-sans" role="img" aria-label="VSM">
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--text-secondary)" />
              </marker>
              <pattern id="push" width="10" height="10" patternUnits="userSpaceOnUse">
                <rect width="5" height="10" fill="var(--text-secondary)" />
              </pattern>
            </defs>
            {/* Fournisseur / pilotage / client */}
            <Factory x={X0} y={20} label="Aciérie" sub="Barres C45" />
            <rect x={W / 2 - 90} y={20} width={180} height={52} rx={4} fill="var(--surface-1)" stroke="var(--text-secondary)" />
            <text x={W / 2} y={42} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-primary)">
              Pilotage de production
            </text>
            <text x={W / 2} y={60} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
              {sc.releasePolicy === 'push' ? 'MRP — ordres poussés' : 'Kanban — flux tiré'}
            </text>
            <Factory x={W - X0 - 120} y={20} label="Client" sub={`${sc.demand} pcs/j · takt ${fmt(results.taktTime, 1)} s`} />
            <line x1={W - X0 - 120} y1={46} x2={W / 2 + 90} y2={46} stroke="var(--text-secondary)" strokeDasharray="4 3" markerEnd="url(#arr)" />
            <line x1={W / 2 - 90} y1={46} x2={X0 + 120} y2={46} stroke="var(--text-secondary)" strokeDasharray="4 3" markerEnd="url(#arr)" />

            {v.boxes.map((b, i) => {
              const x = X0 + i * (BW + GAP)
              return (
                <g key={b.id}>
                  {/* Process box */}
                  <rect x={x} y={procY} width={BW} height={34} rx={3} fill={b.valueAdded ? 'var(--series-1)' : 'var(--axis)'} fillOpacity={b.valueAdded ? 0.16 : 0.4} stroke="var(--text-secondary)" />
                  <text x={x + BW / 2} y={procY + 21} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-primary)">
                    {b.name.length > 19 ? b.name.slice(0, 18) + '…' : b.name}
                  </text>
                  <rect x={x} y={procY + 34} width={BW} height={78} fill="var(--surface-1)" stroke="var(--text-secondary)" />
                  {[
                    ['C/T', `${fmt(b.ct, 0)} s`],
                    ['C/O', `${fmt(b.co, 0)} min`],
                    ['Dispo.', pct(b.uptime, 0)],
                    ['Opérateurs', String(b.operators)],
                    ['Type', b.valueAdded ? 'VA' : 'NVA'],
                  ].map(([k, val], j) => (
                    <g key={k}>
                      <text x={x + 8} y={procY + 50 + j * 14} fontSize={10} fill="var(--text-secondary)">
                        {k}
                      </text>
                      <text x={x + BW - 8} y={procY + 50 + j * 14} fontSize={10} textAnchor="end" fill="var(--text-primary)" fontWeight={500}>
                        {val}
                      </text>
                    </g>
                  ))}
                  {/* Opérateur */}
                  <circle cx={x + BW / 2} cy={procY - 16} r={5} fill="none" stroke="var(--text-secondary)" />
                  <path d={`M${x + BW / 2 - 7},${procY - 2} q7,-10 14,0`} fill="none" stroke="var(--text-secondary)" />
                  {/* Inventaire */}
                  {i < n - 1 && (
                    <g>
                      <line x1={x + BW} y1={procY + 17} x2={x + BW + GAP} y2={procY + 17} stroke="var(--text-secondary)" strokeWidth={4} strokeDasharray={sc.releasePolicy === 'push' ? '7 4' : '0'} markerEnd="url(#arr)" />
                      <polygon points={`${x + BW + GAP / 2},${procY + 132} ${x + BW + GAP / 2 + 16},${procY + 160} ${x + BW + GAP / 2 - 16},${procY + 160}`} fill="var(--warning)" fillOpacity={0.3} stroke="var(--text-primary)" />
                      <text x={x + BW + GAP / 2} y={procY + 155} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-primary)">
                        I
                      </text>
                      <text x={x + BW + GAP / 2} y={procY + 176} textAnchor="middle" fontSize={10} fill="var(--text-primary)">
                        {fmt(b.inventoryAfter, 0)} pcs
                      </text>
                      <text x={x + BW + GAP / 2} y={procY + 189} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">
                        {fmt(b.inventoryDays, 2)} j
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
            {/* Ligne de temps */}
            {(() => {
              const yTop = 395
              const yBot = 425
              const parts: React.ReactNode[] = []
              v.boxes.forEach((b, i) => {
                const x = X0 + i * (BW + GAP)
                parts.push(<line key={`p${i}`} x1={x} x2={x + BW} y1={yBot} y2={yBot} stroke="var(--good)" strokeWidth={2} />)
                parts.push(
                  <text key={`pt${i}`} x={x + BW / 2} y={yBot + 14} textAnchor="middle" fontSize={10} fill="var(--good-text)">
                    {fmt(b.ct, 0)} s
                  </text>,
                )
                if (i < n - 1) {
                  const xi = x + BW
                  parts.push(<polyline key={`w${i}`} points={`${xi},${yBot} ${xi},${yTop} ${xi + GAP},${yTop} ${xi + GAP},${yBot}`} fill="none" stroke="var(--critical)" strokeWidth={2} />)
                  parts.push(
                    <text key={`wt${i}`} x={xi + GAP / 2} y={yTop - 6} textAnchor="middle" fontSize={10} fill="var(--critical)">
                      {duration(b.inventoryDays * secPerDay)}
                    </text>,
                  )
                }
              })
              const xe = X0 + n * BW + (n - 1) * GAP + 6
              parts.push(
                <g key="sum">
                  <text x={xe} y={yTop + 4} fontSize={10} fill="var(--text-secondary)">
                    LT {fmt(v.leadDays, 2)} j
                  </text>
                  <text x={xe} y={yBot + 4} fontSize={10} fill="var(--text-secondary)">
                    VA {fmt(v.vaSeconds, 0)} s
                  </text>
                </g>,
              )
              return parts
            })()}
          </svg>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Opportunités d'amélioration identifiées">
          {opportunities.length ? (
            <ul className="space-y-1.5 text-sm">
              {opportunities.map((o) => (
                <li key={o} className="flex gap-2">
                  <span className="text-[var(--warning)]">⚡</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">Aucune opportunité majeure détectée.</p>
          )}
        </Card>
        <Card title="Décomposition du Lead Time">
          <Table
            dense
            head={['Composante', 'Durée', 'Part']}
            rows={[
              ['Attente en stocks', duration(v.waitSeconds), pct(v.waitSeconds / v.leadSeconds, 1)],
              ['Opérations à valeur ajoutée', duration(v.vaSeconds), pct(v.vaSeconds / v.leadSeconds, 2)],
              ['Opérations sans valeur ajoutée', duration(v.processSeconds - v.vaSeconds), pct((v.processSeconds - v.vaSeconds) / v.leadSeconds, 2)],
              ['Manutention', duration(v.transportSeconds), pct(v.transportSeconds / v.leadSeconds, 2)],
              [<b key="t">Lead Time</b>, <b key="tv">{duration(v.leadSeconds)}</b>, '100 %'],
            ]}
          />
          <div className="mt-3">
            <Note>Convention VSM : durée d'un stock = quantité / consommation journalière client. Elle peut différer du Lead Time de Little (calculé sur le débit réel) lorsque la ligne ne produit pas au rythme de la demande.</Note>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Factory({ x, y, label, sub }: { x: number; y: number; label: string; sub: string }) {
  return (
    <g>
      <path d={`M${x},${y + 52} L${x},${y + 14} L${x + 30},${y} L${x + 30},${y + 14} L${x + 60},${y} L${x + 60},${y + 14} L${x + 120},${y + 14} L${x + 120},${y + 52} Z`} fill="var(--surface-1)" stroke="var(--text-secondary)" />
      <text x={x + 60} y={y + 34} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-primary)">
        {label}
      </text>
      <text x={x + 60} y={y + 47} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">
        {sub}
      </text>
    </g>
  )
}

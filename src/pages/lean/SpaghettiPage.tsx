import { useRef, useState } from 'react'
import { Footprints, Plus, Ruler, Trash2 } from 'lucide-react'
import { useActiveScenario, useStore, uid } from '../../store/useStore'
import { allPoints, manhattan, spaghettiAnalysis } from '../../lean/tools'
import { Button, Card, Input, Kpi, Note, NumberInput, PageHeader, Select, Table, Badge } from '../../components/ui'
import { fmt } from '../../lib/format'
import type { Scenario } from '../../engine/types'

const SCALE = 16 // px par mètre

export default function SpaghettiPage() {
  const sc = useActiveScenario()
  const update = useStore((s) => s.updateScenario)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const set = (fn: (s: Scenario) => void, label?: string) => update(sc.id, fn, label)

  const pts = allPoints(sc).map((p) => (drag && drag.id === p.id ? { ...p, x: drag.x, y: drag.y } : p))
  const live: Scenario = drag
    ? {
        ...sc,
        stations: sc.stations.map((s) => (s.id === drag.id ? { ...s, x: drag.x, y: drag.y } : s)),
        layoutPoints: sc.layoutPoints.map((p) => (p.id === drag.id ? { ...p, x: drag.x, y: drag.y } : p)),
      }
    : sc
  const a = spaghettiAnalysis(live)
  const W = Math.max(50, ...pts.map((p) => p.x + 4))
  const H = Math.max(34, ...pts.map((p) => p.y + 4))
  const find = (id: string) => pts.find((p) => p.id === id)
  const maxTrips = Math.max(1, ...sc.operatorRoutes.map((r) => r.tripsPerShift))

  const toMeters = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * (W + 3) - 3
    const y = ((e.clientY - r.top) / r.height) * (H + 2) - 2
    return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) }
  }
  const commit = () => {
    if (!drag) return
    const d = drag
    set((s) => {
      const st = s.stations.find((x) => x.id === d.id)
      if (st) Object.assign(st, { x: d.x, y: d.y })
      const lp = s.layoutPoints.find((x) => x.id === d.id)
      if (lp) Object.assign(lp, { x: d.x, y: d.y })
    })
    setDrag(null)
  }

  const productDistNow = sc.stations.reduce((s, x) => s + x.distanceToNext, 0)
  const productDistLayout = a.productFlow.reduce((s, f) => s + f.distance, 0)

  return (
    <div>
      <PageHeader icon={<Footprints size={20} />} title="Diagramme spaghetti" subtitle="Visualisation des déplacements des opérateurs et des pièces · faites glisser les postes pour tester une nouvelle implantation" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Déplacements opérateurs / jour" value={fmt(a.totalOperator, 0)} unit="m" />
        <Kpi label="Dont inutiles" value={fmt(a.unnecessary, 0)} unit="m" tone={a.unnecessary > 1000 ? 'critical' : undefined} />
        <Kpi label="Temps de marche" value={fmt(a.walkingTimeMin, 0)} unit="min/j" hint="À 1,1 m/s" />
        <Kpi label="Temps de marche inutile" value={fmt(a.unnecessaryTimeMin, 0)} unit="min/j" />
        <Kpi label="Parcours pièce (implantation)" value={fmt(productDistLayout, 0)} unit="m" hint={`Paramètre flux : ${fmt(productDistNow, 0)} m`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Implantation de l'atelier" subtitle="Distances rectilinéaires (allées) · épaisseur = fréquence · rouge = déplacement non nécessaire" className="xl:col-span-8" bodyClass="p-2">
          <svg
            ref={svgRef}
            viewBox={`-3 -2 ${W + 3} ${H + 2}`}
            className="h-auto w-full touch-none select-none"
            style={{ aspectRatio: `${W + 3} / ${H + 2}`, maxHeight: (H + 2) * SCALE }}
            onPointerMove={(e) => drag && setDrag({ id: drag.id, ...toMeters(e) })}
            onPointerUp={commit}
            onPointerLeave={commit}
          >
            <defs>
              <pattern id="grid" width="2" height="2" patternUnits="userSpaceOnUse">
                <path d="M2 0 L0 0 0 2" fill="none" stroke="var(--grid)" strokeWidth="0.05" />
              </pattern>
              <marker id="parr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--series-1)" />
              </marker>
            </defs>
            <rect x={-3} y={-2} width={W + 3} height={H + 2} fill="url(#grid)" />
            {/* Flux produit */}
            {a.productFlow.map((f, i) => {
              const p = find(f.from)!
              const q = find(f.to)!
              return <path key={i} d={`M${p.x},${p.y} L${q.x},${p.y} L${q.x},${q.y}`} fill="none" stroke="var(--series-1)" strokeWidth={0.35} strokeDasharray="0.8 0.5" markerEnd="url(#parr)" opacity={0.8} />
            })}
            {/* Déplacements opérateurs */}
            {a.routes.map((r, i) => {
              const p = find(r.from)
              const q = find(r.to)
              if (!p || !q) return null
              const off = ((i % 3) - 1) * 0.35
              return (
                <path
                  key={r.id}
                  d={`M${p.x + off},${p.y + off} L${p.x + off},${q.y + off} L${q.x + off},${q.y + off}`}
                  fill="none"
                  stroke={r.necessary ? 'var(--series-3)' : 'var(--critical)'}
                  strokeWidth={0.15 + (r.tripsPerShift / maxTrips) * 0.6}
                  opacity={0.75}
                >
                  <title>
                    {r.operator} : {r.purpose} — {r.tripsPerShift} A/R, {fmt(r.daily, 0)} m/j
                  </title>
                </path>
              )
            })}
            {pts.map((p) => {
              const isStation = sc.stations.some((s) => s.id === p.id)
              return (
                <g key={p.id} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ id: p.id, x: p.x, y: p.y }) }} className="cursor-move">
                  <rect x={p.x - 2.6} y={p.y - 1.4} width={5.2} height={2.8} rx={0.4} fill={isStation ? 'var(--surface-1)' : 'var(--page)'} stroke={isStation ? 'var(--series-1)' : 'var(--muted)'} strokeWidth={drag?.id === p.id ? 0.25 : 0.12} strokeDasharray={isStation ? undefined : '0.4 0.3'} />
                  <text x={p.x} y={p.y - 0.15} textAnchor="middle" fontSize={0.85} fontWeight={600} fill="var(--text-primary)">
                    {p.id}
                  </text>
                  <text x={p.x} y={p.y + 0.85} textAnchor="middle" fontSize={0.6} fill="var(--text-secondary)">
                    {p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="flex flex-wrap gap-4 px-2 pb-1 text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[var(--series-1)]" /> Flux produit</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[var(--series-3)]" /> Déplacement nécessaire</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[var(--critical)]" /> Déplacement inutile</span>
            <span>Grille : 2 m</span>
          </div>
        </Card>
        <div className="space-y-4 xl:col-span-4">
          <Card title="Flux produit">
            <Table dense head={['Tronçon', 'Implantation', 'Paramètre']} rows={a.productFlow.map((f, i) => [`${f.from} → ${f.to}`, `${fmt(f.distance, 0)} m`, `${fmt(sc.stations[i].distanceToNext, 0)} m`])} />
            <Button
              className="mt-3 w-full"
              onClick={() =>
                set((s) => {
                  s.stations.forEach((st, i) => {
                    if (i < s.stations.length - 1) st.distanceToNext = manhattan(st, s.stations[i + 1])
                  })
                }, 'Avant recalcul des distances')
              }
            >
              <Ruler size={14} /> Appliquer les distances de l'implantation au flux
            </Button>
            <p className="mt-2 text-[11px] text-[var(--muted)]">Les distances alimentent le temps de manutention et le gaspillage « Transport » de la simulation.</p>
          </Card>
          <Note tone="tip">Rapprocher les postes consécutifs (implantation en U), installer outils et instruments de mesure au poste, et confier l'approvisionnement à un « water spider » réduit fortement les mouvements inutiles.</Note>
        </div>
        <Card title="Déplacements des opérateurs" className="xl:col-span-12" actions={<Button size="sm" onClick={() => set((s) => s.operatorRoutes.push({ id: uid('r'), operator: 'Opérateur', from: s.stations[0].id, to: s.stations[1].id, tripsPerShift: 5, purpose: 'À préciser', necessary: false }))}><Plus size={13} /> Déplacement</Button>}>
          <div className="space-y-2">
            {sc.operatorRoutes.map((r, i) => {
              const ar = a.routes[i]
              return (
                <div key={r.id} className="grid grid-cols-2 items-center gap-2 md:grid-cols-[1.2fr_1fr_1fr_1.6fr_90px_130px_90px_32px]">
                  <Input value={r.operator} onChange={(e) => set((s) => (s.operatorRoutes[i].operator = e.target.value))} aria-label="Opérateur" />
                  <Select value={r.from} onChange={(e) => set((s) => (s.operatorRoutes[i].from = e.target.value))} aria-label="De">
                    {pts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                  <Select value={r.to} onChange={(e) => set((s) => (s.operatorRoutes[i].to = e.target.value))} aria-label="Vers">
                    {pts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                  <Input value={r.purpose} onChange={(e) => set((s) => (s.operatorRoutes[i].purpose = e.target.value))} aria-label="Motif" />
                  <NumberInput value={r.tripsPerShift} min={0} step={1} suffix="A/R" onChange={(v) => set((s) => (s.operatorRoutes[i].tripsPerShift = Math.round(v)))} />
                  <Select value={r.necessary ? '1' : '0'} onChange={(e) => set((s) => (s.operatorRoutes[i].necessary = e.target.value === '1'))} aria-label="Nécessaire">
                    <option value="1">Nécessaire</option>
                    <option value="0">Non nécessaire</option>
                  </Select>
                  <span className="text-right text-sm tabular">{ar ? <Badge tone={r.necessary ? 'neutral' : 'critical'}>{fmt(ar.daily, 0)} m/j</Badge> : ''}</span>
                  <Button size="sm" variant="danger" onClick={() => set((s) => s.operatorRoutes.splice(i, 1))} aria-label="Supprimer">
                    <Trash2 size={13} />
                  </Button>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

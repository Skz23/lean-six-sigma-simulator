import { useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, Footprints, ImagePlus, MapPin, Pencil, Plus, Ruler, Trash2, Undo2, X } from 'lucide-react'
import { useActiveScenario, useStore, uid } from '../../store/useStore'
import { allPoints, manhattan, pathLength, spaghettiAnalysis } from '../../lean/tools'
import { Button, Card, Field, Input, Kpi, Note, NumberInput, PageHeader, Select, Table, Badge } from '../../components/ui'
import { fmt } from '../../lib/format'
import type { Scenario } from '../../engine/types'

const SCALE = 16 // px par mètre

export default function SpaghettiPage() {
  const sc = useActiveScenario()
  const update = useStore((s) => s.updateScenario)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [mode, setMode] = useState<'move' | 'draw' | 'point'>('move')
  const [draft, setDraft] = useState<{ x: number; y: number }[]>([])
  const [form, setForm] = useState({ operator: 'Opérateur', purpose: '', trips: 5, necessary: false })
  const [pointName, setPointName] = useState('Magasin')
  const plan = sc.floorPlan
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
  const W = plan ? plan.widthM : Math.max(50, ...pts.map((p) => p.x + 4))
  const H = plan ? plan.heightM : Math.max(34, ...pts.map((p) => p.y + 4))
  const X0 = -3
  const Y0 = -2
  const VW = plan ? W + 6 : W + 3
  const VH = plan ? H + 4 : H + 2
  const nearest = (q: { x: number; y: number }) => pts.reduce((b, p) => (Math.hypot(p.x - q.x, p.y - q.y) < Math.hypot(b.x - q.x, b.y - q.y) ? p : b), pts[0])
  const find = (id: string) => pts.find((p) => p.id === id)
  const maxTrips = Math.max(1, ...sc.operatorRoutes.map((r) => r.tripsPerShift))

  const toMeters = (e: React.PointerEvent | React.MouseEvent, precise = false) => {
    // Conversion écran → mètres par la matrice réelle du SVG (gère le cadrage centré de l'image)
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = svg.getScreenCTM()
    const { x, y } = m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }
    const rd = (v: number) => (precise ? Math.round(v * 10) / 10 : Math.round(v))
    return { x: Math.max(0, rd(x)), y: Math.max(0, rd(y)) }
  }
  const onCanvasClick = (e: React.MouseEvent) => {
    if (mode === 'draw') setDraft((d) => [...d, toMeters(e, true)])
    else if (mode === 'point') {
      const q = toMeters(e)
      const name = pointName.trim() || 'Point'
      set((s) => s.layoutPoints.push({ id: `P${s.layoutPoints.length + 1}`, name, x: q.x, y: q.y }), 'Avant ajout d\'un point')
      setMode('move')
    }
  }
  const saveDraft = () => {
    if (draft.length < 2) return
    const from = nearest(draft[0])
    const to = nearest(draft[draft.length - 1])
    set((s) =>
      s.operatorRoutes.push({ id: uid('r'), operator: form.operator, from: from.id, to: to.id, tripsPerShift: form.trips, purpose: form.purpose || 'À préciser', necessary: form.necessary, path: draft }),
    'Avant ajout d\'un trajet tracé')
    setDraft([])
    setMode('move')
  }
  const importPlan = (file: File) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const max = 1600
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const data = c.toDataURL('image/jpeg', 0.8)
      URL.revokeObjectURL(url)
      const widthM = plan?.widthM ?? Math.max(20, W)
      set((s) => (s.floorPlan = { image: data, widthM, heightM: Math.round((widthM * c.height) / c.width * 10) / 10, opacity: 0.6 }), 'Avant import du plan')
    }
    img.src = url
  }
  const fileRef = useRef<HTMLInputElement>(null)
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
        <Card
          title="Implantation de l'atelier"
          subtitle={mode === 'draw' ? 'Cliquez point par point le chemin réellement parcouru, puis « Enregistrer le trajet »' : mode === 'point' ? 'Cliquez à l\'endroit du point à ajouter' : 'Glissez les postes pour tester une implantation · épaisseur = fréquence · rouge = déplacement inutile'}
          className="xl:col-span-8"
          bodyClass="p-2"
          actions={
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant={mode === 'draw' ? 'primary' : 'secondary'} onClick={() => { setMode(mode === 'draw' ? 'move' : 'draw'); setDraft([]) }}><Pencil size={13} /> Tracer un trajet</Button>
              <Button size="sm" variant={mode === 'point' ? 'primary' : 'secondary'} onClick={() => setMode(mode === 'point' ? 'move' : 'point')}><MapPin size={13} /> Ajouter un point</Button>
              <Button size="sm" onClick={() => fileRef.current?.click()}><ImagePlus size={13} /> {plan ? 'Changer le plan' : 'Importer mon plan'}</Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importPlan(f); e.target.value = '' }} />
            </div>
          }
        >
          {mode === 'draw' && (
            <div className="mb-2 grid gap-2 rounded-lg bg-black/[.03] p-2.5 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_110px_140px_auto] dark:bg-white/[.05]">
              <Field label="Opérateur"><Input value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} /></Field>
              <Field label="Motif"><Input value={form.purpose} placeholder="Ex. chercher un outil" onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
              <Field label="Allers-retours / jour"><NumberInput value={form.trips} min={1} step={1} onChange={(v) => setForm({ ...form, trips: Math.round(v) })} /></Field>
              <Field label="Nécessaire ?">
                <Select value={form.necessary ? '1' : '0'} onChange={(e) => setForm({ ...form, necessary: e.target.value === '1' })}>
                  <option value="1">Nécessaire</option>
                  <option value="0">Non nécessaire</option>
                </Select>
              </Field>
              <div className="flex items-end gap-1.5">
                <Button size="sm" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length} title="Annuler le dernier point"><Undo2 size={13} /></Button>
                <Button size="sm" variant="primary" onClick={saveDraft} disabled={draft.length < 2}><Check size={13} /> Enregistrer ({fmt(pathLength(draft), 1)} m)</Button>
                <Button size="sm" variant="ghost" onClick={() => { setDraft([]); setMode('move') }} title="Annuler"><X size={13} /></Button>
              </div>
              <p className="text-[11px] text-[var(--muted)] sm:col-span-2 lg:col-span-5">Le départ et l'arrivée sont rattachés au poste ou au point le plus proche du premier et du dernier clic. La distance est celle du tracé.</p>
            </div>
          )}
          {mode === 'point' && (
            <div className="mb-2 flex flex-wrap items-end gap-2 rounded-lg bg-black/[.03] p-2.5 dark:bg-white/[.05]">
              <Field label="Nom du point"><Input value={pointName} onChange={(e) => setPointName(e.target.value)} className="w-56" /></Field>
              <span className="pb-2 text-xs text-[var(--muted)]">puis cliquez sur le plan</span>
            </div>
          )}
          {plan && (
            <div className="mb-2 flex flex-wrap items-end gap-3 px-1 text-sm">
              <Field label="Largeur réelle du plan" hint="Donne l'échelle : mesurez une longueur connue (mur, allée)">
                <NumberInput value={plan.widthM} min={1} step={1} suffix="m" className="w-36" onChange={(v) => set((s) => { if (s.floorPlan) { const r = s.floorPlan.heightM / s.floorPlan.widthM; s.floorPlan.widthM = v; s.floorPlan.heightM = Math.round(v * r * 10) / 10 } })} />
              </Field>
              <Field label="Opacité du plan">
                <input type="range" min={0.15} max={1} step={0.05} value={plan.opacity ?? 0.6} onChange={(e) => set((s) => { if (s.floorPlan) s.floorPlan.opacity = +e.target.value })} className="w-36 accent-[var(--color-brand-600)]" />
              </Field>
              <Button size="sm" variant="ghost" onClick={() => set((s) => { delete s.floorPlan }, 'Avant retrait du plan')}><Trash2 size={13} /> Retirer le plan</Button>
            </div>
          )}
          <svg
            ref={svgRef}
            viewBox={`${X0} ${Y0} ${VW} ${VH}`}
            className={clsx('h-auto w-full touch-none select-none', mode !== 'move' && 'cursor-crosshair')}
            style={{ aspectRatio: `${VW} / ${VH}`, maxHeight: Math.max(420, VH * SCALE) }}
            onPointerMove={(e) => drag && setDrag({ id: drag.id, ...toMeters(e) })}
            onPointerUp={commit}
            onPointerLeave={commit}
            onClick={onCanvasClick}
          >
            <defs>
              <pattern id="grid" width="2" height="2" patternUnits="userSpaceOnUse">
                <path d="M2 0 L0 0 0 2" fill="none" stroke="var(--grid)" strokeWidth="0.05" />
              </pattern>
              <marker id="rarr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
              </marker>
              <marker id="parr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--series-1)" />
              </marker>
            </defs>
            {plan ? (
              <image href={plan.image} x={0} y={0} width={W} height={H} preserveAspectRatio="none" opacity={plan.opacity ?? 0.6} />
            ) : (
              <rect x={-3} y={-2} width={W + 3} height={H + 2} fill="url(#grid)" />
            )}
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
              const d = r.path && r.path.length >= 2 ? `M${r.path.map((v) => `${v.x},${v.y}`).join(' L')}` : `M${p.x + off},${p.y + off} L${p.x + off},${q.y + off} L${q.x + off},${q.y + off}`
              return (
                <path
                  key={r.id}
                  d={d}
                  strokeLinejoin="round"
                  markerEnd={r.path ? 'url(#rarr)' : undefined}
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
            {draft.length > 0 && (
              <g pointerEvents="none">
                <polyline points={draft.map((v) => `${v.x},${v.y}`).join(' ')} fill="none" stroke="var(--series-2)" strokeWidth={0.35} strokeDasharray="0.6 0.3" />
                {draft.map((v, i) => <circle key={i} cx={v.x} cy={v.y} r={0.45} fill="var(--series-2)" />)}
              </g>
            )}
            {pts.map((p) => {
              const isStation = sc.stations.some((s) => s.id === p.id)
              return (
                <g key={p.id} onPointerDown={(e) => { if (mode !== 'move') return; (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ id: p.id, x: p.x, y: p.y }) }} className={mode === 'move' ? 'cursor-move' : undefined}>
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
            {plan ? <span>Plan : {fmt(plan.widthM, 1)} × {fmt(plan.heightM, 1)} m</span> : <span>Grille : 2 m</span>}
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[var(--series-2)]" /> Trajet en cours de tracé</span>
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
          <Note title="Votre plan d'atelier">
            Importez une photo ou un scan du plan, ou dessinez-le gratuitement sur <b>draw.io</b> (diagrams.net, sans compte) : murs, allées, machines, puis <i>Fichier › Exporter en › PNG</i>. Indiquez ensuite la largeur réelle pour l'échelle, placez vos postes dessus et tracez les trajets observés à la souris.
          </Note>
          <Note tone="tip">Rapprocher les postes consécutifs (implantation en U), installer outils et instruments de mesure au poste, et confier l'approvisionnement à un « water spider » réduit fortement les mouvements inutiles.</Note>
        </div>
        <Card title="Déplacements des opérateurs" className="xl:col-span-12" actions={<Button size="sm" onClick={() => set((s) => s.operatorRoutes.push({ id: uid('r'), operator: 'Opérateur', from: s.stations[0].id, to: s.stations[1].id, tripsPerShift: 5, purpose: 'À préciser', necessary: false }))}><Plus size={13} /> Déplacement</Button>}>
          <div className="space-y-2">
            {sc.operatorRoutes.map((r, i) => {
              const ar = a.routes[i]
              return (
                <div key={r.id} className="grid grid-cols-2 items-center gap-2 md:grid-cols-[1.2fr_1fr_1fr_1.6fr_90px_130px_110px_32px]">
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
                  <span className="flex flex-col items-end gap-0.5 text-right text-sm tabular">
                    {ar ? <Badge tone={r.necessary ? 'neutral' : 'critical'}>{fmt(ar.daily, 0)} m/j</Badge> : ''}
                    {r.path && (
                      <button className="text-[10px] text-[var(--muted)] underline" title="Revenir à la distance rectilinéaire" onClick={() => set((s) => { delete s.operatorRoutes[i].path })}>
                        tracé {fmt(pathLength(r.path), 0)} m ✕
                      </button>
                    )}
                  </span>
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

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Pause, Play, PlayCircle, RotateCcw, Square, Search } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { useActiveScenario } from '../../store/useStore'
import { LineSimulation, type Snapshot } from '../../engine/simulation'
import type { Product, SimResults } from '../../engine/types'
import { Badge, Button, Card, Kpi, Note, PageHeader, Select, Table, Input } from '../../components/ui'
import { ChartBox, STATE_META, axisProps, tooltipStyle, S } from '../../components/charts'
import { clock, fmt, fmtFixed, pct } from '../../lib/format'

const SPEEDS = [10, 30, 60, 180, 600]

export default function SimulationPage() {
  const sc = useActiveScenario()
  const simRef = useRef<LineSimulation | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [running, setRunning] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [speed, setSpeed] = useState(60)
  const [live, setLive] = useState<SimResults | null>(null)
  const [query, setQuery] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const last = useRef<number>(0)

  const reset = useCallback(() => {
    simRef.current = new LineSimulation(sc)
    setSnap(simRef.current.snapshot())
    setLive(simRef.current.results())
    setRunning(false)
    setStopped(false)
    setProduct(null)
  }, [sc])

  useEffect(() => {
    reset()
  }, [reset])

  useEffect(() => {
    if (!running) return
    let raf = 0
    let frames = 0
    last.current = performance.now()
    const loop = (now: number) => {
      const sim = simRef.current!
      const dtReal = Math.min(0.1, (now - last.current) / 1000)
      last.current = now
      sim.advanceTo(sim.t + dtReal * speed)
      setSnap(sim.snapshot())
      if (++frames % 10 === 0 || sim.finished) setLive(sim.results())
      if (sim.finished) {
        setRunning(false)
        setStopped(true)
        setLive(sim.results())
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, speed])

  const sim = simRef.current
  if (!sim || !snap || !live) return null
  const progress = snap.t / sim.openTime
  const wip = live.timeSeries.length ? live.timeSeries[live.timeSeries.length - 1].wip : 0
  const hoursElapsed = Math.max(1 / 60, (snap.t - (live.stations[0]?.time.break ?? 0)) / 3600)
  const finished = live.products.filter((p) => p.status !== 'wip' && !p.preloaded).slice(-8).reverse()
  const bnIdx = live.bottleneckIndex

  const search = () => {
    const q = query.trim().toUpperCase()
    const id = parseInt(q.replace(/\D/g, ''))
    const p = live.products.find((x) => x.code === q || x.id === id)
    setProduct(p ?? null)
  }

  return (
    <div>
      <PageHeader
        icon={<PlayCircle size={20} />}
        title="Simulation de production"
        subtitle={`${sc.name} · journée de ${sc.shift.duration} min · ${sc.releasePolicy === 'push' ? 'flux poussé' : 'flux tiré'} · lots de ${sc.batchSize}`}
        actions={
          <>
            <Select value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-28">
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  × {s}
                </option>
              ))}
            </Select>
            {!running ? (
              <Button variant="primary" onClick={() => setRunning(true)} disabled={stopped}>
                <Play size={15} /> {snap.t > 0 ? 'Reprendre' : 'Démarrer'}
              </Button>
            ) : (
              <Button onClick={() => setRunning(false)}>
                <Pause size={15} /> Pause
              </Button>
            )}
            <Button
              onClick={() => {
                setRunning(false)
                setStopped(true)
                setLive(sim.results())
              }}
              disabled={stopped}
            >
              <Square size={14} /> Arrêter
            </Button>
            <Button onClick={reset}>
              <RotateCcw size={15} /> Réinitialiser
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Heure simulée" value={clock(snap.t)} hint={snap.inBreak ? 'Pause en cours' : `${pct(progress, 0)} de la journée`} />
        <Kpi label="Pièces lancées" value={snap.released} />
        <Kpi label="Pièces bonnes" value={snap.good} hint={`Demande : ${sc.demand}`} />
        <Kpi label="Rebuts" value={snap.scrap} tone={snap.scrap > 0 ? 'critical' : undefined} />
        <Kpi label="Encours (WIP)" value={wip} unit="pcs" />
        <Kpi label="Expédiées / stock PF" value={`${snap.shipped} / ${snap.fg}`} />
        <Kpi label="Débit courant" value={fmt(snap.good / hoursElapsed, 1)} unit="pcs/h" hint={`Takt : ${fmt(3600 / sim.taktTime, 1)} pcs/h`} />
      </div>

      <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/10">
        <div className="h-full bg-brand-500 transition-[width]" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mb-4 flex justify-between text-[10px] text-[var(--muted)]">
        <span>00:00</span>
        {sc.shift.breaks.map((b) => (
          <span key={b.start}>
            {b.label} {clock(b.start * 60)}
          </span>
        ))}
        <span>{clock(sim.openTime)}</span>
      </div>

      <Card title="Ligne en temps réel" subtitle="Chaque point représente une pièce · couleur des machines = état courant" className="mb-4">
        <div className="overflow-x-auto pb-2">
          <div className="flex flex-wrap items-center gap-y-3">
            {sc.stations.map((st, i) => {
              const s = snap.stations[i]
              const transit = snap.transit.filter((x) => x.to === i + 1)
              return (
                <div key={st.id} className="flex items-center">
                  {/* File d'attente amont */}
                  {i > 0 && <Queue count={s.queue} />}
                  <div className={clsx('w-32 rounded-xl border-2 p-2 transition-colors', i === bnIdx && snap.t > 0 ? 'border-[var(--critical)]/60' : 'border-black/10 dark:border-white/15')}>
                    <div className="truncate text-xs font-semibold" title={st.name}>
                      {st.name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {s.states.map((state, k) => (
                        <div key={k} className="relative h-9 flex-1 overflow-hidden rounded-md" style={{ background: STATE_META[state].color, opacity: state === 'processing' ? 1 : 0.85 }} title={STATE_META[state].label}>
                          {state === 'processing' && <div className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${Math.min(100, s.progress[k] * 100)}%` }} />}
                          <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-white mix-blend-normal" style={{ color: state === 'blocked' ? '#0b0b0b' : '#fff' }}>
                            {s.productIds[k] ? `#${s.productIds[k]}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--text-secondary)]">{STATE_META[s.states[0]].label}</div>
                  </div>
                  {i < sc.stations.length - 1 ? (
                    <div className="relative mx-1 h-6 w-10">
                      <div className="absolute top-1/2 right-0 left-0 border-t-2 border-dashed border-black/15 dark:border-white/20" />
                      {transit.map((t) => (
                        <span key={t.id} className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full" style={{ left: `${Math.min(95, t.progress * 100)}%`, background: S(0) }} />
                      ))}
                    </div>
                  ) : (
                    <div className="ml-2 rounded-lg border border-dashed border-black/20 px-3 py-2 text-center dark:border-white/20">
                      <div className="text-[10px] text-[var(--muted)]">Produits finis</div>
                      <div className="text-lg font-semibold tabular">{snap.fg}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--text-secondary)]">
          {Object.entries(STATE_META).map(([k, m]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} /> {m.label}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Goulot d'étranglement (détection en cours de simulation)" subtitle="Taux d'activité = (production + pannes + changements) / temps planifié écoulé">
          <Table
            dense
            head={['Poste', 'Activité', 'Famine', 'Bloqué', 'Pannes', 'Produites', '']}
            rows={live.stations.map((s, i) => {
              const tot = Math.max(1, s.time.processing + s.time.starved + s.time.blocked + s.time.down + s.time.changeover)
              return [
                s.name,
                pct(s.activeRatio, 0),
                pct(s.time.starved / tot, 0),
                pct(s.time.blocked / tot, 0),
                s.failures,
                s.processed,
                i === bnIdx && snap.t > 0 ? <Badge tone="critical">goulot</Badge> : '',
              ]
            })}
          />
        </Card>
        <Card title="Encours dans le temps">
          <ChartBox height={210}>
            <AreaChart data={live.timeSeries.map((p) => ({ t: clock(p.t), wip: p.wip, fg: p.fg }))} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="t" {...axisProps} minTickGap={40} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Area dataKey="wip" name="WIP" stroke={S(0)} fill={S(0)} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
              <Area dataKey="fg" name="Stock produits finis" stroke={S(1)} fill={S(1)} fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ChartBox>
        </Card>

        <Card title="Dernières pièces sorties" subtitle="Lead Time = sortie − lancement ; dimension mesurée au poste CTQ">
          <Table
            dense
            head={['Pièce', 'Lot', 'Statut', 'Lead Time', sc.process.characteristic.name, 'Défaut']}
            rows={finished.map((p) => [
              <button key={p.id} className="text-brand-600 hover:underline" onClick={() => setProduct(p)}>
                {p.code}
              </button>,
              p.batch,
              p.status === 'good' ? <Badge tone="good">conforme</Badge> : <Badge tone="critical">non conforme</Badge>,
              p.exit !== undefined ? `${fmt((p.exit - p.release) / 60, 1)} min` : '—',
              p.dimension !== undefined ? fmtFixed(p.dimension, 4) : '—',
              p.defect?.type ?? '',
            ])}
          />
          {!finished.length && <p className="mt-2 text-sm text-[var(--muted)]">Démarrez la simulation pour voir les pièces.</p>}
        </Card>

        <Card
          title="Historique d'une pièce"
          actions={
            <div className="flex gap-1.5">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="P-00123" className="w-28" onKeyDown={(e) => e.key === 'Enter' && search()} />
              <Button size="sm" onClick={search}>
                <Search size={13} />
              </Button>
            </div>
          }
        >
          {product ? <ProductDetail p={product} names={Object.fromEntries(sc.stations.map((s) => [s.id, s.name]))} unit={sc.process.characteristic.unit} /> : <p className="text-sm text-[var(--muted)]">Sélectionnez une pièce (clic dans le tableau ou recherche par identifiant).</p>}
        </Card>
      </div>
      <div className="mt-4">
        <Note>
          La journée affichée est précédée d'une journée de mise en régime{sc.warmup ? '' : ' (désactivée pour ce scénario)'} : la ligne démarre avec les encours réels de la veille. Les pièces « préchargées » sont exclues du calcul du Lead Time observé.
        </Note>
      </div>
    </div>
  )
}

function Queue({ count }: { count: number }) {
  const shown = Math.min(count, 20)
  return (
    <div className="mr-1 flex w-14 flex-col items-center">
      <div className="grid grid-cols-5 gap-0.5">
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} className="h-2 w-2 rounded-full" style={{ background: 'var(--series-4)' }} />
        ))}
      </div>
      <span className="mt-0.5 text-[10px] text-[var(--text-secondary)] tabular">{count} en file</span>
    </div>
  )
}

function ProductDetail({ p, names, unit }: { p: Product; names: Record<string, string>; unit: string }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{p.code}</span>
        <Badge tone={p.status === 'good' ? 'good' : p.status === 'scrap' ? 'critical' : 'info'}>{p.status === 'good' ? 'conforme' : p.status === 'scrap' ? 'non conforme' : 'en cours'}</Badge>
        <span className="text-xs text-[var(--muted)]">Lot {p.batch} · lancée à {clock(Math.max(0, p.release))}{p.preloaded ? ' (encours de la veille)' : ''}</span>
      </div>
      {p.dimension !== undefined && (
        <div className="text-xs text-[var(--text-secondary)]">
          Dimension : <b>{fmtFixed(p.dimension, 4)} {unit}</b> · paramètres réels : T = {fmt(p.params!.temperature, 1)} °C, P = {fmt(p.params!.pressure, 1)} bar, V = {fmt(p.params!.speed, 0)} tr/min
        </div>
      )}
      {p.defect && <div className="text-xs text-[var(--critical)]">Défaut : {p.defect.type} ({names[p.defect.stationId]})</div>}
      <Table
        dense
        head={['Poste', 'Arrivée', 'Début', 'Fin', 'Attente', 'Opération']}
        rows={p.history.map((h) => [
          names[h.stationId] ?? h.stationId,
          Number.isFinite(h.arrive) ? clock(Math.max(0, h.arrive)) : '—',
          Number.isFinite(h.start) ? clock(Math.max(0, h.start)) : '—',
          Number.isFinite(h.end) ? clock(Math.max(0, h.end)) : '—',
          Number.isFinite(h.start) && Number.isFinite(h.arrive) ? `${fmt((h.start - h.arrive) / 60, 1)} min` : '—',
          Number.isFinite(h.end) && Number.isFinite(h.start) ? `${fmt(h.end - h.start, 1)} s` : '—',
        ])}
      />
    </div>
  )
}

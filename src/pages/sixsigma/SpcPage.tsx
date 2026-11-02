import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Activity } from 'lucide-react'
import { useActiveScenario } from '../../store/useStore'
import { useSimulation } from '../../store/useSimulation'
import { RULES, cChart, imrChart, npChart, pChart, uChart, xbarRChart, type ChartType, type ControlChartResult } from '../../stats/spc'
import { subgroups } from '../../stats/descriptive'
import { Badge, Card, Empty, Field, Note, PageHeader, Select, Table, TextArea, Toggle } from '../../components/ui'
import { ControlChartView } from '../../components/charts'
import { fmt, fmtFixed, parseNumbers } from '../../lib/format'
import type { Product } from '../../engine/types'

const TYPES: { id: ChartType; label: string; kind: 'var' | 'attr'; desc: string }[] = [
  { id: 'xbar-r', label: 'X̄ / R', kind: 'var', desc: 'Variables, sous-groupes de 2 à 10' },
  { id: 'i-mr', label: 'I / MR', kind: 'var', desc: 'Variables, mesures individuelles' },
  { id: 'p', label: 'p', kind: 'attr', desc: 'Proportion de non-conformes, n variable' },
  { id: 'np', label: 'np', kind: 'attr', desc: 'Nombre de non-conformes, n constant' },
  { id: 'c', label: 'c', kind: 'attr', desc: 'Nombre de défauts, unité constante' },
  { id: 'u', label: 'u', kind: 'attr', desc: 'Défauts par unité, n variable' },
]

/** Agrège les pièces sorties du poste CTQ par heure (contrôle à 100 %). */
function hourly(products: Product[], stationId: string) {
  const bins = new Map<number, { n: number; d: number }>()
  for (const p of products) {
    const h = p.history.find((x) => x.stationId === stationId)
    if (!h || !Number.isFinite(h.end) || h.end < 0) continue
    const k = Math.floor(h.end / 3600)
    const b = bins.get(k) ?? { n: 0, d: 0 }
    b.n++
    if (p.defect) b.d++
    bins.set(k, b)
  }
  return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
}

export default function SpcPage() {
  const sc = useActiveScenario()
  const { results } = useSimulation(sc)
  const [type, setType] = useState<ChartType>('xbar-r')
  const [n, setN] = useState(5)
  const [npSize, setNpSize] = useState(25)
  const [rules, setRules] = useState<number[]>([1, 2, 3, 5])
  const [manual, setManual] = useState(false)
  const [text, setText] = useState('')
  const [showSpec, setShowSpec] = useState(false)
  const c = sc.process.characteristic
  const meta = TYPES.find((t) => t.id === type)!

  const dims = useMemo(() => {
    return results.products
      .filter((p) => p.dimension !== undefined)
      .map((p) => ({ t: p.history.find((h) => h.stationId === sc.process.stationId)!.start, v: p.dimension!, defect: !!p.defect }))
      .sort((a, b) => a.t - b.t)
  }, [results, sc.process.stationId])

  let chart: ControlChartResult | null = null
  let error = ''
  let xLabel = 'Sous-groupe'
  try {
    if (meta.kind === 'var') {
      const xs = manual ? parseNumbers(text) : dims.map((d) => d.v)
      if (type === 'xbar-r') {
        const g = subgroups(xs, n)
        if (g.length >= 5) chart = xbarRChart(g, rules)
        else error = 'Au moins 5 sous-groupes complets sont nécessaires.'
      } else {
        xLabel = 'Pièce'
        if (xs.length >= 10) chart = imrChart(xs, rules)
        else error = 'Au moins 10 valeurs sont nécessaires.'
      }
    } else {
      // Attributs : simulation (toutes les pièces passées au poste CTQ, défauts de ce poste et amont) ou saisie « compte;taille »
      let counts: number[] = []
      let sizes: number[] = []
      if (manual) {
        const rows = text.split(/\n+/).map((l) => l.split(/[;\t ]+/).map((x) => parseFloat(x.replace(',', '.')))).filter((r) => Number.isFinite(r[0]))
        counts = rows.map((r) => r[0])
        sizes = rows.map((r) => (Number.isFinite(r[1]) ? r[1] : npSize))
      } else if (type === 'np') {
        const flags = dims.map((d) => d.defect)
        for (let i = 0; i + npSize <= flags.length; i += npSize) {
          counts.push(flags.slice(i, i + npSize).filter(Boolean).length)
          sizes.push(npSize)
        }
        xLabel = `Échantillon de ${npSize}`
      } else {
        const h = hourly(results.products, sc.process.stationId)
        counts = h.map((x) => x.d)
        sizes = h.map((x) => x.n)
        xLabel = 'Heure'
      }
      if (counts.length < 5) error = 'Au moins 5 échantillons sont nécessaires.'
      else if (type === 'p') chart = pChart(counts, sizes, rules)
      else if (type === 'np') chart = npChart(counts, sizes[0], rules)
      else if (type === 'c') chart = cChart(counts, rules)
      else chart = uChart(counts, sizes, rules)
    }
  } catch (e) {
    error = (e as Error).message
  }

  const digits = meta.kind === 'var' ? 4 : 3
  const signals = chart ? [...chart.primary.signals, ...(chart.secondary?.signals.map((s) => ({ ...s, label: `${chart!.secondary!.name} : ${s.label}` })) ?? [])] : []

  return (
    <div>
      <PageHeader icon={<Activity size={20} />} title="Statistical Process Control (SPC)" subtitle="Cartes de contrôle de Shewhart, limites à ±3σ et règles de détection des dérives" />
      <div className="mb-4 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => { setType(t.id); setText('') }} className={clsx('rounded-lg border px-3 py-2 text-left transition-colors', type === t.id ? 'border-brand-500 bg-brand-500/10' : 'border-black/10 bg-[var(--surface-1)] hover:border-black/25 dark:border-white/15')}>
            <div className="text-sm font-semibold">Carte {t.label}</div>
            <div className="text-[11px] text-[var(--muted)]">{t.desc}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-3">
          <Card title="Données">
            <div className="space-y-3">
              <Field label="Source">
                <Select value={manual ? 'm' : 's'} onChange={(e) => setManual(e.target.value === 'm')}>
                  <option value="s">Simulation ({sc.name})</option>
                  <option value="m">Saisie manuelle</option>
                </Select>
              </Field>
              {manual ? (
                <Field label={meta.kind === 'var' ? 'Valeurs (ordre chronologique)' : 'Une ligne par échantillon : défauts ; taille'}>
                  <TextArea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={meta.kind === 'var' ? '25.01 25.02 24.99 …' : '3;100\n5;120\n2;95'} />
                </Field>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  {meta.kind === 'var'
                    ? `${dims.length} mesures de « ${c.name} » dans l'ordre de fabrication.`
                    : type === 'np'
                      ? 'Pièces non conformes par échantillons consécutifs de taille constante au poste CTQ.'
                      : 'Agrégation horaire au poste CTQ (pièces non conformes = défauts dimensionnels et défauts du poste).'}
                </p>
              )}
              {type === 'xbar-r' && (
                <Field label="Taille des sous-groupes">
                  <Select value={n} onChange={(e) => setN(+e.target.value)}>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => <option key={k}>{k}</option>)}
                  </Select>
                </Field>
              )}
              {type === 'np' && !manual && (
                <Field label="Taille d'échantillon (n)">
                  <Select value={npSize} onChange={(e) => setNpSize(+e.target.value)}>
                    {[10, 20, 25, 40, 50].map((k) => <option key={k}>{k}</option>)}
                  </Select>
                </Field>
              )}
              {meta.kind === 'var' && <Toggle checked={showSpec} onChange={setShowSpec} label={<span className="text-xs">Afficher aussi les limites de spécification</span>} />}
            </div>
          </Card>
          <Card title="Règles de détection">
            <div className="space-y-1.5">
              {RULES.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-start gap-2 text-xs">
                  <input type="checkbox" className="mt-0.5 accent-[var(--color-brand-600)]" checked={rules.includes(r.id)} onChange={(e) => setRules(e.target.checked ? [...rules, r.id].sort() : rules.filter((x) => x !== r.id))} />
                  <span>
                    <b>{r.label}</b> — {r.description}
                  </span>
                </label>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-4 xl:col-span-9">
          {!chart ? (
            <Card>
              <Empty>{error || 'Aucune donnée.'}</Empty>
            </Card>
          ) : (
            <>
              <Card
                title={`Carte ${chart.primary.name}`}
                subtitle={`CL = ${fmtFixed(chart.primary.center, digits)} · UCL/LCL = limites de contrôle calculées sur les données${chart.sigmaWithin ? ` · σ intra = ${fmtFixed(chart.sigmaWithin, 5)}` : ''}`}
                actions={<Badge tone={chart.primary.signals.length ? 'critical' : 'good'}>{chart.primary.signals.length ? `${chart.primary.signals.length} signal(s)` : 'sous contrôle'}</Badge>}
              >
                <ControlChartView series={chart.primary} spec={showSpec && meta.kind === 'var' ? { lsl: c.lsl, usl: c.usl } : undefined} digits={digits} xLabel={xLabel} height={280} />
              </Card>
              {chart.secondary && (
                <Card title={`Carte ${chart.secondary.name}`} subtitle="Surveille la dispersion à court terme">
                  <ControlChartView series={chart.secondary} digits={digits} xLabel={xLabel} height={200} />
                </Card>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Signaux détectés">
                  {signals.length ? (
                    <Table dense head={['Point', 'Règle', 'Description']} rows={signals.slice(0, 40).map((s) => [`${xLabel} ${s.index + 1}`, `R${s.rule}`, <span key="d" className="text-xs">{s.label}</span>])} />
                  ) : (
                    <p className="text-sm text-[var(--good-text)]">Aucun signal : le procédé est sous contrôle statistique pour les règles sélectionnées.</p>
                  )}
                  {signals.length > 40 && <p className="mt-2 text-xs text-[var(--muted)]">… {signals.length - 40} autres signaux.</p>}
                </Card>
                <Card title="Lecture">
                  <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <p>
                      {signals.length
                        ? `Le procédé présente ${signals.length} signal(s) de causes spéciales. Avant de calculer une capabilité, il faut identifier et éliminer ces causes (changements de lot, usure outil, dérive thermique…).`
                        : 'Seules des causes communes de variation sont présentes : le procédé est prévisible. Sa capabilité peut être évaluée.'}
                    </p>
                    <Note tone="warning" title="Limites de contrôle ≠ limites de spécification">
                      Les limites de contrôle (UCL/LCL, rouge pointillé) sont calculées à partir des données : elles décrivent ce que le procédé fait. Les limites de spécification ({fmt(c.lsl, 3)} – {fmt(c.usl, 3)} {c.unit}) expriment ce que le client exige. Un procédé peut être sous contrôle et non capable, ou l'inverse.
                    </Note>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

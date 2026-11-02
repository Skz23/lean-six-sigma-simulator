import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
  ReferenceArea,
} from 'recharts'
import type { ReactNode } from 'react'
import { histogram } from '../stats/descriptive'
import { normalPdf } from '../stats/distributions'
import type { ChartSeries } from '../stats/spc'
import { fmt } from '../lib/format'
import type { StationState } from '../engine/types'

export const S = (i: number) => `var(--series-${(i % 8) + 1})`

export const tooltipStyle = {
  contentStyle: {
    background: 'var(--surface-1)',
    border: '1px solid var(--grid)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--text-primary)',
    boxShadow: '0 4px 16px rgba(0,0,0,.08)',
  },
  labelStyle: { color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: 'var(--text-primary)', padding: 0 },
  cursor: { fill: 'rgba(127,127,127,.08)', stroke: 'var(--axis)' },
}

export const axisProps = { stroke: 'var(--axis)', tickLine: false, tick: { fill: 'var(--muted)', fontSize: 11 } }

export function ChartBox({ height = 260, children }: { height?: number; children: ReactNode }) {
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}

export const STATE_META: Record<StationState, { label: string; color: string }> = {
  processing: { label: 'Production', color: 'var(--good)' },
  starved: { label: 'Famine (attente amont)', color: 'var(--series-1)' },
  blocked: { label: 'Bloqué (aval saturé)', color: 'var(--warning)' },
  down: { label: 'Panne', color: 'var(--critical)' },
  changeover: { label: 'Changement de série', color: 'var(--series-7)' },
  break: { label: 'Pause', color: 'var(--axis)' },
}

/** Histogramme avec limites de spécification et, si justifié, densité normale ajustée. */
export function CapabilityHistogram({ values, lsl, usl, target, mean, sigma, showNormal, sigmaWithin, height = 300, unit }: { values: number[]; lsl?: number; usl?: number; target?: number; mean: number; sigma: number; sigmaWithin?: number; showNormal: boolean; height?: number; unit?: string }) {
  if (!values.length) return null
  const lo = Math.min(...values, lsl ?? Infinity, mean - 3.5 * sigma)
  const hi = Math.max(...values, usl ?? -Infinity, mean + 3.5 * sigma)
  const bins = histogram(values, Math.min(30, Math.max(8, Math.round(Math.sqrt(values.length)))), [Math.min(...values), Math.max(...values)])
  const w = bins[0].x1 - bins[0].x0
  const n = values.length
  const steps = 80
  const data: { x: number; count?: number; normal?: number; within?: number }[] = bins.map((b) => ({ x: b.mid, count: b.count }))
  if (showNormal) {
    for (let i = 0; i <= steps; i++) {
      const x = lo + ((hi - lo) * i) / steps
      data.push({ x, normal: normalPdf(x, mean, sigma) * n * w, within: sigmaWithin ? normalPdf(x, mean, sigmaWithin) * n * w : undefined })
    }
  }
  data.sort((a, b) => a.x - b.x)
  const digits = Math.max(0, Math.min(4, Math.ceil(-Math.log10(sigma || 1)) + 1))
  return (
    <ChartBox height={height}>
      <ComposedChart data={data} margin={{ top: 22, right: 16, bottom: 4, left: -8 }} barCategoryGap={1}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="x" type="number" domain={[lo, hi]} tickFormatter={(v) => fmt(v, digits)} {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip {...tooltipStyle} labelFormatter={(v) => `${fmt(Number(v), digits + 1)} ${unit ?? ''}`} formatter={(v, name) => [fmt(Number(v), 1), name]} />
        {bins.map((b, i) => (
          <ReferenceArea key={i} x1={b.x0} x2={b.x1} y1={0} y2={b.count} fill="var(--series-1)" fillOpacity={0.55} stroke="var(--surface-1)" strokeWidth={1} ifOverflow="extendDomain" />
        ))}
        <Line dataKey="count" name="Effectif (classes)" stroke="var(--series-1)" strokeWidth={0} dot={false} activeDot={false} legendType="square" isAnimationActive={false} />
        {showNormal && <Line dataKey="normal" name="Loi normale (σ global)" stroke="var(--series-2)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
        {showNormal && sigmaWithin && <Line dataKey="within" name="Loi normale (σ intra)" stroke="var(--series-7)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />}
        {lsl !== undefined && <ReferenceLine x={lsl} stroke="var(--critical)" strokeWidth={2} label={{ value: 'LSL', position: 'top', fill: 'var(--critical)', fontSize: 11 }} />}
        {usl !== undefined && <ReferenceLine x={usl} stroke="var(--critical)" strokeWidth={2} label={{ value: 'USL', position: 'top', fill: 'var(--critical)', fontSize: 11 }} />}
        {target !== undefined && <ReferenceLine x={target} stroke="var(--good)" strokeDasharray="5 4" label={{ value: 'Cible', position: 'insideTopLeft', fill: 'var(--good-text)', fontSize: 11 }} />}
        <ReferenceLine x={mean} stroke="var(--text-secondary)" strokeDasharray="2 3" label={{ value: 'x̄', position: 'insideTopRight', fill: 'var(--text-secondary)', fontSize: 12 }} />
        <Legend verticalAlign="bottom" height={24} iconSize={10} />
      </ComposedChart>
    </ChartBox>
  )
}

/** Carte de contrôle : limites de contrôle (calculées) ≠ limites de spécification (client). */
export function ControlChartView({ series, height = 240, spec, digits = 3, xLabel = 'Sous-groupe' }: { series: ChartSeries; height?: number; spec?: { lsl?: number; usl?: number }; digits?: number; xLabel?: string }) {
  const sigIdx = new Set(series.signals.map((s) => s.index))
  const data = series.values.map((v, i) => ({
    i: i + 1,
    v,
    ucl: series.ucl[i],
    lcl: series.lcl[i],
    out: sigIdx.has(i) ? v : undefined,
    rules: series.signals.filter((s) => s.index === i).map((s) => `R${s.rule}`).join(', '),
  }))
  const all = [...series.values, ...series.ucl, ...series.lcl, ...(spec?.lsl !== undefined ? [spec.lsl] : []), ...(spec?.usl !== undefined ? [spec.usl] : [])]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = (hi - lo) * 0.08 || 1
  const variableLimits = new Set(series.ucl.map((x) => x.toFixed(9))).size > 1
  return (
    <ChartBox height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 64, bottom: 4, left: -4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="i" {...axisProps} label={{ value: xLabel, position: 'insideBottomRight', offset: -2, fill: 'var(--muted)', fontSize: 10 }} />
        <YAxis domain={[lo - pad, hi + pad]} tickFormatter={(v) => fmt(v, digits)} {...axisProps} width={64} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(v) => `${xLabel} ${v}`}
          formatter={(v, name) => [fmt(Number(v), digits + 1), name]}
        />
        {variableLimits ? (
          <>
            <Line dataKey="ucl" name="UCL" stroke="var(--critical)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} type="stepAfter" isAnimationActive={false} />
            <Line dataKey="lcl" name="LCL" stroke="var(--critical)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} type="stepAfter" isAnimationActive={false} />
          </>
        ) : (
          <>
            <ReferenceLine y={series.ucl[0]} stroke="var(--critical)" strokeDasharray="5 3" label={{ value: `UCL ${fmt(series.ucl[0], digits)}`, position: 'right', fill: 'var(--critical)', fontSize: 10 }} />
            <ReferenceLine y={series.lcl[0]} stroke="var(--critical)" strokeDasharray="5 3" label={{ value: `LCL ${fmt(series.lcl[0], digits)}`, position: 'right', fill: 'var(--critical)', fontSize: 10 }} />
          </>
        )}
        <ReferenceLine y={series.center} stroke="var(--good)" label={{ value: `CL ${fmt(series.center, digits)}`, position: 'right', fill: 'var(--good-text)', fontSize: 10 }} />
        {spec?.usl !== undefined && <ReferenceLine y={spec.usl} stroke="var(--series-7)" strokeWidth={2} label={{ value: 'USL (spéc.)', position: 'right', fill: 'var(--series-7)', fontSize: 10 }} />}
        {spec?.lsl !== undefined && <ReferenceLine y={spec.lsl} stroke="var(--series-7)" strokeWidth={2} label={{ value: 'LSL (spéc.)', position: 'right', fill: 'var(--series-7)', fontSize: 10 }} />}
        <Line dataKey="v" name={series.name} stroke="var(--series-1)" strokeWidth={1.5} dot={{ r: 2.5, fill: 'var(--series-1)', strokeWidth: 0 }} isAnimationActive={false} />
        <Scatter dataKey="out" name="Signal" fill="var(--critical)" shape="circle" isAnimationActive={false} />
      </ComposedChart>
    </ChartBox>
  )
}

/** Pareto : barres en % du total et cumul en % sur un axe unique 0–100 %. */
export function ParetoChart({ items, height = 280 }: { items: { label: string; count: number }[]; height?: number }) {
  const total = items.reduce((s, x) => s + x.count, 0) || 1
  let cum = 0
  const data = [...items]
    .sort((a, b) => b.count - a.count)
    .map((x) => {
      cum += x.count
      return { label: x.label, count: x.count, share: (x.count / total) * 100, cum: (cum / total) * 100 }
    })
  return (
    <ChartBox height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 40, left: -10 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval={0} angle={-25} textAnchor="end" height={60} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v} %`} {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(v, name, p) => (name === 'Part' ? [`${fmt(Number(v), 1)} % (${(p.payload as { count: number }).count})`, name] : [`${fmt(Number(v), 1)} %`, name])} />
        <ReferenceLine y={80} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: '80 %', position: 'insideTopRight', fill: 'var(--muted)', fontSize: 10 }} />
        <Bar dataKey="share" name="Part" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={48}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.cum - d.share < 80 ? 'var(--series-1)' : 'var(--axis)'} />
          ))}
          <LabelList dataKey="count" position="top" fill="var(--text-secondary)" fontSize={10} />
        </Bar>
        <Line dataKey="cum" name="Cumul" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 3, fill: 'var(--series-2)', strokeWidth: 0 }} isAnimationActive={false} />
        <Legend verticalAlign="top" height={22} iconSize={10} />
      </ComposedChart>
    </ChartBox>
  )
}

/** Barres horizontales empilées des états de chaque poste (en % du temps planifié). */
export function StationStatesChart({ stations, height }: { stations: { name: string; time: Record<StationState, number> }[]; height?: number }) {
  const keys: StationState[] = ['processing', 'changeover', 'down', 'blocked', 'starved']
  const data = stations.map((s) => {
    const total = keys.reduce((a, k) => a + s.time[k], 0) || 1
    const row: Record<string, number | string> = { name: s.name }
    for (const k of keys) row[k] = (s.time[k] / total) * 100
    return row
  })
  return (
    <ChartBox height={height ?? 50 + stations.length * 38}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 4 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v} %`} {...axisProps} />
        <YAxis type="category" dataKey="name" width={120} {...axisProps} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
        <Tooltip {...tooltipStyle} formatter={(v, name) => [`${fmt(Number(v), 1)} %`, name]} />
        <Legend verticalAlign="bottom" height={26} iconSize={10} />
        {keys.map((k) => (
          <Bar key={k} dataKey={k} stackId="a" name={STATE_META[k].label} fill={STATE_META[k].color} stroke="var(--surface-1)" strokeWidth={1} isAnimationActive={false} />
        ))}
      </BarChart>
    </ChartBox>
  )
}

/** Décomposition TRS : disponibilité × performance × qualité. */
export function OeeBars({ a, p, q, oee }: { a: number; p: number; q: number; oee: number }) {
  const rows = [
    { label: 'Disponibilité', v: a },
    { label: 'Performance', v: p },
    { label: 'Qualité', v: q },
  ]
  const tone = oee >= 0.85 ? 'var(--good)' : oee >= 0.65 ? 'var(--warning)' : 'var(--critical)'
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--grid)" strokeWidth="10" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${oee * 263.9} 263.9`} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-2xl font-semibold">{fmt(oee * 100, 1)}%</div>
            <div className="text-[10px] text-[var(--muted)]">TRS ligne</div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-[var(--text-secondary)]">{r.label}</span>
              <span className="tabular font-medium">{fmt(r.v * 100, 1)} %</span>
            </div>
            <div className="h-2 rounded-full bg-black/[.06] dark:bg-white/10">
              <div className="h-2 rounded-full bg-[var(--series-1)]" style={{ width: `${Math.min(100, r.v * 100)}%` }} />
            </div>
          </div>
        ))}
        <p className="text-[11px] text-[var(--muted)]">Référence « world class » : TRS ≥ 85 % (90 % × 95 % × 99,9 %).</p>
      </div>
    </div>
  )
}

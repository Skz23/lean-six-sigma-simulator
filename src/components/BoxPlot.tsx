import { quantile } from '../stats/descriptive'
import { fmt } from '../lib/format'

/** Boîtes à moustaches (Tukey : moustaches à 1,5 × IQR, points atypiques au-delà). */
export function BoxPlot({ groups, digits = 3, height = 280, lsl, usl }: { groups: { name: string; values: number[] }[]; digits?: number; height?: number; lsl?: number; usl?: number }) {
  const stats = groups
    .filter((g) => g.values.length >= 2)
    .map((g) => {
      const q1 = quantile(g.values, 0.25)
      const q3 = quantile(g.values, 0.75)
      const med = quantile(g.values, 0.5)
      const iqr = q3 - q1
      const lo = Math.min(...g.values.filter((v) => v >= q1 - 1.5 * iqr))
      const hi = Math.max(...g.values.filter((v) => v <= q3 + 1.5 * iqr))
      const out = g.values.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr)
      const m = g.values.reduce((a, b) => a + b, 0) / g.values.length
      return { name: g.name, q1, q3, med, lo, hi, out, mean: m, n: g.values.length }
    })
  if (!stats.length) return null
  const all = [...stats.flatMap((s) => [s.lo, s.hi, ...s.out]), ...(lsl !== undefined ? [lsl] : []), ...(usl !== undefined ? [usl] : [])]
  let min = Math.min(...all)
  let max = Math.max(...all)
  const pad = (max - min) * 0.08 || 1
  min -= pad
  max += pad
  const W = Math.max(360, stats.length * 56 + 70)
  const H = height
  const L = 60
  const T = 12
  const B = 34
  const y = (v: number) => T + ((max - v) / (max - min)) * (H - T - B)
  const step = (W - L - 10) / stats.length
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4)
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" style={{ minWidth: Math.min(W, 640) }} role="img" aria-label="Boîtes à moustaches">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 10} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">{fmt(t, digits)}</text>
          </g>
        ))}
        {lsl !== undefined && <line x1={L} x2={W - 10} y1={y(lsl)} y2={y(lsl)} stroke="var(--critical)" strokeWidth={1.5} strokeDasharray="5 3" />}
        {usl !== undefined && <line x1={L} x2={W - 10} y1={y(usl)} y2={y(usl)} stroke="var(--critical)" strokeWidth={1.5} strokeDasharray="5 3" />}
        {stats.map((s, i) => {
          const cx = L + step * (i + 0.5)
          const bw = Math.min(34, step * 0.55)
          return (
            <g key={s.name}>
              <title>{`${s.name} — n=${s.n}, médiane ${fmt(s.med, digits + 1)}, Q1 ${fmt(s.q1, digits + 1)}, Q3 ${fmt(s.q3, digits + 1)}, moyenne ${fmt(s.mean, digits + 1)}`}</title>
              <line x1={cx} x2={cx} y1={y(s.hi)} y2={y(s.q3)} stroke="var(--text-secondary)" />
              <line x1={cx} x2={cx} y1={y(s.q1)} y2={y(s.lo)} stroke="var(--text-secondary)" />
              <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(s.hi)} y2={y(s.hi)} stroke="var(--text-secondary)" />
              <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(s.lo)} y2={y(s.lo)} stroke="var(--text-secondary)" />
              <rect x={cx - bw / 2} y={y(s.q3)} width={bw} height={Math.max(1, y(s.q1) - y(s.q3))} rx={3} fill="var(--series-1)" fillOpacity={0.25} stroke="var(--series-1)" />
              <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(s.med)} y2={y(s.med)} stroke="var(--series-1)" strokeWidth={2} />
              <circle cx={cx} cy={y(s.mean)} r={2.5} fill="var(--series-2)" />
              {s.out.map((v, k) => <circle key={k} cx={cx} cy={y(v)} r={3} fill="none" stroke="var(--critical)" />)}
              <text x={cx} y={H - B + 14} textAnchor="middle" fontSize={10} fill="var(--muted)">{s.name.length > 10 ? s.name.slice(0, 9) + '…' : s.name}</text>
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-3 px-1 text-[11px] text-[var(--text-secondary)]">
        <span>Boîte : Q1 – Q3 · trait : médiane · point orange : moyenne · moustaches : 1,5 × IQR · cercles rouges : valeurs atypiques{lsl !== undefined || usl !== undefined ? ' · pointillés rouges : tolérances' : ''}</span>
      </div>
    </div>
  )
}

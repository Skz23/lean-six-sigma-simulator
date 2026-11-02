const nf = (d: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: 0 })

export const fmt = (v: number | undefined | null, d = 1): string => (v === undefined || v === null || !Number.isFinite(v) ? '—' : nf(d).format(v))
export const fmtFixed = (v: number | undefined | null, d = 2): string =>
  v === undefined || v === null || !Number.isFinite(v) ? '—' : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)
export const pct = (v: number | undefined | null, d = 1): string => (v === undefined || v === null || !Number.isFinite(v) ? '—' : `${nf(d).format(v * 100)} %`)
export const eur = (v: number | undefined | null, d = 0): string =>
  v === undefined || v === null || !Number.isFinite(v) ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: d }).format(v)
export const minutes = (s: number | undefined | null): string => (s === undefined || s === null || !Number.isFinite(s) ? '—' : `${fmt(s / 60, 1)} min`)
export const seconds = (s: number | undefined | null): string => (s === undefined || s === null || !Number.isFinite(s) ? '—' : `${fmt(s, 1)} s`)
export function duration(s: number): string {
  if (!Number.isFinite(s)) return '—'
  if (s < 120) return `${fmt(s, 0)} s`
  if (s < 7200) return `${fmt(s / 60, 1)} min`
  return `${fmt(s / 3600, 1)} h`
}
export const clock = (s: number) => {
  const m = Math.floor(s / 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** Variation relative signée, en tenant compte du sens souhaité. */
export function delta(before: number, after: number, higherIsBetter: boolean) {
  const change = before !== 0 && Number.isFinite(before) && Number.isFinite(after) ? (after - before) / Math.abs(before) : NaN
  const good = Number.isFinite(change) ? (higherIsBetter ? change > 0.0005 : change < -0.0005) : false
  const bad = Number.isFinite(change) ? (higherIsBetter ? change < -0.0005 : change > 0.0005) : false
  return { change, good, bad }
}
export function parseNumbers(text: string): number[] {
  return text
    .split(/[\s;\t\n]+/)
    .map((t) => t.replace(',', '.'))
    .filter((t) => t.length)
    .map(Number)
    .filter((v) => Number.isFinite(v))
}

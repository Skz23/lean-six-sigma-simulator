/** Statistiques descriptives. Variances et écarts-types : estimateurs sans biais (n − 1). */

export function sum(xs: number[]): number {
  let s = 0
  for (const x of xs) s += x
  return s
}

export function mean(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : NaN
}

/** Variance d'échantillon (dénominateur n − 1). */
export function variance(xs: number[]): number {
  const n = xs.length
  if (n < 2) return NaN
  const m = mean(xs)
  let s = 0
  for (const x of xs) s += (x - m) * (x - m)
  return s / (n - 1)
}

export function stdDev(xs: number[]): number {
  return Math.sqrt(variance(xs))
}

export function sorted(xs: number[]): number[] {
  return [...xs].sort((a, b) => a - b)
}

/** Quantile (méthode linéaire, type 7 de Hyndman & Fan, identique à Excel/NumPy). */
export function quantile(xs: number[], p: number): number {
  if (!xs.length) return NaN
  const s = sorted(xs)
  const h = (s.length - 1) * p
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return s[lo] + (h - lo) * (s[hi] - s[lo])
}

export function median(xs: number[]): number {
  return quantile(xs, 0.5)
}

export function min(xs: number[]): number {
  return xs.reduce((a, b) => Math.min(a, b), Infinity)
}

export function max(xs: number[]): number {
  return xs.reduce((a, b) => Math.max(a, b), -Infinity)
}

/** Coefficient d'asymétrie corrigé (G1, comme Excel/Minitab). */
export function skewness(xs: number[]): number {
  const n = xs.length
  if (n < 3) return NaN
  const m = mean(xs)
  const s = stdDev(xs)
  let acc = 0
  for (const x of xs) acc += ((x - m) / s) ** 3
  return (n / ((n - 1) * (n - 2))) * acc
}

/** Kurtosis en excès corrigé (G2, comme Excel/Minitab). */
export function kurtosis(xs: number[]): number {
  const n = xs.length
  if (n < 4) return NaN
  const m = mean(xs)
  const s = stdDev(xs)
  let acc = 0
  for (const x of xs) acc += ((x - m) / s) ** 4
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * acc - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
}

export interface Summary {
  n: number
  mean: number
  stdDev: number
  variance: number
  min: number
  q1: number
  median: number
  q3: number
  max: number
  range: number
  skewness: number
  kurtosis: number
}

export function summarize(xs: number[]): Summary {
  return {
    n: xs.length,
    mean: mean(xs),
    stdDev: stdDev(xs),
    variance: variance(xs),
    min: min(xs),
    q1: quantile(xs, 0.25),
    median: median(xs),
    q3: quantile(xs, 0.75),
    max: max(xs),
    range: max(xs) - min(xs),
    skewness: skewness(xs),
    kurtosis: kurtosis(xs),
  }
}

export interface HistogramBin {
  x0: number
  x1: number
  mid: number
  count: number
}

/** Histogramme ; nombre de classes par défaut : règle de Sturges bornée à [5, 30]. */
export function histogram(xs: number[], bins?: number, range?: [number, number]): HistogramBin[] {
  if (!xs.length) return []
  const k = bins ?? Math.min(30, Math.max(5, Math.ceil(Math.log2(xs.length) + 1)))
  const lo = range ? range[0] : min(xs)
  let hi = range ? range[1] : max(xs)
  if (hi === lo) hi = lo + 1
  const w = (hi - lo) / k
  const out: HistogramBin[] = Array.from({ length: k }, (_, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, mid: lo + (i + 0.5) * w, count: 0 }))
  for (const x of xs) {
    let i = Math.floor((x - lo) / w)
    if (i === k) i = k - 1
    if (i >= 0 && i < k) out[i].count++
  }
  return out
}

/** Découpe une série en sous-groupes consécutifs de taille n (le reliquat est ignoré). */
export function subgroups(xs: number[], n: number): number[][] {
  const out: number[][] = []
  for (let i = 0; i + n <= xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

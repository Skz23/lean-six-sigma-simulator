/**
 * Maîtrise Statistique des Procédés (MSP / SPC).
 * Limites de contrôle à ±3σ (Shewhart). Constantes : ASTM E2587 / Montgomery.
 * IMPORTANT : les limites de contrôle décrivent la voix du processus (VOP)
 * et sont calculées à partir des données ; elles ne doivent jamais être
 * confondues avec les limites de spécification (voix du client, LSL/USL).
 */
import { logGamma } from './distributions'
import { mean } from './descriptive'

const D2: Record<number, number> = { 2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704, 8: 2.847, 9: 2.97, 10: 3.078 }
const D3: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0.076, 8: 0.136, 9: 0.184, 10: 0.223 }
const D4: Record<number, number> = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114, 6: 2.004, 7: 1.924, 8: 1.864, 9: 1.816, 10: 1.777 }
const A2: Record<number, number> = { 2: 1.88, 3: 1.023, 4: 0.729, 5: 0.577, 6: 0.483, 7: 0.419, 8: 0.373, 9: 0.337, 10: 0.308 }

export function d2(n: number): number {
  const v = D2[n]
  if (v === undefined) throw new Error(`d2 non tabulé pour n = ${n} (2 ≤ n ≤ 10)`)
  return v
}

export function c4(n: number): number {
  return Math.sqrt(2 / (n - 1)) * Math.exp(logGamma(n / 2) - logGamma((n - 1) / 2))
}

export const spcConstants = (n: number) => ({ A2: A2[n], D3: D3[n], D4: D4[n], d2: d2(n), c4: c4(n) })

export type ChartType = 'xbar-r' | 'i-mr' | 'p' | 'np' | 'c' | 'u'

export interface ChartSeries {
  name: string
  values: number[]
  center: number
  ucl: number[]
  lcl: number[]
  signals: Signal[]
}

export interface ControlChartResult {
  type: ChartType
  primary: ChartSeries
  secondary?: ChartSeries
  /** Estimation de l'écart-type court terme (variables uniquement). */
  sigmaWithin?: number
}

export interface Signal {
  index: number
  rule: number
  label: string
}

/** Règles de détection (Western Electric / Nelson). */
export const RULES: { id: number; label: string; description: string }[] = [
  { id: 1, label: 'Règle 1', description: '1 point au-delà de 3σ (hors limites de contrôle)' },
  { id: 2, label: 'Règle 2', description: '9 points consécutifs du même côté de la ligne centrale' },
  { id: 3, label: 'Règle 3', description: '6 points consécutifs strictement croissants ou décroissants' },
  { id: 4, label: 'Règle 4', description: '14 points consécutifs alternant haut/bas' },
  { id: 5, label: 'Règle 5', description: '2 points sur 3 au-delà de 2σ du même côté' },
  { id: 6, label: 'Règle 6', description: '4 points sur 5 au-delà de 1σ du même côté' },
  { id: 7, label: 'Règle 7', description: '15 points consécutifs à moins de 1σ de la ligne centrale (stratification)' },
  { id: 8, label: 'Règle 8', description: '8 points consécutifs à plus de 1σ de part et d\'autre (mélange)' },
]

/**
 * Applique les règles sélectionnées. Les zones σ sont dérivées des limites
 * propres à chaque point (gère les limites variables des cartes p et u).
 */
export function detectSignals(values: number[], center: number, ucl: number[], lcl: number[], rules: number[]): Signal[] {
  const out: Signal[] = []
  const add = (index: number, rule: number) => {
    if (!out.some((s) => s.index === index && s.rule === rule)) out.push({ index, rule, label: RULES[rule - 1].description })
  }
  // z-score relatif à la zone (σ du point = (UCL − CL)/3)
  const z = values.map((v, i) => {
    const s = (ucl[i] - center) / 3
    return s > 0 ? (v - center) / s : 0
  })
  const n = values.length
  for (let i = 0; i < n; i++) {
    if (rules.includes(1) && (values[i] > ucl[i] + 1e-12 || values[i] < lcl[i] - 1e-12)) add(i, 1)
    if (rules.includes(2) && i >= 8) {
      const w = z.slice(i - 8, i + 1)
      if (w.every((v) => v > 0) || w.every((v) => v < 0)) add(i, 2)
    }
    if (rules.includes(3) && i >= 5) {
      const w = values.slice(i - 5, i + 1)
      let inc = true
      let dec = true
      for (let k = 1; k < w.length; k++) {
        if (!(w[k] > w[k - 1])) inc = false
        if (!(w[k] < w[k - 1])) dec = false
      }
      if (inc || dec) add(i, 3)
    }
    if (rules.includes(4) && i >= 13) {
      const w = values.slice(i - 13, i + 1)
      let alt = true
      for (let k = 2; k < w.length; k++) {
        if (Math.sign(w[k] - w[k - 1]) === Math.sign(w[k - 1] - w[k - 2]) || w[k] === w[k - 1]) alt = false
      }
      if (alt) add(i, 4)
    }
    if (rules.includes(5) && i >= 2) {
      const w = z.slice(i - 2, i + 1)
      if (w.filter((v) => v > 2).length >= 2 || w.filter((v) => v < -2).length >= 2) add(i, 5)
    }
    if (rules.includes(6) && i >= 4) {
      const w = z.slice(i - 4, i + 1)
      if (w.filter((v) => v > 1).length >= 4 || w.filter((v) => v < -1).length >= 4) add(i, 6)
    }
    if (rules.includes(7) && i >= 14) {
      const w = z.slice(i - 14, i + 1)
      if (w.every((v) => Math.abs(v) < 1)) add(i, 7)
    }
    if (rules.includes(8) && i >= 7) {
      const w = z.slice(i - 7, i + 1)
      if (w.every((v) => Math.abs(v) > 1) && w.some((v) => v > 0) && w.some((v) => v < 0)) add(i, 8)
    }
  }
  return out.sort((a, b) => a.index - b.index || a.rule - b.rule)
}

const fill = (n: number, v: number) => Array.from({ length: n }, () => v)

/** Carte X̄ / R (sous-groupes de taille constante 2 ≤ n ≤ 10). */
export function xbarRChart(groups: number[][], rules: number[] = [1]): ControlChartResult {
  const n = groups[0]?.length ?? 0
  if (n < 2 || n > 10) throw new Error('Taille de sous-groupe entre 2 et 10 requise')
  const xbars = groups.map(mean)
  const ranges = groups.map((g) => Math.max(...g) - Math.min(...g))
  const xbb = mean(xbars)
  const rbar = mean(ranges)
  const k = spcConstants(n)
  const m = groups.length
  const xUcl = fill(m, xbb + k.A2 * rbar)
  const xLcl = fill(m, xbb - k.A2 * rbar)
  const rUcl = fill(m, k.D4 * rbar)
  const rLcl = fill(m, k.D3 * rbar)
  return {
    type: 'xbar-r',
    sigmaWithin: rbar / k.d2,
    primary: { name: 'X̄', values: xbars, center: xbb, ucl: xUcl, lcl: xLcl, signals: detectSignals(xbars, xbb, xUcl, xLcl, rules) },
    secondary: { name: 'R', values: ranges, center: rbar, ucl: rUcl, lcl: rLcl, signals: detectSignals(ranges, rbar, rUcl, rLcl, [1]) },
  }
}

/** Carte des valeurs individuelles / étendues mobiles (I-MR). */
export function imrChart(xs: number[], rules: number[] = [1]): ControlChartResult {
  const mr = xs.slice(1).map((x, i) => Math.abs(x - xs[i]))
  const xb = mean(xs)
  const mrbar = mean(mr)
  const sigma = mrbar / 1.128
  const m = xs.length
  const iUcl = fill(m, xb + 3 * sigma)
  const iLcl = fill(m, xb - 3 * sigma)
  const mrUcl = fill(mr.length, 3.267 * mrbar)
  const mrLcl = fill(mr.length, 0)
  return {
    type: 'i-mr',
    sigmaWithin: sigma,
    primary: { name: 'Individuelle', values: xs, center: xb, ucl: iUcl, lcl: iLcl, signals: detectSignals(xs, xb, iUcl, iLcl, rules) },
    secondary: { name: 'Étendue mobile', values: mr, center: mrbar, ucl: mrUcl, lcl: mrLcl, signals: detectSignals(mr, mrbar, mrUcl, mrLcl, [1]) },
  }
}

/** Carte p : proportion de non-conformes (tailles d'échantillon variables autorisées). */
export function pChart(defectives: number[], sizes: number[], rules: number[] = [1]): ControlChartResult {
  const pbar = defectives.reduce((a, b) => a + b, 0) / sizes.reduce((a, b) => a + b, 0)
  const values = defectives.map((d, i) => d / sizes[i])
  const ucl = sizes.map((n) => Math.min(1, pbar + 3 * Math.sqrt((pbar * (1 - pbar)) / n)))
  const lcl = sizes.map((n) => Math.max(0, pbar - 3 * Math.sqrt((pbar * (1 - pbar)) / n)))
  return { type: 'p', primary: { name: 'p', values, center: pbar, ucl, lcl, signals: detectSignals(values, pbar, ucl, lcl, rules) } }
}

/** Carte np : nombre de non-conformes (taille d'échantillon constante n). */
export function npChart(defectives: number[], n: number, rules: number[] = [1]): ControlChartResult {
  const pbar = defectives.reduce((a, b) => a + b, 0) / (defectives.length * n)
  const c = n * pbar
  const s = Math.sqrt(n * pbar * (1 - pbar))
  const ucl = fill(defectives.length, c + 3 * s)
  const lcl = fill(defectives.length, Math.max(0, c - 3 * s))
  return { type: 'np', primary: { name: 'np', values: defectives, center: c, ucl, lcl, signals: detectSignals(defectives, c, ucl, lcl, rules) } }
}

/** Carte c : nombre de défauts par unité d'inspection constante. */
export function cChart(counts: number[], rules: number[] = [1]): ControlChartResult {
  const cbar = mean(counts)
  const ucl = fill(counts.length, cbar + 3 * Math.sqrt(cbar))
  const lcl = fill(counts.length, Math.max(0, cbar - 3 * Math.sqrt(cbar)))
  return { type: 'c', primary: { name: 'c', values: counts, center: cbar, ucl, lcl, signals: detectSignals(counts, cbar, ucl, lcl, rules) } }
}

/** Carte u : défauts par unité (nombre d'unités variable). */
export function uChart(counts: number[], units: number[], rules: number[] = [1]): ControlChartResult {
  const ubar = counts.reduce((a, b) => a + b, 0) / units.reduce((a, b) => a + b, 0)
  const values = counts.map((c, i) => c / units[i])
  const ucl = units.map((n) => ubar + 3 * Math.sqrt(ubar / n))
  const lcl = units.map((n) => Math.max(0, ubar - 3 * Math.sqrt(ubar / n)))
  return { type: 'u', primary: { name: 'u', values, center: ubar, ucl, lcl, signals: detectSignals(values, ubar, ucl, lcl, rules) } }
}

/**
 * Compléments statistiques (cours MMI2) : données non normales (Box-Cox),
 * puissance et effectif d'un test, indice de Taguchi Cpm, classification de Kano.
 */
import { mean, variance } from './descriptive'
import { tCdf, tInv } from './distributions'

// ---------------- Box-Cox ----------------
export const boxCox = (x: number, lambda: number) => (Math.abs(lambda) < 1e-9 ? Math.log(x) : (Math.pow(x, lambda) - 1) / lambda)

/** Log-vraisemblance profilée de Box-Cox (à une constante près). */
export function boxCoxLogLik(xs: number[], lambda: number): number {
  const n = xs.length
  const y = xs.map((x) => boxCox(x, lambda))
  const m = mean(y)
  const s2 = y.reduce((a, v) => a + (v - m) ** 2, 0) / n
  const sumLog = xs.reduce((a, x) => a + Math.log(x), 0)
  return (-n / 2) * Math.log(s2) + (lambda - 1) * sumLog
}

export interface BoxCoxResult {
  lambda: number
  /** λ arrondi à 0,5 (valeur interprétable : 1 = aucune, 0,5 = racine, 0 = log, −1 = inverse). */
  rounded: number
  label: string
}

/** Recherche du λ maximisant la vraisemblance sur [−5 ; 5] (grille puis affinage). */
export function findBoxCoxLambda(xs: number[]): BoxCoxResult {
  if (xs.some((x) => !(x > 0))) throw new Error('La transformation de Box-Cox exige des valeurs strictement positives.')
  let best = -5
  let bestL = -Infinity
  for (let l = -5; l <= 5.0001; l += 0.05) {
    const v = boxCoxLogLik(xs, l)
    if (v > bestL) {
      bestL = v
      best = l
    }
  }
  // Affinage par section dorée autour du meilleur point de grille
  let a = best - 0.05
  let b = best + 0.05
  const g = (Math.sqrt(5) - 1) / 2
  for (let i = 0; i < 60; i++) {
    const c = b - g * (b - a)
    const d = a + g * (b - a)
    if (boxCoxLogLik(xs, c) > boxCoxLogLik(xs, d)) b = d
    else a = c
  }
  const lambda = (a + b) / 2
  const rounded = Math.round(lambda * 2) / 2
  const label =
    rounded === 1 ? 'aucune transformation' : rounded === 0.5 ? 'racine carrée' : rounded === 0 ? 'logarithme' : rounded === -0.5 ? 'inverse de la racine' : rounded === -1 ? 'inverse' : rounded === 2 ? 'carré' : `puissance ${rounded}`
  return { lambda, rounded, label }
}

/** Transforme une limite de spécification (et gère l'inversion d'ordre si λ < 0). */
export function transformSpec(lsl: number | undefined, usl: number | undefined, lambda: number) {
  const t = (v?: number) => (v === undefined || !(v > 0) ? undefined : boxCox(v, lambda))
  return lambda < 0 ? { lsl: t(usl), usl: t(lsl) } : { lsl: t(lsl), usl: t(usl) }
}

// ---------------- Puissance ----------------
/**
 * Puissance d'un test t bilatéral (approximation par loi de Student décentrée
 * remplacée par une Student translatée, précise à ±0,01 pour n ≥ 5).
 * twoSample : comparaison de deux moyennes avec n par groupe ; sinon test à un échantillon.
 */
export function tTestPower(n: number, delta: number, sigma: number, alpha = 0.05, twoSample = true): number {
  if (n < 2 || sigma <= 0) return NaN
  const df = twoSample ? 2 * n - 2 : n - 1
  const se = twoSample ? sigma * Math.sqrt(2 / n) : sigma / Math.sqrt(n)
  const ncp = Math.abs(delta) / se
  const tc = tInv(1 - alpha / 2, df)
  return 1 - tCdf(tc - ncp, df) + tCdf(-tc - ncp, df)
}

/** Effectif minimal (par groupe) pour atteindre la puissance visée. */
export function sampleSizeForPower(delta: number, sigma: number, power = 0.8, alpha = 0.05, twoSample = true): number {
  for (let n = 2; n <= 100000; n++) if (tTestPower(n, delta, sigma, alpha, twoSample) >= power) return n
  return Infinity
}

/** Plus petite différence détectable avec n par groupe. */
export function minDetectableDifference(n: number, sigma: number, power = 0.8, alpha = 0.05, twoSample = true): number {
  let lo = 0
  let hi = 20 * sigma
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (tTestPower(n, mid, sigma, alpha, twoSample) >= power) hi = mid
    else lo = mid
  }
  return hi
}

// ---------------- Taguchi ----------------
/** Cpm = (USL − LSL) / 6·√(σ² + (μ − cible)²) : pénalise l'écart à la cible. */
export function cpm(xs: number[], lsl: number, usl: number, target: number): number {
  const m = mean(xs)
  return (usl - lsl) / (6 * Math.sqrt(variance(xs) + (m - target) ** 2))
}

/** Perte de Taguchi moyenne par pièce : k·(σ² + (μ − cible)²), k = coût à la limite / (demi-tolérance)². */
export function taguchiLoss(xs: number[], target: number, halfTolerance: number, costAtLimit: number): number {
  const k = costAtLimit / halfTolerance ** 2
  return k * (variance(xs) + (mean(xs) - target) ** 2)
}

// ---------------- Kano ----------------
/** Réponses : 1 J'aime · 2 C'est normal · 3 Indifférent · 4 Je m'en accommode · 5 Je n'aime pas. */
export type KanoAnswer = 1 | 2 | 3 | 4 | 5
export type KanoCategory = 'A' | 'O' | 'M' | 'I' | 'R' | 'Q'

export const KANO_LABEL: Record<KanoCategory, string> = {
  A: 'Attractive',
  O: 'Proportionnelle',
  M: 'Obligatoire',
  I: 'Indifférente',
  R: 'Inverse (hostile)',
  Q: 'Réponse douteuse',
}

const KANO_TABLE: KanoCategory[][] = [
  // dysfonctionnel →  1    2    3    4    5     (fonctionnel ↓)
  ['Q', 'A', 'A', 'A', 'O'],
  ['R', 'I', 'I', 'I', 'M'],
  ['R', 'I', 'I', 'I', 'M'],
  ['R', 'I', 'I', 'I', 'M'],
  ['R', 'R', 'R', 'R', 'Q'],
]

/** Table d'évaluation de Kano (question fonctionnelle × question dysfonctionnelle). */
export function kanoClassify(functional: KanoAnswer, dysfunctional: KanoAnswer): KanoCategory {
  return KANO_TABLE[functional - 1][dysfunctional - 1]
}

/** Catégorie majoritaire et coefficients de satisfaction / insatisfaction (Berger et al.). */
export function kanoSummary(cats: KanoCategory[]) {
  const count = (c: KanoCategory) => cats.filter((x) => x === c).length
  const A = count('A')
  const O = count('O')
  const M = count('M')
  const I = count('I')
  const denom = A + O + M + I
  const order: KanoCategory[] = ['M', 'O', 'A', 'I', 'R', 'Q']
  const major = order.reduce((best, c) => (count(c) > count(best) ? c : best), order[0])
  return {
    counts: { A, O, M, I, R: count('R'), Q: count('Q') },
    major,
    satisfaction: denom ? (A + O) / denom : NaN,
    dissatisfaction: denom ? -(O + M) / denom : NaN,
  }
}

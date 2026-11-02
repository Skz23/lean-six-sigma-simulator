/**
 * Plans d'expériences factoriels complets 2^k (facteurs codés −1 / +1).
 * Effet d'un terme = moyenne(Y | +1) − moyenne(Y | −1) ; coefficient = effet / 2.
 * La significativité est obtenue par régression des termes (effets principaux
 * et interactions d'ordre 2) lorsque les degrés de liberté résiduels le permettent.
 */
import { mean } from './descriptive'
import { linearRegression, type RegressionResult } from './inference'

export interface DoeFactor {
  name: string
  low: number
  high: number
  unit?: string
}

export interface DoeRun {
  order: number
  coded: number[]
  actual: number[]
}

/** Génère le plan 2^k (ordre standard de Yates), répliqué `replicates` fois. */
export function fullFactorial(factors: DoeFactor[], replicates = 1): DoeRun[] {
  const k = factors.length
  const runs: DoeRun[] = []
  let order = 1
  for (let r = 0; r < replicates; r++) {
    for (let i = 0; i < 2 ** k; i++) {
      const coded = factors.map((_, j) => ((i >> j) & 1 ? 1 : -1))
      runs.push({ order: order++, coded, actual: coded.map((c, j) => (c < 0 ? factors[j].low : factors[j].high)) })
    }
  }
  return runs
}

export interface DoeEffect {
  term: string
  effect: number
  coef: number
  pValue?: number
  significant?: boolean
}

export interface DoeAnalysis {
  effects: DoeEffect[]
  model?: RegressionResult
  bestSetting: { coded: number[]; predicted: number }
}

function interactionColumns(coded: number[][], names: string[]) {
  const k = names.length
  const cols: { name: string; values: number[] }[] = names.map((n, j) => ({ name: n, values: coded.map((c) => c[j]) }))
  for (let a = 0; a < k; a++)
    for (let b = a + 1; b < k; b++) cols.push({ name: `${names[a]}×${names[b]}`, values: coded.map((c) => c[a] * c[b]) })
  if (k === 3) cols.push({ name: `${names[0]}×${names[1]}×${names[2]}`, values: coded.map((c) => c[0] * c[1] * c[2]) })
  return cols
}

/**
 * Analyse un plan factoriel. `goal` : 'target' (viser `target`), 'min' ou 'max'.
 */
export function analyzeFactorial(runs: DoeRun[], y: number[], names: string[], goal: 'min' | 'max' | 'target' = 'target', target = 0, alpha = 0.05): DoeAnalysis {
  const coded = runs.map((r) => r.coded)
  const cols = interactionColumns(coded, names)
  const effects: DoeEffect[] = cols.map((c) => {
    const hi = y.filter((_, i) => c.values[i] > 0)
    const lo = y.filter((_, i) => c.values[i] < 0)
    const e = mean(hi) - mean(lo)
    return { term: c.name, effect: e, coef: e / 2 }
  })
  let model: RegressionResult | undefined
  // Modèle : on garde autant de termes que les ddl résiduels le permettent (≥ 2)
  const usable = cols.filter((_, i) => i < Math.max(0, y.length - 3))
  if (usable.length >= names.length) {
    try {
      model = linearRegression(
        coded.map((_, i) => usable.map((c) => c.values[i])),
        y,
        usable.map((c) => c.name),
      )
      for (const t of model.terms.slice(1)) {
        const e = effects.find((x) => x.term === t.name)
        if (e) {
          e.pValue = t.pValue
          e.significant = t.pValue < alpha
        }
      }
    } catch {
      model = undefined
    }
  }
  // Recherche du meilleur réglage parmi les sommets du domaine, selon le modèle des effets
  const predict = (c: number[]) => {
    const cc = interactionColumns([c], names)
    return mean(y) + effects.reduce((s, e, i) => s + e.coef * cc[i].values[0], 0)
  }
  let best = { coded: coded[0], predicted: predict(coded[0]) }
  const k = names.length
  for (let i = 0; i < 2 ** k; i++) {
    const c = names.map((_, j) => ((i >> j) & 1 ? 1 : -1))
    const v = predict(c)
    const better = goal === 'min' ? v < best.predicted : goal === 'max' ? v > best.predicted : Math.abs(v - target) < Math.abs(best.predicted - target)
    if (better) best = { coded: c, predicted: v }
  }
  return { effects, model, bestSetting: best }
}

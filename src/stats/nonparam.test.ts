import { describe, expect, it } from 'vitest'
import { bartlett, kruskalWallis, levene, mannWhitney, spearman, wilcoxonSigned } from './nonparam'

// Valeurs de référence : SciPy 1.18 (bartlett, levene center='median', mannwhitneyu asymptotique
// avec correction de continuité, wilcoxon approx corrigé, kruskal, spearmanr)
const a = [25.01, 25.03, 24.99, 25.02, 25.04, 25.0, 25.03, 25.05, 25.02, 25.01, 25.03]
const b = [25.04, 25.06, 25.03, 25.05, 25.07, 25.04, 25.08, 25.05, 25.06, 25.03]
const c = [25.0, 25.02, 24.98, 25.01, 25.03, 24.99, 25.0, 25.02, 25.01]

describe('tests complémentaires (contre SciPy)', () => {
  it('Bartlett', () => {
    const r = bartlett([a, b, c])
    expect(r.statistic).toBeCloseTo(0.09575607678828743, 6)
    expect(r.pValue).toBeCloseTo(0.9532500398938186, 6)
  })
  it('Levene (médiane)', () => {
    const r = levene([a, b, c])
    expect(r.statistic).toBeCloseTo(0.051004279270585436, 6)
    expect(r.pValue).toBeCloseTo(0.9503659369538843, 6)
  })
  it('Mann-Whitney', () => {
    const r = mannWhitney(a, b)
    expect(r.statistic).toBeCloseTo(11, 9)
    expect(r.pValue).toBeCloseTo(0.0019715700803240063, 6)
  })
  it('Wilcoxon signé', () => {
    const r = wilcoxonSigned(a.slice(0, 10).map((x, i) => x - b[i]))
    expect(r.statistic).toBeCloseTo(0, 9)
    expect(r.pValue).toBeCloseTo(0.00896932740895932, 5)
  })
  it('Kruskal-Wallis', () => {
    const r = kruskalWallis([a, b, c])
    expect(r.statistic).toBeCloseTo(17.137700548184032, 6)
    expect(r.pValue).toBeCloseTo(0.00018993089279619452, 7)
  })
  it('Spearman', () => {
    const r = spearman(a.slice(0, 10), b)
    expect(r.statistic).toBeCloseTo(0.7709015273959047, 6)
    expect(r.pValue).toBeCloseTo(0.00904477674117016, 5)
  })
})

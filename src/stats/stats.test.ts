import { describe, expect, it } from 'vitest'
import { chi2Cdf, chi2Inv, fCdf, fInv, normalCdf, normalInv, tCdf, tInv } from './distributions'
import { kurtosis, mean, quantile, skewness, stdDev, variance } from './descriptive'
import { anovaOneWay, andersonDarling, pearson, simpleRegression, tTestOneSample, tTestTwoSample, twoProportionTest } from './inference'
import { capability, sigmaWithin } from './capability'
import { dpmoToSigma, sigmaMetrics, sigmaToDpmo } from './sigma'
import { cChart, detectSignals, imrChart, npChart, pChart, spcConstants, uChart, xbarRChart } from './spc'
import { analyzeFactorial, fullFactorial } from './doe'

// Valeurs de référence : SciPy 1.18
describe('distributions', () => {
  it('loi normale', () => {
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6)
    expect(normalCdf(-3.2)).toBeCloseTo(0.0006871379379158471, 10)
    expect(normalInv(0.975)).toBeCloseTo(1.959964, 6)
    expect(normalInv(1e-6)).toBeCloseTo(-4.753424308822899, 8)
  })
  it('loi de Student', () => {
    expect(tCdf(2.228, 10)).toBeCloseTo(0.9749941140914443, 8)
    expect(tInv(0.975, 10)).toBeCloseTo(2.228138851986274, 8)
    expect(tInv(0.95, 3.5)).toBeCloseTo(2.2224334936496004, 6)
  })
  it('loi de Fisher', () => {
    expect(fCdf(4.964603, 1, 10)).toBeCloseTo(0.95, 7)
    expect(fCdf(2.5, 3, 7)).toBeCloseTo(0.8564905437210608, 8)
    expect(fInv(0.95, 2, 12)).toBeCloseTo(3.8852938346523924, 6)
  })
  it('loi du χ²', () => {
    expect(chi2Cdf(3.841459, 1)).toBeCloseTo(0.95, 7)
    expect(chi2Cdf(10, 5)).toBeCloseTo(0.9247647538534878, 8)
    expect(chi2Inv(0.95, 4)).toBeCloseTo(9.487729036781154, 6)
  })
})

const A = [20.1, 19.8, 20.4, 20.0, 20.3, 19.9, 20.2, 20.5]
const B = [19.6, 19.9, 19.7, 20.0, 19.5, 19.8, 19.9]

describe('statistiques descriptives', () => {
  it('moyenne, variance, écart-type', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3)
    expect(variance([1, 2, 3, 4, 5])).toBe(2.5)
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138089935, 8)
  })
  it('quantiles (type 7) et moments', () => {
    expect(quantile(A, 0.25)).toBeCloseTo(19.975, 10)
    expect(skewness(A)).toBeCloseTo(0, 8)
    expect(kurtosis(A)).toBeCloseTo(-1.2, 8)
  })
})

describe('tests d\'hypothèses', () => {
  it('test t à un échantillon', () => {
    const r = tTestOneSample(A, 20)
    expect(r.statistic).toBeCloseTo(1.732050807568903, 8)
    expect(r.pValue).toBeCloseTo(0.1268703669236662, 6)
    expect(r.reject).toBe(false)
  })
  it('test t de Welch et à variances égales', () => {
    const w = tTestTwoSample(A, B)
    expect(w.statistic).toBeCloseTo(3.437888063012081, 8)
    expect(w.df).toBeCloseTo(12.673211956024955, 6)
    expect(w.pValue).toBeCloseTo(0.004562456402807894, 6)
    const p = tTestTwoSample(A, B, 0.05, 'two-sided', true)
    expect(p.pValue).toBeCloseTo(0.0050724761881984, 6)
  })
  it('ANOVA à un facteur', () => {
    const r = anovaOneWay([
      [6, 8, 4, 5, 3, 4],
      [8, 12, 9, 11, 6, 8],
      [13, 9, 11, 8, 7, 12],
    ])
    expect(r.F).toBeCloseTo(9.264705882352942, 8)
    expect(r.pValue).toBeCloseTo(0.0023987773293929083, 6)
    expect(r.reject).toBe(true)
  })
  it('comparaison de proportions', () => {
    const r = twoProportionTest(60, 1000, 20, 1000)
    expect(r.reject).toBe(true)
    expect(r.estimate).toBeCloseTo(0.04, 10)
  })
  it('Anderson-Darling', () => {
    expect(andersonDarling(A).ad).toBeCloseTo(0.13400045881773792, 6)
    expect(andersonDarling(A).normal).toBe(true)
    const expo = Array.from({ length: 200 }, (_, i) => -Math.log(1 - (i + 0.5) / 200))
    expect(andersonDarling(expo).normal).toBe(false)
  })
})

describe('corrélation et régression', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8]
  const y = [2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8, 16.1]
  it('Pearson', () => {
    const r = pearson(x, y)
    expect(r.r).toBeCloseTo(0.999419474795813, 10)
    expect(r.pValue).toBeCloseTo(4.888933612558555e-10, 14)
  })
  it('régression simple', () => {
    const r = simpleRegression(x, y)
    expect(r.terms[1].coef).toBeCloseTo(1.9976190476190478, 10)
    expect(r.terms[0].coef).toBeCloseTo(0.0357142857142847, 10)
    expect(r.terms[1].se).toBeCloseTo(0.02780044426688155, 10)
    expect(r.rSquared).toBeCloseTo(0.9988392866011391, 10)
  })
})

describe('capabilité', () => {
  it('Cp, Cpk, Pp, Ppk sur données connues', () => {
    // 4 sous-groupes de 5, R̄ connu
    const xs = [10, 10.2, 9.8, 10.1, 9.9, 10.3, 10.1, 10.2, 10, 10.4, 9.7, 9.9, 9.8, 10, 9.6, 10.1, 10, 9.9, 10.2, 10]
    const rbar = (0.4 + 0.4 + 0.4 + 0.3) / 4
    expect(sigmaWithin(xs, 5)).toBeCloseTo(rbar / 2.326, 10)
    const r = capability(xs, { lsl: 9, usl: 11 }, 5)
    const sw = rbar / 2.326
    expect(r.cp).toBeCloseTo(2 / (6 * sw), 10)
    expect(r.cpk).toBeCloseTo(Math.min(11 - r.mean, r.mean - 9) / (3 * sw), 10)
    expect(r.pp).toBeCloseTo(2 / (6 * stdDev(xs)), 10)
    expect(r.ppmObserved).toBe(0)
  })
  it('spécification unilatérale', () => {
    const r = capability([1, 2, 3, 2, 1, 2, 3, 2], { usl: 6 }, 1)
    expect(r.cp).toBeUndefined()
    expect(r.cpk).toBeCloseTo(r.cpu!, 12)
  })
})

describe('métriques sigma', () => {
  it('DPMO ↔ niveau sigma (convention 1,5σ)', () => {
    expect(dpmoToSigma(3.4)).toBeCloseTo(6, 2)
    expect(dpmoToSigma(66807)).toBeCloseTo(3, 3)
    expect(sigmaToDpmo(4)).toBeCloseTo(6209.66, 1)
    const m = sigmaMetrics(25, 1000, 5)
    expect(m.dpmo).toBe(5000)
    expect(m.dpu).toBe(0.025)
  })
})

describe('cartes de contrôle', () => {
  it('constantes', () => {
    const k = spcConstants(5)
    expect(k.A2).toBe(0.577)
    expect(k.D4).toBe(2.114)
    expect(k.c4).toBeCloseTo(0.94, 3)
  })
  it('X̄-R', () => {
    const g = [
      [1, 2, 3],
      [2, 3, 4],
      [1, 3, 5],
    ]
    const r = xbarRChart(g)
    expect(r.primary.center).toBeCloseTo(8 / 3, 10)
    const rbar = (2 + 2 + 4) / 3
    expect(r.primary.ucl[0]).toBeCloseTo(8 / 3 + 1.023 * rbar, 10)
    expect(r.secondary!.ucl[0]).toBeCloseTo(2.574 * rbar, 10)
  })
  it('I-MR et règle 1', () => {
    const xs = [10, 10.1, 9.9, 10, 10.2, 9.8, 10, 10.1, 9.9, 13]
    const r = imrChart(xs, [1])
    expect(r.sigmaWithin).toBeCloseTo((xs.slice(1).reduce((s, x, i) => s + Math.abs(x - xs[i]), 0) / 9) / 1.128, 10)
    expect(r.primary.signals.some((s) => s.index === 9 && s.rule === 1)).toBe(true)
  })
  it('règle 2 (9 points du même côté)', () => {
    const v = [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    const s = detectSignals(v, 0.5, v.map(() => 10), v.map(() => -9), [2])
    expect(s.map((x) => x.index)).toEqual([10])
  })
  it('règle 3 (tendance de 6 points)', () => {
    const v = [5, 1, 2, 3, 4, 5, 6]
    const s = detectSignals(v, 3.5, v.map(() => 100), v.map(() => -100), [3])
    expect(s.map((x) => x.index)).toEqual([6])
  })
  it('cartes p, np, c, u', () => {
    const p = pChart([5, 4, 6], [100, 100, 100])
    expect(p.primary.center).toBeCloseTo(0.05, 12)
    expect(p.primary.ucl[0]).toBeCloseTo(0.05 + 3 * Math.sqrt((0.05 * 0.95) / 100), 12)
    const np = npChart([5, 4, 6], 100)
    expect(np.primary.center).toBeCloseTo(5, 12)
    const c = cChart([4, 9, 5])
    expect(c.primary.ucl[0]).toBeCloseTo(6 + 3 * Math.sqrt(6), 12)
    const u = uChart([10, 20], [5, 10])
    expect(u.primary.center).toBeCloseTo(2, 12)
    expect(u.primary.lcl[0]).toBeCloseTo(2 - 3 * Math.sqrt(2 / 5), 12)
  })
})

describe('plans d\'expériences', () => {
  it('plan 2^3 et effets', () => {
    const runs = fullFactorial(
      [
        { name: 'A', low: 0, high: 1 },
        { name: 'B', low: 0, high: 1 },
        { name: 'C', low: 0, high: 1 },
      ],
      2,
    )
    expect(runs.length).toBe(16)
    // Modèle exact Y = 10 + 3A − 2B + 1·A·B (codé)
    const y = runs.map((r) => 10 + 3 * r.coded[0] - 2 * r.coded[1] + r.coded[0] * r.coded[1] + (r.order <= 8 ? 0.01 : -0.01) * (r.order % 3 === 0 ? 2 : 1))
    const a = analyzeFactorial(runs, y, ['A', 'B', 'C'], 'max')
    expect(a.effects.find((e) => e.term === 'A')!.effect).toBeCloseTo(6, 1)
    expect(a.effects.find((e) => e.term === 'B')!.effect).toBeCloseTo(-4, 1)
    expect(a.effects.find((e) => e.term === 'A×B')!.effect).toBeCloseTo(2, 1)
    expect(a.effects.find((e) => e.term === 'A')!.significant).toBe(true)
    expect(a.bestSetting.coded.slice(0, 2)).toEqual([1, -1])
  })
})

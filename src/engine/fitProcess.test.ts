import { describe, expect, it } from 'vitest'
import { createInitialScenario } from '../data/demo'
import { analyzeFactorial, fullFactorial } from '../stats/doe'
import { Rng } from './random'
import { fitFromDoe, fitFromHistory } from './fitProcess'
import type { ParamKey, ProcessModel } from './types'

const truth = (m: ProcessModel, x: Record<ParamKey, number>) => {
  const r = (k: ParamKey) => m.params.find((p) => p.key === k)!.reference
  return m.baseMean + m.coefficients.temperature * (x.temperature - r('temperature')) + m.coefficients.pressure * (x.pressure - r('pressure')) + m.coefficients.speed * (x.speed - r('speed')) + (m.interactionTV * (x.temperature - r('temperature')) * (x.speed - r('speed'))) / 1000
}

describe('estimation du modèle procédé sur données réelles', () => {
  it('régression sur un historique : retrouve les effets des réglages', () => {
    const m = createInitialScenario().process
    m.interactionTV = 0
    const rng = new Rng(5)
    const rows = Array.from({ length: 300 }, () => ({ temperature: rng.normal(38, 4), pressure: rng.normal(60, 5), speed: rng.normal(1200, 120) }))
    const y = rows.map((x) => truth(m, x) + rng.normal(0, 0.003))
    const fit = fitFromHistory(m, (['temperature', 'pressure', 'speed'] as ParamKey[]).map((k) => ({ key: k, values: rows.map((r) => r[k]) })), y)
    expect(fit.coefficients.temperature!).toBeCloseTo(m.coefficients.temperature, 3)
    expect(fit.baseMean).toBeCloseTo(m.baseMean, 3)
    expect(fit.residualSd!).toBeCloseTo(0.003, 3)
    expect(fit.setpoints!.temperature!).toBeCloseTo(38, 0)
  })
  it('plan 2³ réalisé en atelier : les effets reconstruisent exactement le modèle (avec interaction T×V)', () => {
    const m = createInitialScenario().process
    const levels: Record<ParamKey, [number, number]> = { temperature: [30, 45], pressure: [50, 70], speed: [1000, 1400] }
    const factors = m.params.map((p) => ({ name: p.name, low: levels[p.key][0], high: levels[p.key][1] }))
    const runs = fullFactorial(factors, 1)
    const y = runs.map((r) => truth(m, { temperature: r.actual[0], pressure: r.actual[1], speed: r.actual[2] }))
    const an = analyzeFactorial(runs, y, factors.map((f) => f.name.split(' ')[0]))
    const fit = fitFromDoe(m, levels, an.effects, y.reduce((a, b) => a + b, 0) / y.length)
    const fitted: ProcessModel = { ...m, baseMean: fit.baseMean, coefficients: { ...m.coefficients, ...fit.coefficients } as ProcessModel['coefficients'], interactionTV: fit.interactionTV! }
    for (const x of [{ temperature: 33, pressure: 55, speed: 1100 }, { temperature: 44, pressure: 68, speed: 1350 }]) {
      expect(truth(fitted, x)).toBeCloseTo(truth(m, x), 8)
    }
  })
})

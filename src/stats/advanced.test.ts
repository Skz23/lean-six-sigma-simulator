import { describe, expect, it } from 'vitest'
import x from './fixtures/lognormal200.json'
import { gageRR, charbonneau } from './msa'
import { cpm, findBoxCoxLambda, kanoClassify, kanoSummary, sampleSizeForPower, tTestPower, transformSpec } from './advanced'

// Données générées et analysées indépendamment avec NumPy / SciPy
const GAGE = [[[12.086, 11.97], [12.135, 12.057], [11.73, 11.863]], [[7.491, 7.347], [7.786, 7.554], [7.399, 7.703]], [[10.427, 10.217], [10.532, 10.676], [10.805, 10.364]], [[9.384, 9.633], [9.405, 9.524], [9.509, 9.448]], [[9.516, 9.631], [9.132, 9.902], [9.305, 9.164]], [[9.74, 9.825], [9.845, 9.719], [9.79, 9.774]], [[8.261, 8.129], [8.169, 8.352], [7.839, 7.695]], [[9.835, 9.835], [9.875, 9.762], [9.764, 9.219]], [[9.173, 9.133], [8.957, 9.297], [8.942, 9.286]], [[12.916, 13.14], [13.615, 13.704], [12.791, 13.123]]]

describe('étude R&R (ANOVA)', () => {
  it('reproduit le calcul de référence', () => {
    const r = gageRR(GAGE, 6)
    expect(r.interactionPooled).toBe(true) // p interaction = 0,135 > 0,05
    expect(r.pctRR).toBeCloseTo(0.132421011598235, 8)
    expect(r.ndc).toBe(10)
    expect(r.components.find((c) => c.source.startsWith('Répétabilité'))!.variance).toBeCloseTo(0.039960964583333355, 10)
    expect(r.verdict).toBe('acceptable')
  })
  it('méthode de Charbonneau (Cmc)', () => {
    const c = charbonneau([[10.023, 10.022, 10.025], [10.02, 10.02, 10.021], [10.03, 10.028, 10.031]], 0.04)
    const rbar = (0.003 + 0.001 + 0.003) / 3
    expect(c.sigma).toBeCloseTo(rbar / 1.693, 12)
    expect(c.cmc).toBeCloseTo(0.04 / (6 * (rbar / 1.693)), 10)
  })
})

describe('compléments statistiques', () => {
  it('Box-Cox : λ du maximum de vraisemblance (SciPy 0,05148)', () => {
    const r = findBoxCoxLambda(x as number[])
    expect(r.lambda).toBeCloseTo(0.05148419299369598, 3)
    expect(r.rounded).toBe(0)
    const t = transformSpec(1, 4, -1)
    expect(t.lsl).toBeCloseTo(0.75, 12)
    expect(t.usl).toBeCloseTo(0, 12)
  })
  it('puissance et effectif (Student décentrée : n = 17 pour d = 1, α = 5 %, 1 − β = 80 %)', () => {
    expect(sampleSizeForPower(1, 1, 0.8)).toBe(17)
    expect(tTestPower(17, 1, 1)).toBeCloseTo(0.807, 2)
  })
  it('Cpm', () => {
    const xs = [9, 11, 9, 11]
    expect(cpm(xs, 7, 13, 10)).toBeCloseTo(6 / (6 * Math.sqrt(4 / 3)), 10)
  })
  it('Kano', () => {
    expect(kanoClassify(1, 5)).toBe('O')
    expect(kanoClassify(1, 3)).toBe('A')
    expect(kanoClassify(2, 5)).toBe('M')
    expect(kanoClassify(3, 3)).toBe('I')
    const s = kanoSummary(['M', 'M', 'O', 'A'])
    expect(s.major).toBe('M')
    expect(s.satisfaction).toBeCloseTo(0.5, 10)
    expect(s.dissatisfaction).toBeCloseTo(-0.75, 10)
  })
})

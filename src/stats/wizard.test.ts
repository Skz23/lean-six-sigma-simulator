import { describe, expect, it } from 'vitest'
import { parseColumns, parseTable, runWizard } from './wizard'
import { Rng } from '../engine/random'

const gauss = (n: number, mu: number, sd: number, seed: number) => {
  const r = new Rng(seed)
  return Array.from({ length: n }, () => r.normal(mu, sd))
}
const skewed = (n: number, seed: number, shift = 0) => {
  const r = new Rng(seed)
  return Array.from({ length: n }, () => shift + Math.exp(r.normal(0, 1)))
}

describe('assistant « Quel test ? »', () => {
  it('2 groupes normaux → test t, différence détectée', () => {
    const res = runWizard({ goal: 'means', groups: [{ name: 'A', values: gauss(40, 10, 1, 1) }, { name: 'B', values: gauss(40, 11, 1, 2) }] })
    expect(res.main!.name).toMatch(/t/)
    expect(res.main!.reject).toBe(true)
  })
  it('2 groupes non normaux → Mann-Whitney', () => {
    const res = runWizard({ goal: 'means', groups: [{ name: 'A', values: skewed(60, 3) }, { name: 'B', values: skewed(60, 4, 1.5) }] })
    expect(res.main!.name).toMatch(/Mann-Whitney/)
    expect(res.steps[0].status).toBe('warn')
  })
  it('3 groupes non normaux → Levene puis Kruskal-Wallis', () => {
    const res = runWizard({ goal: 'means', groups: [1, 2, 3].map((i) => ({ name: `G${i}`, values: skewed(50, 10 + i) })) })
    expect(res.steps[1].title).toMatch(/Levene/)
    expect(res.main!.name).toMatch(/Kruskal/)
  })
  it('3 groupes normaux → ANOVA', () => {
    const res = runWizard({ goal: 'means', groups: [0, 0, 2].map((m, i) => ({ name: `G${i}`, values: gauss(30, m, 1, 20 + i) })) })
    expect(res.main!.name).toMatch(/ANOVA/)
    expect(res.main!.reject).toBe(true)
  })
  it('appariées → test t apparié ; dispersions → Fisher ; cible → t à un échantillon', () => {
    const a = gauss(30, 5, 1, 7)
    expect(runWizard({ goal: 'means', paired: true, groups: [{ name: 'Av', values: a }, { name: 'Ap', values: a.map((x, i) => x - 0.5 + gauss(30, 0, 0.1, 8)[i]) }] }).main!.name).toMatch(/apparié/)
    expect(runWizard({ goal: 'variances', groups: [{ name: 'A', values: gauss(30, 0, 1, 9) }, { name: 'B', values: gauss(30, 0, 3, 10) }] }).main!.reject).toBe(true)
    expect(runWizard({ goal: 'target', target: 5, groups: [{ name: 'X', values: gauss(30, 5, 1, 11) }] }).main!.name).toMatch(/un échantillon/)
  })
  it('relation et khi²', () => {
    const x = gauss(50, 35, 3, 12)
    const y = x.map((v, i) => 25 + 0.003 * v + gauss(50, 0, 0.004, 13)[i])
    expect(runWizard({ goal: 'relation', groups: [{ name: 'T', values: x }, { name: 'D', values: y }] }).main!.reject).toBe(true)
    const t = parseTable('\tA\tB\nE1\t30\t5\nE2\t10\t25')
    expect(t.table).toEqual([[30, 5], [10, 25]])
    expect(runWizard({ goal: 'categorical', groups: [], table: t.table }).main!.reject).toBe(true)
  })
  it('lit un collage Excel avec en-têtes et décimales à virgule', () => {
    expect(parseColumns('M1\tM2\n25,01\t25,03\n25,02\t\n')).toEqual([{ name: 'M1', values: [25.01, 25.02] }, { name: 'M2', values: [25.03] }])
  })
  it('signale les données insuffisantes', () => {
    expect(runWizard({ goal: 'means', groups: [{ name: 'A', values: [1, 2, 3] }] }).error).toBeTruthy()
  })
})

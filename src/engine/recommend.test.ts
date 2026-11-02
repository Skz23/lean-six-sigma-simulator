import { describe, expect, it } from 'vitest'
import { createInitialScenario } from '../data/demo'
import { simulate } from './simulation'
import { computeKpis } from './kpi'
import { candidates, evaluate, runDays, summarize } from './recommend'
import { autoMap, buildDataset, parseTable, toNumber, hasHeader, TEMPLATES } from '../data/import'
import { calibrateProcess, scenarioFromStations, subgroupSizeOf } from '../data/realScenario'

describe('import de données', () => {
  it('lit le CSV français et les nombres à virgule', () => {
    const rows = parseTable('Date;Valeur\n"2026-11-02";25,012\n2026-11-02;1 250,5\n')
    expect(rows).toEqual([['Date', 'Valeur'], ['2026-11-02', '25,012'], ['2026-11-02', '1 250,5']])
    expect(toNumber('25,012')).toBeCloseTo(25.012, 10)
    expect(toNumber('1 250,5')).toBe(1250.5)
    expect(toNumber('95 %')).toBe(95)
    expect(toNumber('1.250,5')).toBe(1250.5)
    expect(toNumber('25.001')).toBeCloseTo(25.001, 10)
    expect(toNumber('1.250.000')).toBe(1250000)
  })
  it('lit un copier-coller Excel (tabulations)', () => {
    expect(parseTable('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('importe les trois modèles fournis', () => {
    for (const kind of ['measures', 'defects', 'line'] as const) {
      const rows = parseTable(TEMPLATES[kind].content)
      expect(hasHeader(rows)).toBe(true)
      const map = autoMap(kind, rows[0])
      const r = buildDataset(kind, rows.slice(1), map)
      expect(r.errors).toEqual([])
    }
    const rows = parseTable(TEMPLATES.line.content)
    const line = buildDataset('line', rows.slice(1), autoMap('line', rows[0])).dataset!.stations!
    expect(line.length).toBe(4)
    expect(line[1].availability).toBeCloseTo(0.88, 10)
    expect(line[1].defectRate).toBeCloseTo(0.012, 10)
    expect(line[2].valueAdded).toBe(false)
    expect(line[0].defectRate).toBeCloseTo(0.005, 10)
  })
  it('déduit la taille des sous-groupes', () => {
    expect(subgroupSizeOf(['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c'])).toBe(3)
    expect(subgroupSizeOf(undefined)).toBe(1)
  })
})

describe('données réelles → simulation', () => {
  it('une ligne importée se simule et le modèle calé reproduit les mesures', () => {
    const rows = parseTable(TEMPLATES.line.content)
    const st = buildDataset('line', rows.slice(1), autoMap('line', rows[0])).dataset!.stations!
    const sc = scenarioFromStations(createInitialScenario(), st, 'Ma ligne', 'x1')
    sc.demand = 400
    const values = Array.from({ length: 200 }, (_, i) => 10 + 0.02 * Math.sin(i * 1.7) + (i % 5) * 0.004)
    const cal = calibrateProcess(sc, { id: 'd', name: 'd', kind: 'measures', createdAt: '', values, spec: { name: 'Cote', unit: 'mm', lsl: 9.9, usl: 10.1 } })
    const r = simulate(sc)
    const k = computeKpis(sc, r)
    expect(r.good).toBeGreaterThan(200)
    expect(k.dimension!.mean).toBeCloseTo(cal.mean, 2)
    expect(sc.process.characteristic.lsl).toBe(9.9)
  })
})

describe('recommandations', () => {
  it('propose et chiffre des actions sur la situation initiale', () => {
    const sc = createInitialScenario()
    const r = simulate(sc)
    const k = computeKpis(sc, r)
    const cands = candidates(sc, k, r.bottleneckIndex)
    const ids = cands.map((c) => c.id)
    expect(ids).toContain('kanban')
    expect(ids).toContain('recenter')
    const base = summarize(runDays(sc, 2))
    const recenter = evaluate(sc, cands.find((c) => c.id === 'recenter')!, base, 2)
    expect(recenter.dScrapRate).toBeLessThan(0)
    const kanban = evaluate(sc, cands.find((c) => c.id === 'kanban')!, base, 2)
    expect(kanban.dLeadTime).toBeLessThan(0)
  })
})

describe('diagnostic des données réelles', () => {
  it('détecte un procédé décentré et propose le recentrage chiffré', async () => {
    const { diagnoseMeasures, diagnoseDefects } = await import('./realDiagnostics')
    const values = Array.from({ length: 100 }, (_, i) => 10.03 + 0.012 * Math.sin(i * 2.1))
    const f = diagnoseMeasures({ id: 'm', name: 'Cote', kind: 'measures', createdAt: '', values, spec: { name: 'Cote', unit: 'mm', lsl: 9.95, usl: 10.05, target: 10 } })
    const dec = f.find((x) => x.title.includes('décentré'))!
    expect(dec).toBeTruthy()
    expect(dec.action).toContain('-0,03')
    const d = diagnoseDefects({ id: 'd', name: 'Déf', kind: 'defects', createdAt: '', defects: [{ category: 'A', count: 80, station: '', date: '', cost: 1 }, { category: 'B', count: 15, station: '', date: '', cost: 1 }, { category: 'C', count: 5, station: '', date: '', cost: 1 }] })
    expect(d[0].title).toContain('1 catégorie')
  })
})

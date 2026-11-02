import { describe, expect, it } from 'vitest'
import { applyLeanImprovements, applySixSigmaImprovements, createInitialScenario } from '../data/demo'
import { LineSimulation, simulate } from './simulation'
import { computeKpis } from './kpi'
import { predict, samplePart, setpointsOf } from './processModel'
import type { Scenario } from './types'
import { mean, stdDev } from '../stats/descriptive'
import { fiveSScores, kanbanCards, lineBalance, manhattan, smedAnalysis, taktTime } from '../lean/tools'

/** Ligne déterministe : pas de pannes, pas de variabilité, pas de défauts. */
function deterministic(): Scenario {
  const s = createInitialScenario()
  s.warmup = false
  s.shift = { duration: 480, breaks: [] }
  s.batchSize = 100000
  s.process.params.forEach((p) => (p.noiseSd = 0))
  s.process.residualSd = 0
  s.process.batchSd = 0
  s.process.toolWearPerPart = 0
  s.process.params.find((p) => p.key === 'temperature')!.setpoint = 35
  s.stations.forEach((x, i) => {
    x.availability = 1
    x.cycleTimeCV = 0
    x.defectRate = 0
    x.initialWip = 0
    x.distanceToNext = 0
    x.cycleTime = i === 2 ? 60 : 30
    x.capacity = 1
  })
  return s
}

describe('moteur de simulation', () => {
  it('est reproductible pour une même graine', () => {
    const a = simulate(createInitialScenario())
    const b = simulate(createInitialScenario())
    expect(a.good).toBe(b.good)
    expect(a.avgWip).toBe(b.avgWip)
  })

  it('conserve la matière (lancées + préchargées = bonnes + rebuts + encours)', () => {
    const sc = createInitialScenario()
    sc.warmup = false
    const sim = new LineSimulation(sc)
    const r = sim.run()
    const preloaded = r.products.filter((p) => p.preloaded).length
    const wip = r.products.filter((p) => p.status === 'wip').length
    const goodFromProducts = r.products.filter((p) => p.status === 'good').length
    expect(goodFromProducts).toBe(r.good)
    expect(r.released + preloaded).toBe(goodFromProducts + r.scrap + wip)
    expect(wip).toBe(r.wipEnd)
  })

  it('ligne déterministe : débit = temps disponible / temps de cycle du goulot', () => {
    const sc = deterministic()
    const r = simulate(sc)
    // remplissage de la ligne : 2 postes à 30 s avant le goulot
    const expected = Math.floor((480 * 60 - 60) / 60) - 3
    expect(r.good).toBeGreaterThanOrEqual(expected)
    expect(r.good).toBeLessThanOrEqual(expected + 4)
    expect(r.stations[r.bottleneckIndex].name).toBe(sc.stations[2].name)
    expect(r.scrap).toBe(0)
  })

  it('réduire le temps de cycle du goulot augmente le débit (lien Lean)', () => {
    const sc = deterministic()
    const before = simulate(sc).good
    sc.stations[2].cycleTime = 40
    const after = simulate(sc).good
    expect(after).toBeGreaterThan(before * 1.4)
  })

  it('les pauses réduisent le temps planifié et la production', () => {
    const sc = deterministic()
    const a = simulate(sc)
    sc.shift.breaks = [{ start: 200, duration: 60, label: 'test' }]
    const b = simulate(sc)
    expect(b.plannedTime).toBe(a.plannedTime - 3600)
    expect(b.good).toBeLessThan(a.good - 55)
  })

  it('les changements de série consomment du temps au goulot', () => {
    const sc = deterministic()
    sc.batchSize = 50
    sc.stations[2].changeoverTime = 20
    const r = simulate(sc)
    const st = r.stations[2]
    expect(st.changeovers).toBeGreaterThan(5)
    expect(st.time.changeover / 60).toBeCloseTo(st.changeovers * 20, 0)
  })

  it('la disponibilité simulée est cohérente avec MTBF/MTTR', () => {
    const sc = deterministic()
    sc.stations[2].availability = 0.8
    sc.stations[2].mttr = 10
    sc.shift.duration = 480 * 20 // longue période pour la loi des grands nombres
    const r = simulate(sc)
    const st = r.stations[2].time
    const ratio = st.processing / (st.processing + st.down)
    expect(ratio).toBeGreaterThan(0.74)
    expect(ratio).toBeLessThan(0.86)
  })

  it('le flux tiré limite la surproduction', () => {
    const sc = deterministic()
    sc.demand = 300
    const push = simulate(sc)
    sc.releasePolicy = 'pull'
    sc.finishedGoodsCap = 20
    // boucles kanban : encours plafonnés entre postes
    sc.stations.forEach((x) => (x.bufferCapacity = 5))
    const pull = simulate(sc)
    expect(push.good).toBeGreaterThan(400)
    expect(pull.good).toBeLessThanOrEqual(300 + 20)
    expect(pull.avgWip).toBeLessThan(push.avgWip)
  })

  it('la température influence la distribution du diamètre (lien Six Sigma)', () => {
    const sc = createInitialScenario()
    const k1 = computeKpis(sc, simulate(sc))
    const sc2 = createInitialScenario()
    sc2.process.params.find((p) => p.key === 'temperature')!.setpoint = 35
    const k2 = computeKpis(sc2, simulate(sc2))
    expect(k1.dimension!.mean - k2.dimension!.mean).toBeGreaterThan(0.018)
    expect(k2.dimensionNc).toBeLessThan(k1.dimensionNc)
    expect(k2.dimension!.cpk!).toBeGreaterThan(k1.dimension!.cpk!)
  })

  it('la vitesse de coupe accélère le poste qualité mais augmente la dispersion', () => {
    const sc = deterministic()
    const base = simulate(sc).stations[1].nominalCycleTime
    sc.process.params.find((p) => p.key === 'speed')!.setpoint = 1500
    expect(simulate(sc).stations[1].nominalCycleTime).toBeCloseTo((base * 1200) / 1500, 6)
    const m = createInitialScenario().process
    const p1 = predict(m, setpointsOf(m), 120)
    const p2 = predict(m, { ...setpointsOf(m), speed: 1500 }, 120)
    expect(p2.sdWithin).toBeGreaterThan(p1.sdWithin)
  })

  it('la prédiction analytique concorde avec l\'échantillonnage Monte-Carlo', () => {
    const m = createInitialScenario().process
    const sp = setpointsOf(m)
    const pr = predict(m, sp, 120)
    const ys = samplePart(m, sp, 24000, 120, 7).map((x) => x.y)
    expect(mean(ys)).toBeCloseTo(pr.mean, 3)
    expect(stdDev(ys) / pr.sdOverall).toBeGreaterThan(0.9)
    expect(stdDev(ys) / pr.sdOverall).toBeLessThan(1.1)
  })

  it('les scénarios améliorés réduisent Lead Time et défauts', () => {
    const init = createInitialScenario()
    const k0 = computeKpis(init, simulate(init))
    const lean = applyLeanImprovements(init)
    const kl = computeKpis(lean, simulate(lean))
    const six = applySixSigmaImprovements(init)
    const ks = computeKpis(six, simulate(six))
    expect(kl.leadTime).toBeLessThan(k0.leadTime / 2)
    expect(ks.dimension!.cpk!).toBeGreaterThan(1.33)
    expect(1 - ks.yield).toBeLessThan(1 - k0.yield)
  })
})

describe('formules Lean', () => {
  it('takt time', () => {
    expect(taktTime(25800, 420)).toBeCloseTo(61.43, 2)
  })
  it('kanban : N = D·L·(1+α)/C arrondi au supérieur', () => {
    expect(kanbanCards({ dailyDemand: 420, leadTimeDays: 0.5, safety: 0.1, containerSize: 20 })).toBe(12)
  })
  it('SMED', () => {
    const r = smedAnalysis([
      { id: '1', label: 'a', duration: 10, type: 'internal', convertible: true, reduction: 0 },
      { id: '2', label: 'b', duration: 20, type: 'internal', convertible: false, reduction: 0.5 },
      { id: '3', label: 'c', duration: 5, type: 'external', convertible: true, reduction: 0 },
    ])
    expect(r.before).toBe(35)
    expect(r.after).toBe(10)
    expect(r.gainPct).toBeCloseTo(1 - 10 / 35, 10)
  })
  it('5S', () => {
    const r = fiveSScores({ seiri: [4, 4, 4, 4], seiton: [0, 0, 0, 0], seiso: [2, 2, 2, 2], seiketsu: [2, 2, 2, 2], shitsuke: [2, 2, 2, 2] })
    expect(r.global).toBe(50)
    expect(r.weakest[0].key).toBe('seiton')
  })
  it('distance rectilinéaire et équilibrage', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7)
    const sc = deterministic()
    const b = lineBalance(sc, [30, 30, 60, 30, 30, 30], 60)
    expect(b.efficiency).toBeCloseTo(210 / 360, 10)
    expect(b.minStations).toBe(4)
  })
})

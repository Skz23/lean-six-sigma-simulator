/**
 * Indicateurs Lean, qualité et économiques calculés à partir des résultats de simulation.
 * Toutes les formules sont documentées dans docs/FORMULES.md.
 */
import type { Scenario, SimResults } from './types'
import { mean, median } from '../stats/descriptive'
import { capability, type CapabilityResult } from '../stats/capability'
import { sigmaMetrics } from '../stats/sigma'

export interface Kpis {
  taktTime: number
  plannedTime: number
  /** Temps de cycle effectif du goulot : CT / capacité / disponibilité + changement de série amorti sur le lot. */
  bottleneckCycleTime: number
  /** Temps de cycle observé de la ligne = temps planifié / pièces bonnes. */
  lineCycleTime: number
  /** Lead Time par la loi de Little : WIP moyen / débit de sortie (s). */
  leadTime: number
  /** Lead Time observé sur les pièces lancées et terminées dans la journée (s). */
  leadTimeObserved: number
  leadTimeMedian: number
  throughputPerHour: number
  good: number
  scrap: number
  released: number
  demand: number
  shipped: number
  backlog: number
  serviceLevel: number
  overproduction: number
  wipAvg: number
  wipEnd: number
  fgStock: number
  oee: number
  /** TRG = temps utile / temps d'ouverture (pauses et arrêts planifiés compris). */
  trg: number
  /** Ratio de tension de flux = Σ VA / (Σ VA + Takt × Σ en-cours), en fraction. */
  rtf: number
  oeeAvailability: number
  oeePerformance: number
  oeeQuality: number
  productivity: number
  operators: number
  yield: number
  rty: number
  vaTime: number
  nvaTime: number
  pce: number
  avgWaitPerPart: number
  avgTransportPerPart: number
  operatorUtilization: number
  dimension?: CapabilityResult
  dimensionNc: number
  measured: number
  sigma: ReturnType<typeof sigmaMetrics>
  defectsByType: { type: string; count: number; stationId: string }[]
  costs: {
    revenue: number
    material: number
    labor: number
    holding: number
    latePenalty: number
    copq: number
    margin: number
    costPerGoodPart: number
  }
}

export function computeKpis(sc: Scenario, r: SimResults): Kpis {
  const P = r.plannedTime
  const hours = P / 3600
  const out = r.good + r.scrap
  const exitRate = out / P
  const leadTime = exitRate > 0 ? r.avgWip / exitRate : Infinity
  const done = r.products.filter((p) => !p.preloaded && p.status === 'good' && p.exit !== undefined)
  const lts = done.map((p) => p.exit! - p.release)
  const b = r.stations[r.bottleneckIndex]
  const bs = sc.stations[r.bottleneckIndex]
  const bottleneckCT = b.nominalCycleTime / bs.capacity / Math.max(bs.availability, 0.01) + (bs.changeoverTime * 60) / Math.max(1, sc.batchSize)
  const operators = sc.stations.reduce((s, x) => s + x.operators, 0)
  const vaTime = sc.stations.reduce((s, x, i) => s + (x.valueAdded ? r.stations[i].nominalCycleTime : 0), 0)

  // Temps d'attente et de manutention observés par pièce (pièces terminées)
  let wait = 0
  let transport = 0
  for (const p of done) {
    transport += p.transportTime
    for (const h of p.history) if (Number.isFinite(h.start) && Number.isFinite(h.arrive)) wait += h.start - h.arrive
  }
  // TRS ligne = disponibilité × performance du goulot × qualité de la ligne (rendement global)
  const oeeAvailability = b.oee.availability
  const oeePerformance = b.oee.performance
  const oeeQuality = out > 0 ? r.good / out : 1
  const oee = oeeAvailability * oeePerformance * oeeQuality

  // Utilisation des opérateurs : part du temps où leur poste est actif (traitement + changement)
  let opBusy = 0
  sc.stations.forEach((x, i) => {
    const t = r.stations[i].time
    opBusy += x.operators * ((t.processing + t.changeover) / P)
  })

  const measuredParts = r.products.filter((p) => p.dimension !== undefined)
  const dims = measuredParts.map((p) => p.dimension!)
  const c = sc.process.characteristic
  const dimension = dims.length >= 10 ? capability(dims, { lsl: c.lsl, usl: c.usl, target: c.nominal }, 5) : undefined
  const dimensionNc = dims.filter((d) => d < c.lsl || d > c.usl).length

  const defects = new Map<string, { type: string; count: number; stationId: string }>()
  for (const p of r.products)
    if (p.defect) {
      const k = p.defect.type
      const e = defects.get(k) ?? { type: k, count: 0, stationId: p.defect.stationId }
      e.count++
      defects.set(k, e)
    }

  // Coûts journaliers
  const co = sc.costs
  const laborPerSec = co.laborCostPerHour / 3600
  let copq = 0
  for (const p of r.products)
    if (p.status === 'scrap') {
      let lab = 0
      for (const h of p.history) {
        const idx = sc.stations.findIndex((s) => s.id === h.stationId)
        if (idx >= 0 && Number.isFinite(h.end) && Number.isFinite(h.start)) lab += (h.end - h.start) * sc.stations[idx].operators * laborPerSec
      }
      copq += co.materialCost + lab
    }
  const revenue = r.shipped * co.sellingPrice
  const material = r.released * co.materialCost
  const labor = operators * (r.openTime / 3600) * co.laborCostPerHour
  const holding = (r.avgWip + r.fgStock) * co.wipUnitValue * (co.holdingRate / 100) / co.workingDaysPerYear
  const latePenalty = r.backlog * co.lateDeliveryPenalty
  const margin = revenue - material - labor - holding - latePenalty

  return {
    taktTime: r.taktTime,
    plannedTime: P,
    bottleneckCycleTime: bottleneckCT,
    lineCycleTime: r.good > 0 ? P / r.good : Infinity,
    leadTime,
    leadTimeObserved: lts.length ? mean(lts) : NaN,
    leadTimeMedian: lts.length ? median(lts) : NaN,
    throughputPerHour: r.good / hours,
    good: r.good,
    scrap: r.scrap,
    released: r.released,
    demand: sc.demand,
    shipped: r.shipped,
    backlog: r.backlog,
    serviceLevel: sc.demand > 0 ? r.shipped / sc.demand : 1,
    overproduction: Math.max(0, r.good - sc.demand),
    wipAvg: r.avgWip,
    wipEnd: r.wipEnd,
    fgStock: r.fgStock,
    oee,
    trg: oee * (P / r.openTime),
    rtf: (() => {
      const enc = r.avgWip + r.fgStock
      const nva = Number.isFinite(r.taktTime) ? r.taktTime * enc : 0
      return vaTime + nva > 0 ? vaTime / (vaTime + nva) : 0
    })(),
    oeeAvailability,
    oeePerformance,
    oeeQuality,
    productivity: operators > 0 ? r.good / (operators * (r.openTime / 3600)) : 0,
    operators,
    yield: out > 0 ? r.good / out : 1,
    rty: r.stations.reduce((s, x) => s * x.oee.quality, 1),
    vaTime,
    nvaTime: Math.max(0, leadTime - vaTime),
    pce: Number.isFinite(leadTime) && leadTime > 0 ? vaTime / leadTime : 0,
    avgWaitPerPart: done.length ? wait / done.length : NaN,
    avgTransportPerPart: done.length ? transport / done.length : NaN,
    operatorUtilization: operators > 0 ? opBusy / operators : 0,
    dimension,
    dimensionNc,
    measured: dims.length,
    sigma: sigmaMetrics(r.scrap, out, 1),
    defectsByType: [...defects.values()].sort((a, b2) => b2.count - a.count),
    costs: {
      revenue,
      material,
      labor,
      holding,
      latePenalty,
      copq,
      margin,
      costPerGoodPart: r.good > 0 ? (material + labor + holding) / r.good : Infinity,
    },
  }
}

/** Capacité théorique de chaque poste (pièces/h) intégrant disponibilité, changements de série et rebuts. */
export function theoreticalCapacity(sc: Scenario, effectiveCT: number[]) {
  return sc.stations.map((s, i) => {
    const ct = effectiveCT[i] / s.capacity
    const coPerPart = (s.changeoverTime * 60) / Math.max(1, sc.batchSize)
    const secondsPerPart = ct / Math.max(s.availability, 0.01) + coPerPart
    return {
      id: s.id,
      name: s.name,
      secondsPerPart,
      partsPerHour: 3600 / secondsPerPart,
      goodPartsPerHour: (3600 / secondsPerPart) * (1 - s.defectRate),
    }
  })
}

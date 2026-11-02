/** Définitions des indicateurs comparés entre scénarios (avant / après). */
import type { Kpis } from './kpi'
import type { Scenario } from './types'
import { fmt, eur } from '../lib/format'

export type MetricGroup = 'lean' | 'sixsigma' | 'combined'

export interface MetricDef {
  key: string
  label: string
  unit: string
  group: MetricGroup
  higherIsBetter: boolean
  get: (k: Kpis, sc: Scenario) => number
  format: (v: number) => string
}

const n = (d: number, unit = '') => (v: number) => `${fmt(v, d)}${unit ? ` ${unit}` : ''}`

export const METRICS: MetricDef[] = [
  { key: 'leadTime', label: 'Lead Time', unit: 'min', group: 'lean', higherIsBetter: false, get: (k) => k.leadTime / 60, format: n(1, 'min') },
  { key: 'wip', label: 'Encours moyen (WIP)', unit: 'pcs', group: 'lean', higherIsBetter: false, get: (k) => k.wipAvg, format: n(1, 'pcs') },
  { key: 'wait', label: 'Attente moyenne par pièce', unit: 'min', group: 'lean', higherIsBetter: false, get: (k) => k.avgWaitPerPart / 60, format: n(1, 'min') },
  { key: 'throughput', label: 'Débit (pièces bonnes)', unit: 'pcs/h', group: 'lean', higherIsBetter: true, get: (k) => k.throughputPerHour, format: n(1, 'pcs/h') },
  { key: 'oee', label: 'TRS / OEE', unit: '%', group: 'lean', higherIsBetter: true, get: (k) => k.oee * 100, format: n(1, '%') },
  { key: 'scrapRate', label: 'Taux de défauts', unit: '%', group: 'sixsigma', higherIsBetter: false, get: (k) => (1 - k.yield) * 100, format: n(2, '%') },
  { key: 'sigmaY', label: 'Écart-type du diamètre', unit: 'µm', group: 'sixsigma', higherIsBetter: false, get: (k) => (k.dimension?.sigmaOverall ?? NaN) * 1000, format: n(1, 'µm') },
  { key: 'cpk', label: 'Cpk', unit: '', group: 'sixsigma', higherIsBetter: true, get: (k) => k.dimension?.cpk ?? NaN, format: n(2) },
  { key: 'dpmo', label: 'DPMO', unit: '', group: 'sixsigma', higherIsBetter: false, get: (k) => k.sigma.dpmo, format: n(0) },
  { key: 'sigmaLevel', label: 'Niveau Sigma', unit: 'σ', group: 'sixsigma', higherIsBetter: true, get: (k) => k.sigma.sigmaLevel, format: n(2, 'σ') },
  { key: 'productivity', label: 'Productivité', unit: 'pcs/h·op', group: 'combined', higherIsBetter: true, get: (k) => k.productivity, format: n(2, 'pcs/h·op') },
  { key: 'copq', label: 'Coût de non-qualité', unit: '€/j', group: 'combined', higherIsBetter: false, get: (k) => k.costs.copq, format: (v) => `${eur(v)}/j` },
  {
    key: 'prodTime',
    label: 'Temps pour produire la demande',
    unit: 'h',
    group: 'combined',
    higherIsBetter: false,
    get: (k) => (k.demand * k.lineCycleTime) / 3600,
    format: n(2, 'h'),
  },
  { key: 'good', label: 'Pièces conformes / jour', unit: 'pcs', group: 'combined', higherIsBetter: true, get: (k) => k.good, format: n(0, 'pcs') },
  { key: 'margin', label: 'Marge journalière', unit: '€/j', group: 'combined', higherIsBetter: true, get: (k) => k.costs.margin, format: (v) => `${eur(v)}/j` },
]

export interface Profitability {
  dailyGain: number
  annualGain: number
  investment: number
  roi: number
  paybackMonths: number
}

/**
 * Rentabilité des améliorations : gain annuel = Δ marge journalière × jours ouvrés ;
 * investissement = somme des actions du scénario amélioré non présentes dans la référence.
 */
export function profitability(base: Kpis, after: Kpis, baseSc: Scenario, afterSc: Scenario): Profitability {
  const dailyGain = after.costs.margin - base.costs.margin
  const annualGain = dailyGain * afterSc.costs.workingDaysPerYear
  const baseIds = new Set(baseSc.actions.map((a) => a.id))
  const investment = afterSc.actions.filter((a) => !baseIds.has(a.id)).reduce((s, a) => s + a.investment, 0)
  return {
    dailyGain,
    annualGain,
    investment,
    roi: investment > 0 ? annualGain / investment : NaN,
    paybackMonths: annualGain > 0 ? (investment / annualGain) * 12 : Infinity,
  }
}

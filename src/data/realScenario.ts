/**
 * Passage des données réelles au simulateur : création d'un scénario à partir d'une
 * ligne importée et calage du modèle qualité sur des mesures réelles.
 */
import type { Scenario, Station } from '../engine/types'
import { capability } from '../stats/capability'
import type { Dataset } from './import'

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

/** Taille de sous-groupe déduite de la colonne « sous-groupe » (taille la plus fréquente, 2 à 10), sinon 1. */
export function subgroupSizeOf(groups?: string[]): number {
  if (!groups || !groups.some(Boolean)) return 1
  const sizes = new Map<number, number>()
  let cur = groups[0]
  let n = 0
  for (const g of [...groups, '\u0000end']) {
    if (g === cur) n++
    else {
      sizes.set(n, (sizes.get(n) ?? 0) + 1)
      cur = g
      n = 1
    }
  }
  const best = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1
  return best >= 2 && best <= 10 ? best : 1
}

/** Nouveau scénario construit sur la ligne importée (paramètres économiques et demande repris du scénario de base). */
export function scenarioFromStations(base: Scenario, stations: Station[], name: string, id: string): Scenario {
  const s = clone(base)
  const now = new Date().toISOString()
  s.id = id
  s.name = name
  s.kind = 'custom'
  s.description = 'Ligne réelle importée depuis un fichier. Vérifiez la demande, les horaires et les coûts dans « Ligne de production » et « Mes données ».'
  s.createdAt = s.updatedAt = now
  s.stations = clone(stations)
  s.layoutPoints = []
  s.operatorRoutes = []
  s.actions = []
  s.releasePolicy = 'push'
  // Modèle qualité neutre (sans effet des réglages) tant qu'il n'est pas calé sur des mesures
  s.process.stationId = (stations.find((x) => x.valueAdded) ?? stations[0]).id
  for (const p of s.process.params) {
    p.setpoint = p.reference
    p.noiseSd = 0
  }
  s.process.toolWearPerPart = 0
  return s
}

export interface Calibration {
  mean: number
  sigmaWithin: number
  sigmaOverall: number
  batchSd: number
  subgroupSize: number
}

/**
 * Cale le modèle de la caractéristique critique sur des mesures réelles :
 * moyenne → μ0, σ intra → répétabilité, variance entre sous-groupes → σ lot.
 * Les réglages (T, P, V) sont neutralisés : la simulation reproduit la distribution observée.
 */
export function calibrateProcess(sc: Scenario, ds: Dataset): Calibration {
  const values = ds.values ?? []
  const n = subgroupSizeOf(ds.groups)
  const spec = ds.spec
  const cap = capability(values, { lsl: spec?.lsl, usl: spec?.usl }, n)
  const batchSd = Math.sqrt(Math.max(0, cap.sigmaOverall ** 2 - cap.sigmaWithin ** 2))
  const m = sc.process
  if (spec) {
    m.characteristic.name = spec.name || m.characteristic.name
    m.characteristic.unit = spec.unit || m.characteristic.unit
    if (spec.lsl !== undefined) m.characteristic.lsl = spec.lsl
    if (spec.usl !== undefined) m.characteristic.usl = spec.usl
    m.characteristic.nominal = spec.target ?? (spec.lsl !== undefined && spec.usl !== undefined ? (spec.lsl + spec.usl) / 2 : cap.mean)
  }
  for (const p of m.params) {
    p.setpoint = p.reference
    p.noiseSd = 0
  }
  m.toolWearPerPart = 0
  m.baseMean = cap.mean
  m.residualSd = cap.sigmaWithin
  m.batchSd = batchSd
  return { mean: cap.mean, sigmaWithin: cap.sigmaWithin, sigmaOverall: cap.sigmaOverall, batchSd, subgroupSize: n }
}

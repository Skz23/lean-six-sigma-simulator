/**
 * Estimation du modèle procédé sur données réelles :
 *  - par régression sur un historique de pièces (réglages relevés + caractéristique mesurée) ;
 *  - à partir des effets d'un plan d'expériences 2^k réalisé en atelier.
 * Modèle : Y = μ0 + Σ b_i (x_i − ref_i) + b_TV (T − T_ref)(V − V_ref)/1000 + …
 */
import type { ParamKey, ProcessModel } from './types'
import { linearRegression, type RegressionResult } from '../stats/inference'
import { mean, stdDev } from '../stats/descriptive'
import type { DoeEffect } from '../stats/doe'

export interface ProcessFit {
  baseMean: number
  coefficients: Partial<Record<ParamKey, number>>
  interactionTV?: number
  residualSd?: number
  setpoints?: Partial<Record<ParamKey, number>>
  noiseSd?: Partial<Record<ParamKey, number>>
  reg?: RegressionResult
}

/** Régression multiple Y ~ réglages sur un historique de pièces. */
export function fitFromHistory(m: ProcessModel, cols: { key: ParamKey; values: number[] }[], y: number[]): ProcessFit {
  const n = y.length
  const X = Array.from({ length: n }, (_, i) => cols.map((c) => c.values[i]))
  const reg = linearRegression(X, y, cols.map((c) => m.params.find((p) => p.key === c.key)!.name), m.characteristic.name)
  const coefficients: Partial<Record<ParamKey, number>> = {}
  let mu0 = reg.terms[0].coef
  cols.forEach((c, j) => {
    const b = reg.terms[j + 1].coef
    coefficients[c.key] = b
    mu0 += b * m.params.find((p) => p.key === c.key)!.reference
  })
  return {
    baseMean: mu0,
    coefficients,
    residualSd: reg.s,
    setpoints: Object.fromEntries(cols.map((c) => [c.key, mean(c.values)])),
    noiseSd: Object.fromEntries(cols.map((c) => [c.key, stdDev(c.values)])),
    reg,
  }
}

/**
 * Effets d'un plan 2³ (facteurs dans l'ordre des paramètres du modèle : T, P, V) → coefficients physiques.
 * Effets principaux : b = effet / (haut − bas). Interaction T×V convertie exactement vers la forme
 * (T − T_ref)(V − V_ref)/1000 ; les autres interactions ne sont pas reportées dans le modèle.
 */
export function fitFromDoe(m: ProcessModel, levels: Record<ParamKey, [number, number]>, effects: DoeEffect[], yMean: number): ProcessFit {
  const keys = m.params.map((p) => p.key)
  const coefficients: Partial<Record<ParamKey, number>> = {}
  let mu0 = yMean
  keys.forEach((k, j) => {
    const [lo, hi] = levels[k]
    const b = effects[j].effect / (hi - lo)
    coefficients[k] = b
    mu0 += b * (m.params[j].reference - (lo + hi) / 2)
  })
  // Interaction T×V (colonne « T×V » parmi les interactions d'ordre 2 : T×P, T×V, P×V)
  const iT = keys.indexOf('temperature')
  const iV = keys.indexOf('speed')
  let interactionTV: number | undefined
  const tv = effects.find((e) => e.term === `${m.params[iT].name.split(' ')[0]}×${m.params[iV].name.split(' ')[0]}`)
  if (tv && iT >= 0 && iV >= 0) {
    const [tl, th] = levels.temperature
    const [vl, vh] = levels.speed
    const hT = (th - tl) / 2
    const hV = (vh - vl) / 2
    const k = tv.coef / (hT * hV)
    const dT = m.params[iT].reference - (tl + th) / 2
    const dV = m.params[iV].reference - (vl + vh) / 2
    coefficients.temperature = (coefficients.temperature ?? 0) + k * dV
    coefficients.speed = (coefficients.speed ?? 0) + k * dT
    mu0 += k * dT * dV
    interactionTV = 1000 * k
  }
  return { baseMean: mu0, coefficients, interactionTV }
}

export function applyFit(m: ProcessModel, f: ProcessFit) {
  m.baseMean = f.baseMean
  for (const [k, v] of Object.entries(f.coefficients)) m.coefficients[k as ParamKey] = v as number
  if (f.interactionTV !== undefined) m.interactionTV = f.interactionTV
  if (f.residualSd !== undefined) {
    // Le résidu de la régression contient déjà les décalages entre lots et l'usure : on ne garde que le reste
    const other = m.batchSd ** 2 + (m.toolWearPerPart * 30) ** 2 / 12
    m.residualSd = Math.sqrt(Math.max(f.residualSd ** 2 - other, (f.residualSd * 0.2) ** 2))
  }
  for (const p of m.params) {
    if (f.setpoints?.[p.key] !== undefined) p.setpoint = f.setpoints[p.key]!
    if (f.noiseSd?.[p.key] !== undefined) p.noiseSd = f.noiseSd[p.key]!
  }
}

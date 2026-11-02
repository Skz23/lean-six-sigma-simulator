/**
 * Métriques Six Sigma.
 *  DPU  = défauts / unités
 *  DPO  = défauts / (unités × opportunités)
 *  DPMO = DPO × 10⁶
 *  Niveau sigma (court terme, convention Motorola) = Φ⁻¹(1 − DPO) + 1,5
 *  Le décalage de 1,5σ est une convention empirique (dérive long terme supposée)
 *  et doit être signalé comme telle ; le Z long terme est aussi fourni.
 */
import { normalCdf, normalInv } from './distributions'

export interface SigmaMetrics {
  dpu: number
  dpo: number
  dpmo: number
  yield: number
  zLongTerm: number
  sigmaLevel: number
}

export function sigmaMetrics(defects: number, units: number, opportunities = 1): SigmaMetrics {
  const dpo = units > 0 ? defects / (units * opportunities) : 0
  const p = Math.min(Math.max(dpo, 1e-12), 1 - 1e-12)
  const zLT = normalInv(1 - p)
  return {
    dpu: units > 0 ? defects / units : 0,
    dpo,
    dpmo: dpo * 1e6,
    yield: 1 - dpo,
    zLongTerm: zLT,
    sigmaLevel: zLT + 1.5,
  }
}

export function dpmoToSigma(dpmo: number, shift = 1.5): number {
  const p = Math.min(Math.max(dpmo / 1e6, 1e-12), 1 - 1e-12)
  return normalInv(1 - p) + shift
}

export function sigmaToDpmo(sigma: number, shift = 1.5): number {
  return (1 - normalCdf(sigma - shift)) * 1e6
}

/** Rendement cumulé (Rolled Throughput Yield) = Π rendements de chaque étape. */
export function rolledThroughputYield(yields: number[]): number {
  return yields.reduce((a, b) => a * b, 1)
}

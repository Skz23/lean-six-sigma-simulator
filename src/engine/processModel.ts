/**
 * Modèle procédé de la caractéristique critique (CTQ).
 * Voir docs/HYPOTHESES.md §3 pour la justification du modèle.
 */
import type { ParamKey, ProcessModel } from './types'
import { Rng } from './random'
import { normalCdf } from '../stats/distributions'

export type Setpoints = Record<ParamKey, number>

export function setpointsOf(model: ProcessModel): Setpoints {
  const s = {} as Setpoints
  for (const p of model.params) s[p.key] = p.setpoint
  return s
}

function ref(model: ProcessModel, key: ParamKey): number {
  return model.params.find((p) => p.key === key)!.reference
}

/** Moyenne conditionnelle de Y pour des valeurs réelles des paramètres (sans bruit). */
export function deterministicY(model: ProcessModel, x: Setpoints): number {
  let y = model.baseMean
  for (const p of model.params) y += model.coefficients[p.key] * (x[p.key] - p.reference)
  y += (model.interactionTV * (x.temperature - ref(model, 'temperature')) * (x.speed - ref(model, 'speed'))) / 1000
  return y
}

/** Écart-type de répétabilité machine, fonction de la vitesse. */
export function residualSdAt(model: ProcessModel, speed: number): number {
  return model.residualSd * Math.pow(Math.max(speed, 1) / ref(model, 'speed'), model.speedVarianceExponent)
}

/** Facteur multiplicatif appliqué au temps de cycle du poste qualité : V_ref / V. */
export function cycleTimeFactor(model: ProcessModel, speed: number): number {
  return ref(model, 'speed') / Math.max(speed, 1)
}

/** Tire les valeurs réelles des paramètres autour des consignes. */
export function sampleParams(model: ProcessModel, rng: Rng, setpoints?: Setpoints): Setpoints {
  const sp = setpoints ?? setpointsOf(model)
  const x = {} as Setpoints
  for (const p of model.params) x[p.key] = rng.normal(sp[p.key], p.noiseSd)
  return x
}

/** Génère une valeur mesurée de la caractéristique. */
export function sampleY(model: ProcessModel, x: Setpoints, batchOffset: number, partsSinceChangeover: number, rng: Rng): number {
  return deterministicY(model, x) + batchOffset + model.toolWearPerPart * partsSinceChangeover + rng.normal(0, residualSdAt(model, x.speed))
}

export interface Prediction {
  mean: number
  sdWithin: number
  sdOverall: number
  cp: number
  cpk: number
  pp: number
  ppk: number
  ppm: number
  contributions: { source: string; variance: number }[]
}

/**
 * Prédiction analytique (méthode delta, linéarisation au premier ordre) de la
 * distribution de Y pour un jeu de consignes et une taille de lot.
 * Variance totale = Σ (∂Y/∂xᵢ)²σᵢ² + σ_e² + σ_lot² + (usure·B)²/12.
 */
export function predict(model: ProcessModel, sp: Setpoints, batchSize: number): Prediction {
  const tRef = ref(model, 'temperature')
  const vRef = ref(model, 'speed')
  const grad: Setpoints = {
    temperature: model.coefficients.temperature + (model.interactionTV * (sp.speed - vRef)) / 1000,
    pressure: model.coefficients.pressure,
    speed: model.coefficients.speed + (model.interactionTV * (sp.temperature - tRef)) / 1000,
  }
  const contributions: { source: string; variance: number }[] = model.params.map((p) => ({
    source: `${p.name} (régulation ±${p.noiseSd} ${p.unit})`,
    variance: (grad[p.key] * p.noiseSd) ** 2,
  }))
  const se = residualSdAt(model, sp.speed)
  contributions.push({ source: 'Répétabilité machine', variance: se * se })
  const wearRange = model.toolWearPerPart * batchSize
  contributions.push({ source: 'Usure outil (dans le lot)', variance: (wearRange * wearRange) / 12 })
  contributions.push({ source: 'Décalage entre lots (réglages)', variance: model.batchSd ** 2 })
  const mean = deterministicY(model, sp) + wearRange / 2
  const varWithin = contributions.slice(0, model.params.length + 1).reduce((s, c) => s + c.variance, 0)
  const varOverall = contributions.reduce((s, c) => s + c.variance, 0)
  const { lsl, usl } = model.characteristic
  const sw = Math.sqrt(varWithin)
  const so = Math.sqrt(varOverall)
  const ppm = (normalCdf((lsl - mean) / so) + 1 - normalCdf((usl - mean) / so)) * 1e6
  return {
    mean,
    sdWithin: sw,
    sdOverall: so,
    cp: (usl - lsl) / (6 * sw),
    cpk: Math.min(usl - mean, mean - lsl) / (3 * sw),
    pp: (usl - lsl) / (6 * so),
    ppk: Math.min(usl - mean, mean - lsl) / (3 * so),
    ppm,
    contributions,
  }
}

/**
 * Produit `n` pièces avec des consignes données (utilisé par le DOE et les essais
 * « what-if ») en respectant la structure en lots du procédé.
 */
export function samplePart(model: ProcessModel, sp: Setpoints, n: number, batchSize: number, seed: number) {
  const rng = new Rng(seed)
  const out: { x: Setpoints; y: number }[] = []
  let offset = rng.normal(0, model.batchSd)
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % batchSize === 0) offset = rng.normal(0, model.batchSd)
    const x = sampleParams(model, rng, sp)
    out.push({ x, y: sampleY(model, x, offset, i % batchSize, rng) })
  }
  return out
}

/**
 * Capabilité et performance des procédés.
 *
 *  Court terme (capabilité, « within ») : σ_within estimé à partir de la
 *  variation intra-sous-groupe (R̄/d2 si n ≥ 2, MR̄/1,128 si n = 1).
 *    Cp  = (USL − LSL) / 6σ_within
 *    Cpk = min(USL − μ, μ − LSL) / 3σ_within
 *
 *  Long terme (performance, « overall ») : σ_overall = écart-type de
 *  l'ensemble des données (n − 1), qui inclut les dérives entre sous-groupes.
 *    Pp  = (USL − LSL) / 6σ_overall
 *    Ppk = min(USL − μ, μ − LSL) / 3σ_overall
 */
import { normalCdf, normalInv } from './distributions'
import { mean, stdDev, subgroups } from './descriptive'
import { d2 } from './spc'

export interface Spec {
  lsl?: number
  usl?: number
  target?: number
}

export interface CapabilityResult {
  n: number
  mean: number
  sigmaWithin: number
  sigmaOverall: number
  variance: number
  cp?: number
  cpl?: number
  cpu?: number
  cpk?: number
  pp?: number
  ppl?: number
  ppu?: number
  ppk?: number
  /** PPM observés (comptage réel des valeurs hors tolérance). */
  ppmObserved: number
  /** PPM attendus sous hypothèse normale, court terme. */
  ppmWithin: number
  /** PPM attendus sous hypothèse normale, long terme. */
  ppmOverall: number
  /** Z.bench long terme (= Φ⁻¹(1 − p_overall)). */
  zBenchOverall: number
  /** Z.bench court terme. */
  zBenchWithin: number
  /** Niveau sigma « court terme » selon la convention Motorola (Z.bench LT + 1,5). */
  sigmaLevel: number
  subgroupSize: number
}

/** σ within à partir des sous-groupes rationnels. */
export function sigmaWithin(xs: number[], subgroupSize: number): number {
  if (subgroupSize <= 1) {
    const mr = xs.slice(1).map((x, i) => Math.abs(x - xs[i]))
    return mean(mr) / 1.128
  }
  const groups = subgroups(xs, subgroupSize)
  const rbar = mean(groups.map((g) => Math.max(...g) - Math.min(...g)))
  return rbar / d2(subgroupSize)
}

function tailProb(mu: number, sigma: number, spec: Spec): number {
  let p = 0
  if (spec.usl !== undefined) p += 1 - normalCdf((spec.usl - mu) / sigma)
  if (spec.lsl !== undefined) p += normalCdf((spec.lsl - mu) / sigma)
  return p
}

export function capability(xs: number[], spec: Spec, subgroupSize = 5): CapabilityResult {
  const n = xs.length
  const mu = mean(xs)
  const sw = sigmaWithin(xs, subgroupSize)
  const so = stdDev(xs)
  const r: CapabilityResult = {
    n,
    mean: mu,
    sigmaWithin: sw,
    sigmaOverall: so,
    variance: so * so,
    ppmObserved: 0,
    ppmWithin: 0,
    ppmOverall: 0,
    zBenchOverall: NaN,
    zBenchWithin: NaN,
    sigmaLevel: NaN,
    subgroupSize,
  }
  const { lsl, usl } = spec
  if (usl !== undefined) {
    r.cpu = (usl - mu) / (3 * sw)
    r.ppu = (usl - mu) / (3 * so)
  }
  if (lsl !== undefined) {
    r.cpl = (mu - lsl) / (3 * sw)
    r.ppl = (mu - lsl) / (3 * so)
  }
  if (usl !== undefined && lsl !== undefined) {
    r.cp = (usl - lsl) / (6 * sw)
    r.pp = (usl - lsl) / (6 * so)
  }
  const cands = [r.cpu, r.cpl].filter((v): v is number => v !== undefined)
  if (cands.length) r.cpk = Math.min(...cands)
  const pcands = [r.ppu, r.ppl].filter((v): v is number => v !== undefined)
  if (pcands.length) r.ppk = Math.min(...pcands)

  const out = xs.filter((x) => (usl !== undefined && x > usl) || (lsl !== undefined && x < lsl)).length
  r.ppmObserved = (out / n) * 1e6
  const pw = tailProb(mu, sw, spec)
  const po = tailProb(mu, so, spec)
  r.ppmWithin = pw * 1e6
  r.ppmOverall = po * 1e6
  r.zBenchWithin = normalInv(1 - Math.max(pw, 1e-15))
  r.zBenchOverall = normalInv(1 - Math.max(po, 1e-15))
  r.sigmaLevel = r.zBenchOverall + 1.5
  return r
}

export type Verdict = 'excellent' | 'capable' | 'limite' | 'non-capable'

/** Classement usuel : ≥ 1,67 excellent ; ≥ 1,33 capable ; ≥ 1 limite ; sinon non capable. */
export function verdict(index: number | undefined): Verdict {
  if (index === undefined || Number.isNaN(index)) return 'non-capable'
  if (index >= 1.67) return 'excellent'
  if (index >= 1.33) return 'capable'
  if (index >= 1) return 'limite'
  return 'non-capable'
}

/** Interprétation pédagogique automatique. */
export function interpretCapability(r: CapabilityResult, spec: Spec): string[] {
  const msgs: string[] = []
  const f = (v?: number) => (v === undefined ? '—' : v.toFixed(2))
  if (r.cpk !== undefined) {
    const v = verdict(r.cpk)
    const txt: Record<Verdict, string> = {
      excellent: 'Le procédé est très capable à court terme (Cpk ≥ 1,67).',
      capable: 'Le procédé est capable à court terme (1,33 ≤ Cpk < 1,67).',
      limite: 'Le procédé est juste capable (1 ≤ Cpk < 1,33) : la moindre dérive produira des non-conformes.',
      'non-capable': 'Le procédé n\'est pas capable (Cpk < 1) : il produit structurellement des pièces hors tolérance.',
    }
    msgs.push(txt[v])
  }
  if (r.cp !== undefined && r.cpk !== undefined) {
    const ratio = r.cpk / r.cp
    if (ratio < 0.85)
      msgs.push(
        `Cpk (${f(r.cpk)}) est nettement inférieur à Cp (${f(r.cp)}) : le procédé est décentré. Recentrer la moyenne sur la cible ${spec.target ?? ((spec.lsl! + spec.usl!) / 2).toFixed(3)} est le levier le plus rapide.`,
      )
    else msgs.push(`Cpk ≈ Cp : le procédé est bien centré ; l'amélioration passe par la réduction de la dispersion.`)
  }
  if (r.cpk !== undefined && r.ppk !== undefined) {
    const gap = r.cpk - r.ppk
    if (gap > 0.2)
      msgs.push(
        `Ppk (${f(r.ppk)}) < Cpk (${f(r.cpk)}) : la variation entre sous-groupes (dérives, changements de lot, usure outil) dégrade la performance long terme. Le procédé n'est probablement pas sous contrôle statistique — vérifier les cartes de contrôle.`,
      )
    else msgs.push('Ppk proche de Cpk : peu de variation entre sous-groupes, le procédé semble stable dans le temps.')
  }
  msgs.push(
    `PPM observés : ${Math.round(r.ppmObserved)} ; PPM attendus (loi normale, long terme) : ${Math.round(r.ppmOverall)}. Niveau sigma (convention +1,5σ) : ${r.sigmaLevel.toFixed(2)}.`,
  )
  return msgs
}

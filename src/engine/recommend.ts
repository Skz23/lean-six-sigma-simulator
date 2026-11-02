/**
 * Moteur de recommandations : propose des actions d'amélioration adaptées au scénario,
 * puis CHIFFRE chacune en la simulant (mêmes graines que la référence, plusieurs journées).
 * Aucune estimation forfaitaire : le gain affiché est la différence simulée.
 */
import type { Scenario } from './types'
import { replicate } from './simulation'
import { computeKpis, type Kpis } from './kpi'
import { predict, setpointsOf } from './processModel'
import { deriveSeed } from './random'
import { mean } from '../stats/descriptive'

export interface Candidate {
  id: string
  title: string
  approach: 'lean' | 'sixsigma'
  tool: string
  /** Pourquoi cette action est proposée (constat chiffré). */
  rationale: string
  /** Ce qui est modifié dans la simulation. */
  change: string
  /** Investissement indicatif (€), modifiable par l'utilisateur. */
  investment: number
  apply: (s: Scenario) => void
}

export interface Evaluated extends Candidate {
  dMargin: number
  dGood: number
  dLeadTime: number
  dScrapRate: number
  dWip: number
  dOee: number
  annualGain: number
  paybackMonths: number
  verdict: 'recommandée' | 'à étudier' | 'sans effet' | 'défavorable'
}

export interface Summary {
  margin: number
  good: number
  leadTime: number
  scrapRate: number
  wip: number
  oee: number
  cpk: number
}

export function summarize(ks: Kpis[]): Summary {
  return {
    margin: mean(ks.map((k) => k.costs.margin)),
    good: mean(ks.map((k) => k.good)),
    leadTime: mean(ks.map((k) => k.leadTime)),
    scrapRate: mean(ks.map((k) => 1 - k.yield)),
    wip: mean(ks.map((k) => k.wipAvg)),
    oee: mean(ks.map((k) => k.oee)),
    cpk: mean(ks.map((k) => k.dimension?.cpk ?? NaN).filter(Number.isFinite)),
  }
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

/** Génère les actions pertinentes à partir du diagnostic de la journée simulée. */
export function candidates(sc: Scenario, k: Kpis, bottleneckIndex: number): Candidate[] {
  const out: Candidate[] = []
  const bn = sc.stations[bottleneckIndex]
  const bIdx = bottleneckIndex
  const takt = k.taktTime

  if (bn.changeoverTime >= 5) {
    out.push({
      id: 'smed-bn',
      title: `SMED sur le goulot « ${bn.name} »`,
      approach: 'lean',
      tool: 'SMED',
      rationale: `Le goulot perd ${bn.changeoverTime} min à chaque changement de série, soit ${Math.round((bn.changeoverTime * 60) / sc.batchSize)} s par pièce avec des lots de ${sc.batchSize}.`,
      change: `Changement de série ${bn.changeoverTime} → ${Math.round(bn.changeoverTime * 0.5)} min (−50 %, objectif courant d'un premier chantier SMED).`,
      investment: 8000,
      apply: (s) => {
        s.stations[bIdx].changeoverTime = Math.round(bn.changeoverTime * 0.5 * 10) / 10
      },
    })
    if (sc.batchSize >= 40)
      out.push({
        id: 'smed-batch',
        title: 'SMED généralisé + lots réduits de moitié',
        approach: 'lean',
        tool: 'SMED / lot',
        rationale: `Des lots de ${sc.batchSize} pièces gonflent les encours ; réduire les lots n'est rentable que si les changements de série sont raccourcis.`,
        change: `Tous les changements de série −50 % et taille de lot ${sc.batchSize} → ${Math.round(sc.batchSize / 2)}.`,
        investment: 20000,
        apply: (s) => {
          s.stations.forEach((x) => (x.changeoverTime = Math.round(x.changeoverTime * 0.5 * 10) / 10))
          s.batchSize = Math.max(1, Math.round(sc.batchSize / 2))
        },
      })
  }
  if (bn.availability < 0.97) {
    const target = Math.min(0.98, bn.availability + 0.04)
    out.push({
      id: 'tpm-bn',
      title: `TPM sur le goulot « ${bn.name} »`,
      approach: 'lean',
      tool: 'TPM',
      rationale: `Disponibilité du goulot ${Math.round(bn.availability * 100)} % : chaque heure de panne au goulot est une heure perdue pour toute la ligne.`,
      change: `Disponibilité ${Math.round(bn.availability * 100)} % → ${Math.round(target * 100)} % (maintenance autonome et préventive).`,
      investment: 10000,
      apply: (s) => {
        s.stations[bIdx].availability = target
      },
    })
  }
  const eff = sc.stations.map((x) => x.cycleTime / x.capacity)
  const minIdx = eff.indexOf(Math.min(...eff))
  if (minIdx !== bIdx && eff[minIdx] < 0.75 * takt && bn.capacity === 1) {
    const moved = Math.round(bn.cycleTime * 0.1 * 10) / 10
    out.push({
      id: 'balance',
      title: `Rééquilibrer « ${bn.name} » vers « ${sc.stations[minIdx].name} »`,
      approach: 'lean',
      tool: 'Équilibrage (Yamazumi)',
      rationale: `« ${sc.stations[minIdx].name} » est chargé à ${Math.round((eff[minIdx] / takt) * 100)} % du takt alors que le goulot est saturé.`,
      change: `Transfert de ${moved} s de travail du goulot vers le poste le moins chargé.`,
      investment: 3000,
      apply: (s) => {
        s.stations[bIdx].cycleTime = Math.round((bn.cycleTime - moved) * 10) / 10
        s.stations[minIdx].cycleTime = Math.round((s.stations[minIdx].cycleTime + moved) * 10) / 10
      },
    })
  }
  if (k.good < sc.demand && bn.capacity < 3)
    out.push({
      id: 'capacity',
      title: `Ajouter une machine au goulot « ${bn.name} »`,
      approach: 'lean',
      tool: 'Capacité',
      rationale: `La ligne livre ${Math.round(k.good)} pièces pour une demande de ${sc.demand} : le goulot est saturé.`,
      change: `Capacité ${bn.capacity} → ${bn.capacity + 1} machine(s) en parallèle (investissement lourd, à comparer aux actions légères).`,
      investment: 120000,
      apply: (s) => {
        s.stations[bIdx].capacity = bn.capacity + 1
      },
    })
  if (sc.releasePolicy === 'push') {
    const fg = Math.max(10, Math.round(sc.demand * 0.1))
    out.push({
      id: 'kanban',
      title: 'Passer en flux tiré (kanban)',
      approach: 'lean',
      tool: 'Kanban',
      rationale: `Flux poussé : ${Math.round(k.wipAvg)} pièces en cours en moyenne, Lead Time ${Math.round(k.leadTime / 60)} min.`,
      change: `Stocks entre postes plafonnés à 10 pièces (20 avant le goulot), supermarché produits finis de ${fg} pièces.`,
      investment: 6000,
      apply: (s) => {
        s.releasePolicy = 'pull'
        s.finishedGoodsCap = fg
        s.stations.forEach((x, i) => {
          if (i < s.stations.length - 1) x.bufferCapacity = i === bIdx - 1 ? 20 : Math.min(x.bufferCapacity, 10)
        })
      },
    })
  }
  const totalDist = sc.stations.reduce((a, x) => a + x.distanceToNext, 0)
  if (totalDist > 60)
    out.push({
      id: 'layout',
      title: 'Réimplantation en ligne / en U',
      approach: 'lean',
      tool: 'Implantation',
      rationale: `Une pièce parcourt ${Math.round(totalDist)} m entre les postes.`,
      change: 'Distances entre postes divisées par 2.',
      investment: 25000,
      apply: (s) => s.stations.forEach((x) => (x.distanceToNext = Math.round(x.distanceToNext / 2))),
    })
  // Qualité : poste le plus générateur de défauts
  const worst = sc.stations.map((x, i) => ({ x, i })).sort((a, b) => b.x.defectRate - a.x.defectRate)[0]
  if (worst && worst.x.defectRate >= 0.005)
    out.push({
      id: 'pokayoke',
      title: `Poka-yoke / standard au poste « ${worst.x.name} »`,
      approach: 'sixsigma',
      tool: 'Poka-yoke / AMDEC',
      rationale: `Taux de défauts du poste : ${(worst.x.defectRate * 100).toFixed(1)} % (le plus élevé de la ligne).`,
      change: `Taux de défauts ${(worst.x.defectRate * 100).toFixed(1)} % → ${(worst.x.defectRate * 50).toFixed(1)} % (−50 %).`,
      investment: 5000,
      apply: (s) => {
        s.stations[worst.i].defectRate = worst.x.defectRate * 0.5
      },
    })
  // Qualité : caractéristique critique
  const m = sc.process
  const sp = setpointsOf(m)
  const pr = predict(m, sp, sc.batchSize)
  const c = m.characteristic
  const tol = c.usl - c.lsl
  const offset = pr.mean - c.nominal
  if (Math.abs(offset) > 0.05 * tol) {
    const T = m.params.find((p) => p.key === 'temperature')
    const gradT = m.coefficients.temperature + (m.interactionTV * (sp.speed - (m.params.find((p) => p.key === 'speed')?.reference ?? sp.speed))) / 1000
    const usesT = T && Math.abs(gradT) > 1e-12 && T.noiseSd + Math.abs(T.setpoint - T.reference) > 0
    out.push({
      id: 'recenter',
      title: `Recentrer « ${c.name} » sur la cible`,
      approach: 'sixsigma',
      tool: 'DOE / réglage',
      rationale: `Moyenne prédite ${pr.mean.toFixed(4)} ${c.unit} pour une cible ${c.nominal} : décalage de ${((offset / tol) * 100).toFixed(0)} % de la tolérance (Cpk ${pr.cpk.toFixed(2)} contre Cp ${pr.cp.toFixed(2)}).`,
      change: usesT ? `Consigne de température ajustée pour annuler le décalage.` : `Moyenne du procédé décalée de ${(-offset).toFixed(4)} ${c.unit} (réglage / correcteur).`,
      investment: 2000,
      apply: (s) => {
        const mm = s.process
        if (usesT) {
          const t = mm.params.find((p) => p.key === 'temperature')!
          t.setpoint = Math.min(t.max, Math.max(t.min, t.setpoint - offset / gradT))
        } else mm.baseMean -= offset
      },
    })
  }
  if (pr.cp < 1.67 && pr.contributions.length) {
    const top = [...pr.contributions].sort((a, b) => b.variance - a.variance)[0]
    const share = top.variance / pr.sdOverall ** 2
    if (share > 0.15) {
      const key = top.source
      out.push({
        id: 'variance',
        title: `Réduire la principale source de dispersion : ${key.split(' (')[0]}`,
        approach: 'sixsigma',
        tool: 'Analyse de variance / maîtrise',
        rationale: `Cette source représente ${Math.round(share * 100)} % de la variance de « ${c.name} » (Cp prédit ${pr.cp.toFixed(2)}).`,
        change: 'Écart-type de cette source divisé par 2.',
        investment: 12000,
        apply: (s) => {
          const mm = s.process
          const p = mm.params.find((x) => key.startsWith(x.name))
          if (p) p.noiseSd /= 2
          else if (key.startsWith('Répétabilité')) mm.residualSd /= 2
          else if (key.startsWith('Usure')) mm.toolWearPerPart /= 2
          else if (key.startsWith('Décalage')) mm.batchSd /= 2
        },
      })
    }
  }
  // Effectif : opérateurs peu utilisés
  sc.stations.forEach((x, i) => {
    if (x.operators >= 2 && k.operatorUtilization < 0.75)
      out.push({
        id: `staff-${i}`,
        title: `Redéployer un opérateur de « ${x.name} »`,
        approach: 'lean',
        tool: 'Polyvalence',
        rationale: `${x.operators} opérateurs sur ce poste et taux d'utilisation global de ${Math.round(k.operatorUtilization * 100)} %.`,
        change: `Opérateurs ${x.operators} → ${x.operators - 1} ; le temps de cycle manuel augmente en proportion.`,
        investment: 1000,
        apply: (s) => {
          s.stations[i].cycleTime = Math.round(((x.cycleTime * x.operators) / (x.operators - 1)) * 10) / 10
          s.stations[i].operators = x.operators - 1
        },
      })
  })
  return out
}

/** Simulation de n journées avec des graines déterministes (nombres aléatoires communs). */
export function runDays(sc: Scenario, days: number): Kpis[] {
  const base = { ...sc, seed: deriveSeed(sc.seed, 'reco') }
  return replicate(base, days).map((r) => computeKpis(base, r))
}

export function evaluate(sc: Scenario, cand: Candidate, base: Summary, days: number): Evaluated {
  const s = clone(sc)
  cand.apply(s)
  const after = summarize(runDays(s, days))
  const dMargin = after.margin - base.margin
  const annualGain = dMargin * sc.costs.workingDaysPerYear
  const dLead = after.leadTime - base.leadTime
  const verdict: Evaluated['verdict'] =
    dMargin > 20 && annualGain > cand.investment * 0.5
      ? 'recommandée'
      : dMargin > 5 || dLead < -0.1 * base.leadTime || after.scrapRate < base.scrapRate * 0.8
        ? 'à étudier'
        : dMargin < -20
          ? 'défavorable'
          : 'sans effet'
  return {
    ...cand,
    dMargin,
    dGood: after.good - base.good,
    dLeadTime: dLead,
    dScrapRate: after.scrapRate - base.scrapRate,
    dWip: after.wip - base.wip,
    dOee: after.oee - base.oee,
    annualGain,
    paybackMonths: annualGain > 0 ? (cand.investment / annualGain) * 12 : Infinity,
    verdict,
  }
}

/** Applique successivement plusieurs actions (plan combiné). */
export function applyAll(sc: Scenario, list: Candidate[]): Scenario {
  const s = clone(sc)
  for (const c of list) c.apply(s)
  return s
}

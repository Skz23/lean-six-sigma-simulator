/**
 * Diagnostic automatique de données réelles (sans simulation) : capabilité, stabilité,
 * normalité, Pareto, AMDEC. Chaque constat est accompagné d'une action recommandée chiffrée
 * à partir des données elles-mêmes.
 */
import type { Dataset } from '../data/import'
import { subgroupSizeOf } from '../data/realScenario'
import { capability } from '../stats/capability'
import { andersonDarling } from '../stats/inference'
import { imrChart, xbarRChart } from '../stats/spc'
import { subgroups } from '../stats/descriptive'
import type { FmeaRow } from '../store/types'

export interface Finding {
  severity: 'critique' | 'important' | 'info'
  title: string
  detail: string
  action: string
  tool: string
  link: string
}

const f = (v: number, d = 3) => v.toLocaleString('fr-FR', { maximumFractionDigits: d })

export function diagnoseMeasures(ds: Dataset): Finding[] {
  const xs = ds.values ?? []
  const out: Finding[] = []
  if (xs.length < 10) return [{ severity: 'info', title: `${ds.name} : trop peu de données`, detail: `${xs.length} valeurs.`, action: 'Collecter au moins 30 valeurs (idéalement 25 sous-groupes de 5) avant de conclure.', tool: 'Collecte', link: '/data' }]
  const spec = ds.spec
  const n = subgroupSizeOf(ds.groups)
  const unit = spec?.unit ?? ''
  // Stabilité
  const groups = n > 1 ? subgroups(xs, n) : []
  const chart = n > 1 && groups.length >= 5 ? xbarRChart(groups, [1, 2, 3, 5]) : imrChart(xs, [1, 2, 3, 5])
  const sig = chart.primary.signals
  if (sig.length) {
    const r1 = sig.filter((s) => s.rule === 1).length
    out.push({
      severity: r1 ? 'critique' : 'important',
      title: `${ds.name} : procédé instable (${sig.length} signal(s) sur la carte de contrôle)`,
      detail: `${r1} point(s) hors limites de contrôle, ${sig.length - r1} signal(s) de dérive (tendances, séries d'un même côté). Des causes spéciales agissent sur le procédé.`,
      action: 'Identifier ce qui s\'est passé aux instants signalés (changement de lot, d\'outil, d\'opérateur, de matière…), traiter la cause, puis mettre la carte de contrôle au poste.',
      tool: 'SPC',
      link: '/sixsigma/spc',
    })
  }
  if (!spec || (spec.lsl === undefined && spec.usl === undefined)) {
    out.push({ severity: 'info', title: `${ds.name} : pas de tolérance renseignée`, detail: 'Sans LSL / USL, la capabilité ne peut pas être calculée.', action: 'Saisir les limites de spécification dans « Mes données ».', tool: 'Spécification', link: '/data' })
    return out
  }
  const cap = capability(xs, { lsl: spec.lsl, usl: spec.usl, target: spec.target }, n)
  const target = spec.target ?? (spec.lsl !== undefined && spec.usl !== undefined ? (spec.lsl + spec.usl) / 2 : cap.mean)
  const ad = andersonDarling(xs)
  if (cap.ppmObserved > 0)
    out.push({
      severity: 'critique',
      title: `${ds.name} : ${f(cap.ppmObserved / 1e4, 2)} % de valeurs hors tolérance`,
      detail: `${Math.round((cap.ppmObserved * xs.length) / 1e6)} valeur(s) sur ${xs.length} en dehors de [${spec.lsl ?? '−∞'} ; ${spec.usl ?? '+∞'}] ${unit}.`,
      action: 'Mettre en place un tri / contrôle renforcé immédiat (confinement) pendant la résolution des causes.',
      tool: 'Confinement',
      link: '/sixsigma/defects',
    })
  if (cap.cpk !== undefined && cap.cpk < 1.33) {
    const offset = cap.mean - target
    const centeredCpk = cap.cp ?? (cap.cpk + Math.abs(offset) / (3 * cap.sigmaWithin))
    if (cap.cp !== undefined && cap.cp >= 1.33 && cap.cpk < 0.85 * cap.cp)
      out.push({
        severity: 'important',
        title: `${ds.name} : procédé décentré (Cpk ${f(cap.cpk, 2)} pour Cp ${f(cap.cp, 2)})`,
        detail: `La moyenne (${f(cap.mean, 4)} ${unit}) est décalée de ${f(offset, 4)} ${unit} par rapport à la cible ${f(target, 4)}. La dispersion, elle, est suffisante.`,
        action: `Recentrer le réglage de ${f(-offset, 4)} ${unit} : le Cpk passerait d'environ ${f(cap.cpk, 2)} à ${f(centeredCpk, 2)}. Action rapide et peu coûteuse ; un plan d'expériences permet de trouver le bon réglage.`,
        tool: 'Réglage / DOE',
        link: '/sixsigma/stats',
      })
    else {
      const neededSigma = spec.lsl !== undefined && spec.usl !== undefined ? (spec.usl - spec.lsl) / 8 : NaN
      out.push({
        severity: 'important',
        title: `${ds.name} : dispersion trop forte (Cp ${f(cap.cp ?? NaN, 2)}, Cpk ${f(cap.cpk, 2)})`,
        detail: `σ intra = ${f(cap.sigmaWithin, 5)} ${unit}. Même parfaitement centré, le procédé ne serait pas capable.`,
        action: Number.isFinite(neededSigma)
          ? `Réduire l'écart-type d'environ ${f((1 - neededSigma / cap.sigmaWithin) * 100, 0)} % (objectif σ ≤ ${f(neededSigma, 5)} ${unit}, soit Cp = 1,33). Rechercher les sources de variation : Ishikawa, corrélations avec les paramètres, ANOVA par lot ou machine.`
          : 'Réduire la dispersion : rechercher les sources de variation (Ishikawa, ANOVA).',
        tool: 'Projet DMAIC',
        link: '/sixsigma/dmaic',
      })
    }
  } else if (cap.cpk !== undefined)
    out.push({ severity: 'info', title: `${ds.name} : procédé capable (Cpk ${f(cap.cpk, 2)})`, detail: `Ppk ${f(cap.ppk ?? NaN, 2)}.`, action: 'Maintenir : carte de contrôle au poste et plan de contrôle ; envisager d\'alléger le contrôle final.', tool: 'Plan de contrôle', link: '/sixsigma/spc' })
  if (cap.cpk !== undefined && cap.ppk !== undefined && cap.cpk - cap.ppk > 0.2)
    out.push({
      severity: 'important',
      title: `${ds.name} : forte variation entre sous-groupes (Ppk ${f(cap.ppk, 2)} < Cpk ${f(cap.cpk, 2)})`,
      detail: 'La performance à long terme est dégradée par des écarts entre lots, équipes ou périodes.',
      action: 'Standardiser le réglage au démarrage de chaque lot (fiche de réglage, première pièce mesurée), comparer les lots par ANOVA.',
      tool: 'Standardisation',
      link: '/sixsigma/stats',
    })
  if (!ad.normal)
    out.push({ severity: 'info', title: `${ds.name} : distribution non normale`, detail: `Test d'Anderson-Darling : p = ${f(ad.pValue, 4)}.`, action: 'Se fier aux PPM observés plutôt qu\'aux PPM « attendus » ; vérifier un mélange de populations (deux machines, deux lots).', tool: 'Distributions', link: '/sixsigma/stats' })
  return out
}

export function diagnoseDefects(ds: Dataset): Finding[] {
  const list = ds.defects ?? []
  if (!list.length) return []
  const by = new Map<string, { count: number; cost: number; stations: Set<string> }>()
  for (const d of list) {
    const e = by.get(d.category) ?? { count: 0, cost: 0, stations: new Set<string>() }
    e.count += d.count
    e.cost += d.count * d.cost
    if (d.station) e.stations.add(d.station)
    by.set(d.category, e)
  }
  const total = [...by.values()].reduce((a, x) => a + x.count, 0)
  const totalCost = [...by.values()].reduce((a, x) => a + x.cost, 0)
  const sorted = [...by.entries()].sort((a, b) => b[1].count - a[1].count)
  let cum = 0
  const vital = sorted.filter(([, v]) => {
    const before = cum
    cum += v.count
    return before / total < 0.8
  })
  const out: Finding[] = [
    {
      severity: 'important',
      title: `${ds.name} : ${vital.length} catégorie(s) représentent 80 % des défauts`,
      detail: vital.map(([k, v]) => `${k} (${Math.round((v.count / total) * 100)} %${v.stations.size ? `, ${[...v.stations].join(', ')}` : ''})`).join(' · '),
      action: `Lancer en priorité une analyse des causes (5 Pourquoi, Ishikawa) sur « ${vital[0][0]} ».`,
      tool: 'Pareto / 5 Pourquoi',
      link: '/sixsigma/defects',
    },
  ]
  if (totalCost > 0) {
    const byCost = [...by.entries()].sort((a, b) => b[1].cost - a[1].cost)[0]
    if (byCost[0] !== sorted[0][0])
      out.push({
        severity: 'info',
        title: `${ds.name} : le défaut le plus coûteux n'est pas le plus fréquent`,
        detail: `« ${byCost[0]} » pèse ${Math.round((byCost[1].cost / totalCost) * 100)} % du coût total des défauts.`,
        action: 'Faire aussi un Pareto en coût pour arbitrer les priorités.',
        tool: 'Pareto en coût',
        link: '/sixsigma/defects',
      })
  }
  return out
}

export function diagnoseFmea(rows: FmeaRow[], threshold = 100): Finding[] {
  const crit = rows.filter((r) => r.s * r.o * r.d >= threshold && (r.s2 === null || r.o2 === null || r.d2 === null))
  if (!crit.length) return []
  return [
    {
      severity: 'important',
      title: `AMDEC : ${crit.length} mode(s) de défaillance critiques sans action soldée`,
      detail: crit.map((r) => `${r.failureMode} (NPR ${r.s * r.o * r.d})`).join(' · '),
      action: 'Mettre en œuvre les actions prévues et réévaluer S, O, D ; viser NPR < seuil.',
      tool: 'AMDEC',
      link: '/sixsigma/defects',
    },
  ]
}

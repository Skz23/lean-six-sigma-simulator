/**
 * Détection et quantification des 8 gaspillages (Muda) à partir des données de simulation.
 * Chaque gaspillage est évalué par des règles explicites (seuils documentés)
 * et son coût journalier est estimé avec les paramètres économiques du scénario.
 */
import type { Scenario, SimResults } from '../engine/types'
import type { Kpis } from '../engine/kpi'
import { spaghettiAnalysis } from './tools'

export interface Muda {
  key: string
  index: number
  name: string
  icon: string
  severity: 'faible' | 'modéré' | 'élevé'
  score: number
  metrics: { label: string; value: string }[]
  dailyCost: number
  causes: string[]
  improvements: string[]
  potentialGain: string
}

const sev = (score: number): Muda['severity'] => (score >= 60 ? 'élevé' : score >= 30 ? 'modéré' : 'faible')
const clamp = (v: number) => Math.max(0, Math.min(100, v))
const n0 = (v: number) => Math.round(v).toLocaleString('fr-FR')
const n1 = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

export function analyzeMuda(sc: Scenario, r: SimResults, k: Kpis): Muda[] {
  const co = sc.costs
  const labMin = co.laborCostPerHour / 60
  const P = r.plannedTime
  const out: Muda[] = []

  // 1. Surproduction : production au-delà de la demande + stock produits finis
  const over = Math.max(0, r.good - sc.demand)
  const fgDays = sc.demand > 0 ? r.fgStock / sc.demand : 0
  const overScore = clamp((over / Math.max(1, sc.demand)) * 400 + fgDays * 60)
  out.push({
    key: 'overproduction',
    index: 1,
    name: 'Surproduction',
    icon: 'Factory',
    severity: sev(overScore),
    score: overScore,
    metrics: [
      { label: 'Pièces bonnes produites', value: n0(r.good) },
      { label: 'Demande du jour', value: n0(sc.demand) },
      { label: 'Excédent', value: n0(over) },
      { label: 'Stock produits finis', value: `${n0(r.fgStock)} pcs (${n1(fgDays)} j)` },
      { label: 'Mode de lancement', value: sc.releasePolicy === 'push' ? 'Flux poussé' : 'Flux tiré' },
    ],
    dailyCost: (over + r.fgStock) * co.wipUnitValue * (co.holdingRate / 100) / co.workingDaysPerYear + over * co.materialCost * 0.05,
    causes: [
      sc.releasePolicy === 'push' ? 'Lancement en flux poussé : les postes produisent dès qu\'ils ont de la matière' : 'Plafond du supermarché produits finis élevé',
      sc.batchSize > 60 ? `Lots importants (${sc.batchSize} pcs) pour amortir des changements de série longs` : 'Taille de lot non alignée sur la consommation',
      'Absence de lissage de la production (Heijunka)',
    ],
    improvements: ['Passer en flux tiré (kanban, supermarché)', 'Produire au takt time', 'Réduire la taille des lots grâce au SMED', 'Lisser la charge (Heijunka box)'],
    potentialGain: over > 0 ? `${n0(over)} pièces/jour non engagées inutilement` : 'Production alignée sur la demande',
  })

  // 2. Attente : postes en famine + temps d'attente des pièces en file
  const starvedMin = r.stations.reduce((s, x, i) => s + (x.time.starved / 60) * sc.stations[i].operators, 0)
  const blockedMin = r.stations.reduce((s, x, i) => s + (x.time.blocked / 60) * sc.stations[i].operators, 0)
  const waitShare = Number.isFinite(k.leadTime) && k.leadTime > 0 ? Math.max(0, 1 - (k.vaTime + (k.avgTransportPerPart || 0)) / k.leadTime) : 0
  const waitScore = clamp(((starvedMin + blockedMin) / ((P / 60) * k.operators)) * 150 + waitShare * 40)
  out.push({
    key: 'waiting',
    index: 2,
    name: 'Attente',
    icon: 'Hourglass',
    severity: sev(waitScore),
    score: waitScore,
    metrics: [
      { label: 'Opérateurs en attente (famine)', value: `${n0(starvedMin)} min·op` },
      { label: 'Opérateurs bloqués (aval saturé)', value: `${n0(blockedMin)} min·op` },
      { label: 'Attente moyenne d\'une pièce en file', value: Number.isFinite(k.avgWaitPerPart) ? `${n1(k.avgWaitPerPart / 60)} min` : '—' },
      { label: 'Part du Lead Time en attente', value: `${n1(waitShare * 100)} %` },
    ],
    dailyCost: (starvedMin + blockedMin) * labMin,
    causes: [
      `Goulot d'étranglement au poste « ${r.stations[r.bottleneckIndex].name} » qui affame l'aval`,
      'Déséquilibre des temps de cycle entre postes',
      'Pannes et changements de série non synchronisés',
    ],
    improvements: ['Équilibrer la ligne (Yamazumi)', 'Augmenter la capacité du goulot (TPM, SMED)', 'Polyvalence des opérateurs pour aider au goulot', 'Tampon de protection devant le goulot (DBR)'],
    potentialGain: `${n0((starvedMin + blockedMin) / 60)} h·opérateur/jour récupérables`,
  })

  // 3. Transport : manutention des pièces
  const transportM = r.transportDistance
  const transportScore = clamp(sc.stations.reduce((s, x) => s + x.distanceToNext, 0) * 0.6)
  out.push({
    key: 'transport',
    index: 3,
    name: 'Transport',
    icon: 'Truck',
    severity: sev(transportScore),
    score: transportScore,
    metrics: [
      { label: 'Distance parcourue par une pièce', value: `${n0(sc.stations.reduce((s, x) => s + x.distanceToNext, 0))} m` },
      { label: 'Distance cumulée du jour', value: `${n1(transportM / 1000)} km` },
      { label: 'Temps de manutention par pièce', value: Number.isFinite(k.avgTransportPerPart) ? `${n1(k.avgTransportPerPart)} s` : '—' },
    ],
    dailyCost: (transportM / Math.max(sc.transportSpeed, 0.01) / 60) * labMin * 0.2,
    causes: ['Implantation fonctionnelle (par métier) plutôt qu\'en flux', 'Postes éloignés, allées longues', 'Transport par lots en chariot'],
    improvements: ['Implantation en U ou en ligne', 'Rapprocher les postes consécutifs', 'Flux pièce à pièce avec goulottes', 'Petit train logistique (milk run)'],
    potentialGain: `Jusqu'à ${n1(transportM / 1000 * 0.6)} km/jour évitables par réimplantation (hypothèse −60 %)`,
  })

  // 4. Surprocessus : opérations sans valeur ajoutée
  const nvaStations = sc.stations.map((s, i) => ({ s, st: r.stations[i] })).filter((x) => !x.s.valueAdded)
  const nvaMin = nvaStations.reduce((s, x) => s + (x.st.time.processing / 60) * x.s.operators, 0)
  const nvaCT = nvaStations.reduce((s, x) => s + x.st.nominalCycleTime, 0)
  const procScore = clamp((nvaCT / Math.max(1, k.vaTime + nvaCT)) * 200)
  out.push({
    key: 'overprocessing',
    index: 4,
    name: 'Surprocessus',
    icon: 'Layers',
    severity: sev(procScore),
    score: procScore,
    metrics: [
      { label: 'Opérations sans valeur ajoutée', value: nvaStations.map((x) => x.s.name).join(', ') || 'Aucune' },
      { label: 'Temps NVA par pièce', value: `${n1(nvaCT)} s` },
      { label: 'Temps opérateur NVA du jour', value: `${n0(nvaMin)} min` },
    ],
    dailyCost: nvaMin * labMin,
    causes: ['Contrôle final à 100 % compensant un procédé non capable', 'Emballages multiples / manipulations redondantes', 'Tolérances internes plus serrées que le besoin client'],
    improvements: ['Autocontrôle au poste et SPC (contrôle libératoire)', 'Améliorer la capabilité pour alléger le contrôle final', 'Analyse de la valeur des opérations'],
    potentialGain: `${n0(nvaMin)} min·opérateur/jour d'opérations sans valeur ajoutée`,
  })

  // 5. Stocks excessifs
  const wipDays = sc.demand > 0 ? (r.avgWip + r.fgStock) / sc.demand : 0
  const invScore = clamp(wipDays * 120)
  out.push({
    key: 'inventory',
    index: 5,
    name: 'Stocks excessifs',
    icon: 'Boxes',
    severity: sev(invScore),
    score: invScore,
    metrics: [
      { label: 'Encours moyen (WIP)', value: `${n1(r.avgWip)} pcs` },
      { label: 'Couverture totale (WIP + PF)', value: `${n1(wipDays)} jour(s)` },
      { label: 'Valeur immobilisée', value: `${n0((r.avgWip + r.fgStock) * co.wipUnitValue)} €` },
      { label: 'Lead Time (loi de Little)', value: `${n1(k.leadTime / 60)} min` },
    ],
    dailyCost: k.costs.holding,
    causes: ['Stocks tampons non plafonnés entre postes', 'Lots de grande taille', 'Variabilité (pannes) compensée par du stock'],
    improvements: ['Plafonner les encours (kanban, CONWIP)', 'Réduire les lots (SMED)', 'Fiabiliser les machines (TPM)', 'FIFO lanes'],
    potentialGain: `${n0((r.avgWip + r.fgStock) * co.wipUnitValue * 0.6)} € de trésorerie libérable (hypothèse −60 %)`,
  })

  // 6. Mouvements inutiles (diagramme spaghetti)
  const sp = spaghettiAnalysis(sc)
  const motionScore = clamp(sp.unnecessary / 20)
  out.push({
    key: 'motion',
    index: 6,
    name: 'Mouvements inutiles',
    icon: 'Footprints',
    severity: sev(motionScore),
    score: motionScore,
    metrics: [
      { label: 'Déplacements opérateurs / jour', value: `${n0(sp.totalOperator)} m` },
      { label: 'Dont non nécessaires', value: `${n0(sp.unnecessary)} m` },
      { label: 'Temps de marche inutile', value: `${n0(sp.unnecessaryTimeMin)} min` },
    ],
    dailyCost: sp.unnecessaryTimeMin * labMin,
    causes: ['Outils et instruments de mesure éloignés des postes', 'Pas d\'emplacement défini (5S)', 'Approvisionnement réalisé par les opérateurs'],
    improvements: ['5S et chariots d\'outillage au poste', 'Instruments de mesure au poste (SPC)', 'Fonction de water spider / approvisionneur'],
    potentialGain: `${n0(sp.unnecessaryTimeMin)} min·opérateur/jour`,
  })

  // 7. Défauts
  const defRate = r.good + r.scrap > 0 ? r.scrap / (r.good + r.scrap) : 0
  const defScore = clamp(defRate * 1200)
  out.push({
    key: 'defects',
    index: 7,
    name: 'Défauts',
    icon: 'XCircle',
    severity: sev(defScore),
    score: defScore,
    metrics: [
      { label: 'Pièces rebutées', value: n0(r.scrap) },
      { label: 'Taux de rebut', value: `${n1(defRate * 100)} %` },
      { label: 'DPMO', value: n0(k.sigma.dpmo) },
      { label: 'Cpk diamètre', value: k.dimension?.cpk !== undefined ? k.dimension.cpk.toFixed(2) : '—' },
      { label: 'Défaut principal', value: k.defectsByType[0] ? `${k.defectsByType[0].type} (${k.defectsByType[0].count})` : '—' },
    ],
    dailyCost: k.costs.copq,
    causes: ['Procédé décentré ou trop dispersé (Cpk < 1,33)', 'Absence de poka-yoke', 'Usure outil non compensée', 'Détection tardive (contrôle final)'],
    improvements: ['Projet DMAIC sur la caractéristique critique', 'Cartes de contrôle SPC au poste', 'Poka-yoke', 'Plan d\'expériences pour optimiser les réglages'],
    potentialGain: `${n0(k.costs.copq)} €/jour de coût de non-qualité`,
  })

  // 8. Sous-utilisation des compétences
  const idleOp = (1 - k.operatorUtilization) * k.operators
  const skillScore = clamp((1 - k.operatorUtilization) * 120)
  out.push({
    key: 'skills',
    index: 8,
    name: 'Sous-utilisation des compétences',
    icon: 'Brain',
    severity: sev(skillScore),
    score: skillScore,
    metrics: [
      { label: 'Taux d\'utilisation des opérateurs', value: `${n1(k.operatorUtilization * 100)} %` },
      { label: 'Équivalent opérateurs inoccupés', value: n1(idleOp) },
      { label: 'Productivité', value: `${n1(k.productivity)} pcs/h·op` },
    ],
    dailyCost: idleOp * (r.openTime / 3600) * co.laborCostPerHour * 0.5,
    causes: ['Opérateurs affectés à un seul poste', 'Pas de système de suggestions / Kaizen', 'Postes surdimensionnés en effectif'],
    improvements: ['Matrice de polyvalence', 'Rééquilibrage des effectifs selon le takt', 'Impliquer les opérateurs dans les Kaizen et la résolution de problèmes'],
    potentialGain: `${n1(idleOp)} ETP redéployables sur des activités à valeur ajoutée`,
  })

  return out
}

/**
 * Jeu de données de démonstration : MécaPrécis SAS (entreprise fictive).
 * Usinage d'arbres de transmission Ø 25 mm pour pompes industrielles.
 * Les valeurs sont des ordres de grandeur réalistes d'atelier d'usinage de série
 * (temps de cycle 20–50 s, TRS 55–70 %, changements de série 15–40 min).
 */
import type { Scenario, Station } from '../engine/types'

const st = (s: Omit<Station, 'cycleTimeCV' | 'capacity'> & Partial<Pick<Station, 'cycleTimeCV' | 'capacity'>>): Station => ({
  cycleTimeCV: 0.1,
  capacity: 1,
  ...s,
})

export function createInitialScenario(): Scenario {
  const now = new Date().toISOString()
  return {
    id: 'sc-initial',
    name: 'Situation initiale',
    kind: 'initial',
    description:
      'Ligne en flux poussé, lots de 120 pièces, changements de série longs sur le tour CNC, réglage de température décentré et régulation instable.',
    createdAt: now,
    updatedAt: now,
    company: {
      name: 'MécaPrécis SAS',
      sector: 'Mécanique de précision — sous-traitance',
      product: 'Arbre de transmission Ø 25 mm (réf. AT-25)',
      description:
        "PME de 85 salariés fabriquant des arbres usinés pour des fabricants de pompes industrielles. Le client principal exige 420 pièces livrées par jour et se plaint de retards de livraison et de pièces hors tolérance sur le diamètre de portée de roulement.",
    },
    stations: [
      st({ id: 'S1', name: 'Débit (sciage)', cycleTime: 38, changeoverTime: 15, operators: 1, availability: 0.95, mttr: 10, defectRate: 0.004, bufferCapacity: 200, initialWip: 120, valueAdded: true, distanceToNext: 25, x: 6, y: 8, defectTypes: ['Longueur incorrecte', 'Bavure de coupe'] }),
      st({ id: 'S2', name: 'Tournage CNC', cycleTime: 45, changeoverTime: 25, operators: 1, availability: 0.9, mttr: 20, defectRate: 0.006, bufferCapacity: 120, initialWip: 60, valueAdded: true, distanceToNext: 40, x: 20, y: 8, defectTypes: ['Rayure', 'État de surface'], cycleTimeCV: 0.05 }),
      st({ id: 'S3', name: 'Fraisage clavette', cycleTime: 50, changeoverTime: 15, operators: 1, availability: 0.93, mttr: 15, defectRate: 0.008, bufferCapacity: 100, initialWip: 40, valueAdded: true, distanceToNext: 15, x: 38, y: 20, defectTypes: ['Position clavette', 'Rayure', 'Bavure'] }),
      st({ id: 'S4', name: 'Ébavurage manuel', cycleTime: 30, changeoverTime: 5, operators: 2, availability: 0.99, mttr: 5, defectRate: 0.012, bufferCapacity: 100, initialWip: 30, valueAdded: true, distanceToNext: 30, x: 26, y: 26, defectTypes: ['Choc / marque', 'Bavure résiduelle', 'Rayure'], cycleTimeCV: 0.25 }),
      st({ id: 'S5', name: 'Contrôle final', cycleTime: 28, changeoverTime: 5, operators: 1, availability: 0.99, mttr: 5, defectRate: 0.003, bufferCapacity: 100, initialWip: 30, valueAdded: false, distanceToNext: 10, x: 10, y: 26, defectTypes: ['Erreur de marquage'], cycleTimeCV: 0.2 }),
      st({ id: 'S6', name: 'Emballage', cycleTime: 20, changeoverTime: 0, operators: 1, availability: 0.99, mttr: 5, defectRate: 0.001, bufferCapacity: 400, initialWip: 60, valueAdded: false, distanceToNext: 0, x: 4, y: 20, defectTypes: ['Emballage endommagé'], cycleTimeCV: 0.15 }),
    ],
    shift: {
      duration: 480,
      breaks: [
        { start: 120, duration: 10, label: 'Pause matin' },
        { start: 240, duration: 30, label: 'Repas' },
        { start: 380, duration: 10, label: 'Pause après-midi' },
      ],
    },
    demand: 420,
    batchSize: 120,
    releasePolicy: 'push',
    finishedGoodsCap: 80,
    transportSpeed: 0.8,
    process: {
      stationId: 'S2',
      characteristic: { name: 'Diamètre de portée', unit: 'mm', nominal: 25.0, lsl: 24.95, usl: 25.05 },
      baseMean: 25.0,
      params: [
        { key: 'temperature', name: 'Température broche', unit: '°C', setpoint: 43, reference: 35, noiseSd: 2.5, min: 25, max: 55 },
        { key: 'pressure', name: 'Pression lubrification', unit: 'bar', setpoint: 60, reference: 60, noiseSd: 3, min: 40, max: 80 },
        { key: 'speed', name: 'Vitesse de coupe', unit: 'tr/min', setpoint: 1200, reference: 1200, noiseSd: 15, min: 800, max: 1800 },
      ],
      coefficients: { temperature: 0.003, pressure: -0.0012, speed: 0.000008 },
      interactionTV: 0.004,
      residualSd: 0.007,
      speedVarianceExponent: 1.5,
      batchSd: 0.006,
      toolWearPerPart: 0.00006,
    },
    costs: {
      materialCost: 14,
      sellingPrice: 62,
      laborCostPerHour: 38,
      holdingRate: 20,
      wipUnitValue: 32,
      machineHourCost: 55,
      workingDaysPerYear: 220,
      lateDeliveryPenalty: 6,
    },
    // Graine dont la journée est représentative de la moyenne de 20 journées (Lead Time, débit, défauts)
    seed: 30,
    warmup: true,
    layoutPoints: [
      { id: 'MAG', name: 'Magasin matière', x: 2, y: 2 },
      { id: 'OUT', name: 'Magasin outils', x: 44, y: 4 },
      { id: 'MET', name: 'Labo métrologie', x: 46, y: 30 },
      { id: 'EXP', name: 'Quai expédition', x: 2, y: 30 },
    ],
    operatorRoutes: [
      { id: 'r1', operator: 'Opérateur tournage', from: 'S2', to: 'OUT', tripsPerShift: 10, purpose: 'Chercher plaquettes / outils', necessary: false },
      { id: 'r2', operator: 'Opérateur tournage', from: 'S2', to: 'MET', tripsPerShift: 12, purpose: 'Mesure du diamètre au labo', necessary: false },
      { id: 'r3', operator: 'Opérateur fraisage', from: 'S3', to: 'OUT', tripsPerShift: 6, purpose: 'Outils de fraisage', necessary: false },
      { id: 'r4', operator: 'Cariste', from: 'MAG', to: 'S1', tripsPerShift: 8, purpose: 'Approvisionnement barres', necessary: true },
      { id: 'r5', operator: 'Opérateur ébavurage', from: 'S4', to: 'S3', tripsPerShift: 15, purpose: 'Chercher les bacs de pièces', necessary: false },
      { id: 'r6', operator: 'Opérateur emballage', from: 'S6', to: 'EXP', tripsPerShift: 10, purpose: 'Évacuer les cartons', necessary: true },
      { id: 'r7', operator: 'Contrôleur', from: 'S5', to: 'MET', tripsPerShift: 8, purpose: 'Contrôle par prélèvement', necessary: false },
    ],
    actions: [],
  }
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

/** Améliorations Lean : SMED, flux tiré (kanban), réduction des lots, implantation. */
export function applyLeanImprovements(base: Scenario): Scenario {
  const s = clone(base)
  s.id = 'sc-lean'
  s.name = 'Amélioration Lean'
  s.kind = 'lean'
  s.description = 'SMED (changements de série ÷ 4), lots de 60, équilibrage fraisage/ébavurage, flux tiré avec kanbans, implantation en U réduisant les distances, maintenance autonome (TPM).'
  s.batchSize = 60
  s.releasePolicy = 'pull'
  s.finishedGoodsCap = 30
  const byId = Object.fromEntries(s.stations.map((x) => [x.id, x]))
  // SMED : externalisation des réglages, préréglage des outils hors machine
  byId.S1.changeoverTime = 5
  byId.S2.changeoverTime = 6
  byId.S3.changeoverTime = 5
  byId.S4.changeoverTime = 2
  byId.S5.changeoverTime = 2
  // TPM : maintenance autonome et préventive
  byId.S1.availability = 0.97
  byId.S2.availability = 0.95
  byId.S3.availability = 0.96
  // Équilibrage : l'ébavurage de la rainure de clavette passe du fraisage au poste d'ébavurage
  byId.S3.cycleTime = 46
  byId.S4.operators = 1
  byId.S4.cycleTime = 38
  // Boucles kanban : stocks plafonnés, tampon de protection autour du goulot (DBR)
  for (const x of s.stations) {
    x.bufferCapacity = x.id === 'S6' ? 400 : x.id === 'S1' || x.id === 'S2' ? 10 : 5
    x.initialWip = x.id === 'S6' ? 30 : 5
  }
  // Implantation en U
  const layout: Record<string, [number, number, number]> = { S1: [6, 8, 6], S2: [12, 8, 6], S3: [18, 8, 5], S4: [18, 14, 6], S5: [12, 14, 5], S6: [6, 14, 0] }
  for (const x of s.stations) [x.x, x.y, x.distanceToNext] = layout[x.id]
  s.layoutPoints = s.layoutPoints.map((p) => (p.id === 'OUT' ? { ...p, x: 14, y: 4 } : p.id === 'EXP' ? { ...p, x: 2, y: 18 } : p))
  s.operatorRoutes = s.operatorRoutes.filter((r) => r.necessary || r.id === 'r1').map((r) => (r.id === 'r1' ? { ...r, tripsPerShift: 3 } : r))
  s.actions = [
    { id: 'a1', label: 'Chantier SMED tour CNC et fraiseuse', approach: 'lean', investment: 18000 },
    { id: 'a2', label: 'Boucles kanban et supermarché', approach: 'lean', investment: 6000 },
    { id: 'a3', label: 'Réimplantation en U', approach: 'lean', investment: 25000 },
    { id: 'a4', label: 'TPM — maintenance autonome', approach: 'lean', investment: 9000 },
  ]
  return s
}

/** Améliorations Six Sigma (projet DMAIC sur le diamètre). */
export function applySixSigmaImprovements(base: Scenario): Scenario {
  const s = clone(base)
  s.id = 'sc-sixsigma'
  s.name = 'Amélioration Six Sigma'
  s.kind = 'sixsigma'
  s.description = 'Projet DMAIC : recentrage de la température (DOE), régulation thermique de broche, compensation d\'usure outil, poka-yoke ébavurage.'
  const T = s.process.params.find((p) => p.key === 'temperature')!
  T.setpoint = 35
  T.noiseSd = 0.8
  s.process.toolWearPerPart = 0.00002
  s.process.batchSd = 0.003
  const byId = Object.fromEntries(s.stations.map((x) => [x.id, x]))
  byId.S2.defectRate = 0.003
  byId.S3.defectRate = 0.004
  byId.S4.defectRate = 0.004
  s.operatorRoutes = s.operatorRoutes.map((r) => (r.id === 'r2' ? { ...r, tripsPerShift: 2, purpose: 'Contrôle libératoire (mesure au poste via SPC)' } : r))
  s.actions = [
    { id: 'b1', label: 'Régulation thermique de broche', approach: 'sixsigma', investment: 14000 },
    { id: 'b2', label: 'Compensation automatique d\'usure', approach: 'sixsigma', investment: 8000 },
    { id: 'b3', label: 'Poka-yoke et gabarit ébavurage', approach: 'sixsigma', investment: 4000 },
    { id: 'b4', label: 'Formation & cartes de contrôle SPC', approach: 'sixsigma', investment: 5000 },
  ]
  return s
}

export function applyLssImprovements(base: Scenario): Scenario {
  const lean = applyLeanImprovements(base)
  const six = applySixSigmaImprovements(base)
  const s = clone(lean)
  s.id = 'sc-lss'
  s.name = 'Lean Six Sigma'
  s.kind = 'lss'
  s.description = 'Combinaison des améliorations Lean (flux) et Six Sigma (variabilité).'
  s.process = clone(six.process)
  for (const st2 of s.stations) {
    const o = six.stations.find((x) => x.id === st2.id)!
    st2.defectRate = o.defectRate
  }
  s.operatorRoutes = lean.operatorRoutes
  s.actions = [...lean.actions, ...six.actions]
  return s
}

export function demoScenarios(): Scenario[] {
  const init = createInitialScenario()
  return [init, applyLeanImprovements(init), applySixSigmaImprovements(init), applyLssImprovements(init)]
}

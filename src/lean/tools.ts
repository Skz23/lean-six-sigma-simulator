/**
 * Calculs des outils Lean : Takt, Kanban, SMED, 5S, VSM, spaghetti, équilibrage.
 */
import type { LayoutPoint, OperatorRoute, Scenario, SimResults } from '../engine/types'

/** Takt Time = temps d'ouverture net disponible / demande client. */
export function taktTime(availableSeconds: number, demand: number): number {
  return demand > 0 ? availableSeconds / demand : Infinity
}

export function availableTime(sc: Scenario): number {
  return (sc.shift.duration - sc.shift.breaks.reduce((s, b) => s + b.duration, 0)) * 60
}

// ---------------- Kanban ----------------
export interface KanbanInput {
  /** Consommation moyenne (pièces / jour). */
  dailyDemand: number
  /** Délai de réapprovisionnement de la boucle (jours) = temps d'attente + traitement + transport + signal. */
  leadTimeDays: number
  /** Coefficient de sécurité (ex. 0,1 = 10 %). */
  safety: number
  /** Nombre de pièces par conteneur. */
  containerSize: number
}

/** N = D × L × (1 + α) / C, arrondi à l'entier supérieur (formule Toyota). */
export function kanbanCards(k: KanbanInput): number {
  if (k.containerSize <= 0) return 0
  return Math.ceil((k.dailyDemand * k.leadTimeDays * (1 + k.safety)) / k.containerSize)
}

/** Encours maximal autorisé par la boucle. */
export function kanbanMaxWip(k: KanbanInput): number {
  return kanbanCards(k) * k.containerSize
}

// ---------------- SMED ----------------
export interface SmedOperation {
  id: string
  label: string
  duration: number // min
  type: 'internal' | 'external'
  /** Peut être convertie en opération externe (préparation hors machine). */
  convertible: boolean
  /** Réduction possible par rationalisation (0–1) : serrage rapide, standardisation… */
  reduction: number
}

export interface SmedResult {
  before: number
  internalBefore: number
  externalBefore: number
  after: number
  convertedTime: number
  rationalizedGain: number
  gainPct: number
}

/**
 * Étapes SMED : 1) séparer interne/externe, 2) convertir l'interne en externe,
 * 3) rationaliser les opérations internes restantes.
 * Le temps de changement (machine arrêtée) = somme des opérations internes.
 */
export function smedAnalysis(ops: SmedOperation[]): SmedResult {
  const internalBefore = ops.filter((o) => o.type === 'internal').reduce((s, o) => s + o.duration, 0)
  const externalBefore = ops.filter((o) => o.type === 'external').reduce((s, o) => s + o.duration, 0)
  // Avant SMED, toutes les opérations sont réalisées machine arrêtée
  const before = internalBefore + externalBefore
  const remaining = ops.filter((o) => o.type === 'internal' && !o.convertible)
  const convertedTime = ops.filter((o) => o.type === 'internal' && o.convertible).reduce((s, o) => s + o.duration, 0) + externalBefore
  const rationalizedGain = remaining.reduce((s, o) => s + o.duration * o.reduction, 0)
  const after = remaining.reduce((s, o) => s + o.duration * (1 - o.reduction), 0)
  return { before, internalBefore, externalBefore, after, convertedTime, rationalizedGain, gainPct: before > 0 ? 1 - after / before : 0 }
}

/** Taille de lot minimale pour que les changements n'absorbent pas plus que le temps disponible. */
export function minimalBatch(changeoverMin: number, cycleTime: number, taktTimeS: number): number {
  const slack = taktTimeS - cycleTime
  if (slack <= 0) return Infinity
  return Math.ceil((changeoverMin * 60) / slack)
}

// ---------------- 5S ----------------
export const FIVE_S = [
  {
    key: 'seiri',
    name: 'Seiri — Trier',
    questions: ['Seuls les objets nécessaires sont présents au poste', 'Les objets inutiles sont identifiés (étiquette rouge)', 'Aucun stock en excès sur les postes', 'Les outils cassés ou obsolètes sont éliminés'],
  },
  {
    key: 'seiton',
    name: 'Seiton — Ranger',
    questions: ['Chaque objet a une place définie et identifiée', 'Les emplacements sont marqués au sol', 'Les outils sont accessibles en moins de 30 s', 'Les quantités min/max sont affichées'],
  },
  {
    key: 'seiso',
    name: 'Seiso — Nettoyer',
    questions: ['Les machines et sols sont propres', 'Les sources de salissure sont identifiées et traitées', 'Un planning de nettoyage existe et est respecté', 'Le nettoyage sert d\'inspection (fuites, anomalies)'],
  },
  {
    key: 'seiketsu',
    name: 'Seiketsu — Standardiser',
    questions: ['Les standards visuels sont affichés', 'Les règles 5S sont connues de tous', 'Des photos de référence existent par zone', 'Les standards sont mis à jour après amélioration'],
  },
  {
    key: 'shitsuke',
    name: 'Shitsuke — Respecter',
    questions: ['Des audits 5S sont réalisés régulièrement', 'Les résultats d\'audit sont affichés', 'Les écarts font l\'objet d\'actions', 'L\'encadrement participe aux audits'],
  },
] as const

/** Scores 0–4 par question ; renvoie le score par S (0–100 %) et le score global. */
export function fiveSScores(scores: Record<string, number[]>) {
  const dims = FIVE_S.map((d) => {
    const s = scores[d.key] ?? []
    const total = d.questions.reduce((acc, _, i) => acc + (s[i] ?? 0), 0)
    return { key: d.key, name: d.name, score: (total / (d.questions.length * 4)) * 100 }
  })
  const global = dims.reduce((s, d) => s + d.score, 0) / dims.length
  const level = global >= 80 ? 'Excellent' : global >= 60 ? 'Bon' : global >= 40 ? 'Moyen' : 'Insuffisant'
  return { dims, global, level, weakest: [...dims].sort((a, b) => a.score - b.score).slice(0, 2) }
}

// ---------------- Spaghetti ----------------
export interface Point {
  id: string
  name: string
  x: number
  y: number
}

export function allPoints(sc: Scenario): Point[] {
  return [...sc.stations.map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y })), ...sc.layoutPoints.map((p: LayoutPoint) => ({ ...p }))]
}

/** Longueur d'un trajet tracé (somme des segments, m). */
export function pathLength(path: { x: number; y: number }[]): number {
  let d = 0
  for (let i = 1; i < path.length; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  return d
}

/** Distance rectilinéaire (allées orthogonales d'atelier). */
export function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function spaghettiAnalysis(sc: Scenario) {
  const pts = allPoints(sc)
  const find = (id: string) => pts.find((p) => p.id === id)
  const routes = sc.operatorRoutes.map((r: OperatorRoute) => {
    const a = find(r.from)
    const b = find(r.to)
    const d = r.path && r.path.length >= 2 ? pathLength(r.path) : a && b ? manhattan(a, b) : 0
    // aller-retour
    const daily = d * 2 * r.tripsPerShift
    return { ...r, distance: d, daily, timeMin: daily / 1.1 / 60 }
  })
  // Flux produit (poste → poste)
  const productFlow = sc.stations.slice(0, -1).map((s, i) => ({ from: s.id, to: sc.stations[i + 1].id, distance: manhattan(s, sc.stations[i + 1]) }))
  const totalOperator = routes.reduce((s, r) => s + r.daily, 0)
  const unnecessary = routes.filter((r) => !r.necessary).reduce((s, r) => s + r.daily, 0)
  return {
    routes,
    productFlow,
    totalOperator,
    unnecessary,
    walkingTimeMin: totalOperator / 1.1 / 60,
    unnecessaryTimeMin: unnecessary / 1.1 / 60,
    productDistance: sc.stations.reduce((s, x) => s + x.distanceToNext, 0),
  }
}

// ---------------- VSM ----------------
export interface VsmBox {
  id: string
  name: string
  ct: number
  co: number
  uptime: number
  operators: number
  valueAdded: boolean
  inventoryAfter: number
  inventoryDays: number
}

/**
 * Données de la cartographie VSM. Les stocks sont les encours moyens observés
 * en simulation ; leur durée = stock / demande journalière (convention VSM).
 */
export function vsmData(sc: Scenario, r: SimResults) {
  const boxes: VsmBox[] = sc.stations.map((s, i) => {
    const inv = i < sc.stations.length - 1 ? r.stations[i + 1].avgQueue : r.fgStock
    return {
      id: s.id,
      name: s.name,
      ct: r.stations[i].nominalCycleTime,
      co: s.changeoverTime,
      uptime: s.availability,
      operators: s.operators,
      valueAdded: s.valueAdded,
      inventoryAfter: inv,
      inventoryDays: sc.demand > 0 ? inv / sc.demand : 0,
    }
  })
  const secondsPerDay = availableTime(sc)
  const waitSeconds = boxes.reduce((s, b) => s + b.inventoryDays * secondsPerDay, 0)
  const processSeconds = boxes.reduce((s, b) => s + b.ct, 0)
  const vaSeconds = boxes.filter((b) => b.valueAdded).reduce((s, b) => s + b.ct, 0)
  const transportSeconds = sc.stations.reduce((s, x) => s + x.distanceToNext, 0) / Math.max(sc.transportSpeed, 0.01)
  const leadSeconds = waitSeconds + processSeconds + transportSeconds
  return {
    boxes,
    waitSeconds,
    processSeconds,
    vaSeconds,
    nvaSeconds: leadSeconds - vaSeconds,
    transportSeconds,
    leadSeconds,
    leadDays: leadSeconds / secondsPerDay,
    pce: leadSeconds > 0 ? vaSeconds / leadSeconds : 0,
  }
}

// ---------------- Équilibrage (Yamazumi) ----------------
export function lineBalance(sc: Scenario, effectiveCT: number[], takt: number) {
  const loads = sc.stations.map((s, i) => ({ id: s.id, name: s.name, load: effectiveCT[i] / s.capacity, ratio: effectiveCT[i] / s.capacity / takt }))
  const maxLoad = Math.max(...loads.map((l) => l.load))
  const sumLoad = loads.reduce((s, l) => s + l.load, 0)
  return {
    loads,
    /** Efficience d'équilibrage = Σ temps / (n × temps max). */
    efficiency: sumLoad / (loads.length * maxLoad),
    /** Nombre théorique minimum de postes = Σ temps / takt. */
    minStations: Math.ceil(sumLoad / takt),
  }
}

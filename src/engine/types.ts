/** Modèles de données du moteur de simulation commun. */

export interface Station {
  id: string
  name: string
  /** Temps de cycle nominal par pièce et par machine (s). */
  cycleTime: number
  /** Coefficient de variation du temps de cycle (0 = déterministe). */
  cycleTimeCV: number
  /** Temps de changement de série (min). */
  changeoverTime: number
  operators: number
  /** Disponibilité machine visée (0–1) = MTBF / (MTBF + MTTR). */
  availability: number
  /** Temps d'arrêt moyen par panne — MTTR (min). */
  mttr: number
  /** Taux de défauts propres au poste (0–1), hors caractéristique dimensionnelle. */
  defectRate: number
  /** Capacité : nombre de pièces traitées simultanément (machines en parallèle). */
  capacity: number
  /** Capacité du stock intermédiaire en aval (WIP max). */
  bufferCapacity: number
  /** Stock intermédiaire initial en aval (début de journée). */
  initialWip: number
  /** Opération à valeur ajoutée (sinon : contrôle, manutention, emballage…). */
  valueAdded: boolean
  /** Distance vers le poste suivant (m). */
  distanceToNext: number
  /** Position dans l'atelier (m) — utilisée par la VSM et le diagramme spaghetti. */
  x: number
  y: number
  /** Catégories de défauts pouvant apparaître sur ce poste. */
  defectTypes: string[]
}

export interface Break {
  /** Début de la pause (min depuis le début du poste). */
  start: number
  duration: number
  label: string
}

export interface Shift {
  /** Durée d'ouverture du poste de travail (min). */
  duration: number
  breaks: Break[]
}

export type ParamKey = 'temperature' | 'pressure' | 'speed'

export interface ProcessParameter {
  key: ParamKey
  name: string
  unit: string
  /** Consigne réglée par l'utilisateur. */
  setpoint: number
  /** Valeur de référence du modèle (là où l'effet linéaire est nul). */
  reference: number
  /** Écart-type de la variation réelle autour de la consigne (qualité de régulation). */
  noiseSd: number
  min: number
  max: number
}

/**
 * Modèle statistique de la caractéristique critique (CTQ) mesurée au poste qualité :
 *  Y = μ0 + Σ bᵢ·(xᵢ − refᵢ) + b_TV·(T − T_ref)·(V − V_ref)/1000
 *        + offset_lot + usure·k + ε,
 *  ε ~ N(0, σ_e · (V / V_ref)^γ),   offset_lot ~ N(0, σ_lot),   xᵢ ~ N(consigneᵢ, σᵢ)
 * La vitesse influence aussi le temps de cycle du poste qualité : CT = CT_nominal · V_ref / V.
 */
export interface ProcessModel {
  stationId: string
  characteristic: { name: string; unit: string; nominal: number; lsl: number; usl: number }
  baseMean: number
  params: ProcessParameter[]
  coefficients: Record<ParamKey, number>
  /** Interaction température × vitesse (unité Y par °C par 1000 tr/min). */
  interactionTV: number
  residualSd: number
  /** Exposant γ de l'effet de la vitesse sur la répétabilité. */
  speedVarianceExponent: number
  /** Écart-type de décalage entre lots (réglage après changement de série). */
  batchSd: number
  /** Dérive par pièce due à l'usure outil, remise à zéro à chaque changement de série. */
  toolWearPerPart: number
}

export interface Costs {
  /** Coût matière par pièce (€). */
  materialCost: number
  /** Prix de vente unitaire (€). */
  sellingPrice: number
  /** Coût horaire chargé d'un opérateur (€/h). */
  laborCostPerHour: number
  /** Coût de possession des stocks (% de la valeur par an). */
  holdingRate: number
  /** Valeur moyenne d'une pièce en cours (€). */
  wipUnitValue: number
  /** Coût d'une heure d'arrêt machine hors main-d'œuvre (€/h). */
  machineHourCost: number
  workingDaysPerYear: number
  /** Pénalité par pièce non livrée à temps (€). */
  lateDeliveryPenalty: number
}

export interface LayoutPoint {
  id: string
  name: string
  x: number
  y: number
}

export interface OperatorRoute {
  id: string
  operator: string
  from: string
  to: string
  tripsPerShift: number
  purpose: string
  /** Le déplacement apporte-t-il de la valeur (approvisionnement nécessaire) ? */
  necessary: boolean
  /** Trajet réellement observé, tracé sur le plan (m) ; à défaut, distance rectilinéaire entre les deux points. */
  path?: { x: number; y: number }[]
}

export interface ImprovementAction {
  id: string
  label: string
  approach: 'lean' | 'sixsigma'
  investment: number
}

export type ScenarioKind = 'initial' | 'lean' | 'sixsigma' | 'lss' | 'custom'

export interface Company {
  name: string
  sector: string
  product: string
  description: string
}

export interface Scenario {
  id: string
  name: string
  kind: ScenarioKind
  description: string
  createdAt: string
  updatedAt: string
  company: Company
  stations: Station[]
  shift: Shift
  /** Demande client (pièces par jour). */
  demand: number
  /** Taille de lot entre deux changements de série. */
  batchSize: number
  /** push : le premier poste produit dès qu'il a de la place ; pull : supermarché produits finis plafonné. */
  releasePolicy: 'push' | 'pull'
  /** Plafond du supermarché de produits finis en flux tiré (kanbans de production). */
  finishedGoodsCap: number
  /** Vitesse de manutention (m/s). */
  transportSpeed: number
  process: ProcessModel
  costs: Costs
  seed: number
  /** Simule une journée de mise en régime avant la journée mesurée (état initial réaliste). */
  warmup: boolean
  layoutPoints: LayoutPoint[]
  operatorRoutes: OperatorRoute[]
  /** Plan de l'atelier en fond du diagramme spaghetti (image compressée) et ses dimensions réelles. */
  floorPlan?: { image: string; widthM: number; heightM: number; opacity?: number }
  actions: ImprovementAction[]
}

// ---------- Résultats ----------

export type StationState = 'processing' | 'starved' | 'blocked' | 'down' | 'changeover' | 'break'

export interface HistoryEntry {
  stationId: string
  /** Arrivée dans la file d'attente du poste (s). */
  arrive: number
  start: number
  end: number
}

export interface Product {
  id: number
  code: string
  batch: number
  release: number
  exit?: number
  status: 'wip' | 'good' | 'scrap'
  preloaded: boolean
  defect?: { type: string; stationId: string; time: number }
  history: HistoryEntry[]
  params?: Record<ParamKey, number>
  dimension?: number
  /** Temps passé en manutention (s). */
  transportTime: number
}

export interface StationStats {
  id: string
  name: string
  /** Temps (s) dans chaque état, ramené à la station (moyenne sur ses machines). */
  time: Record<StationState, number>
  processed: number
  scrapped: number
  failures: number
  changeovers: number
  /** Taux d'occupation actif (processing + down + changeover) / temps planifié. */
  activeRatio: number
  oee: { availability: number; performance: number; quality: number; oee: number }
  avgQueue: number
  maxQueue: number
  /** Temps de cycle effectif moyen observé (s). */
  avgCycleTime: number
  /** Temps de cycle nominal effectif (après effet de la vitesse pour le poste qualité). */
  nominalCycleTime: number
}

export interface TimePoint {
  t: number
  wip: number
  buffers: number[]
  good: number
  scrap: number
  fg: number
  shipped: number
}

export interface SimResults {
  scenarioId: string
  seed: number
  plannedTime: number
  openTime: number
  taktTime: number
  stations: StationStats[]
  products: Product[]
  good: number
  scrap: number
  released: number
  shipped: number
  backlog: number
  fgStock: number
  wipEnd: number
  avgWip: number
  timeSeries: TimePoint[]
  bottleneckIndex: number
  transportDistance: number
}

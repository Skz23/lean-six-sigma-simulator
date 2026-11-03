import type { SmedOperation } from '../lean/tools'

export interface ActionItem {
  id: string
  what: string
  who: string
  when: string
  status: 'à faire' | 'en cours' | 'fait'
}

export interface KaizenItem {
  id: string
  title: string
  area: string
  problem: string
  proposal: string
  owner: string
  status: 'idée' | 'planifié' | 'en cours' | 'terminé'
  kpi: string
  before: number
  after: number | null
  unit: string
  createdAt: string
}

export interface VocItem {
  id: string
  voice: string
  need: string
  ctq: string
  measure: string
  target: string
}

export interface SipocRow {
  supplier: string
  input: string
  process: string
  output: string
  customer: string
}

export interface IshikawaCause {
  id: string
  category: 'Main-d\'œuvre' | 'Méthode' | 'Matière' | 'Machine' | 'Milieu' | 'Mesure'
  text: string
  likely: boolean
}

export interface WhyChain {
  id: string
  problem: string
  whys: string[]
  rootCause: string
}

export interface Solution {
  id: string
  label: string
  impact: number
  effort: number
  cost: number
  risk: number
  selected: boolean
}

export interface ControlPlanRow {
  id: string
  characteristic: string
  spec: string
  method: string
  frequency: string
  sampleSize: string
  chart: string
  reaction: string
  owner: string
}

export type DmaicPhase = 'define' | 'measure' | 'analyze' | 'improve' | 'control'

export interface DmaicProject {
  id: string
  name: string
  scenarioId: string
  phase: DmaicPhase
  createdAt: string
  charter: {
    problem: string
    businessCase: string
    goal: string
    scope: string
    sponsor: string
    leader: string
    team: string
    startDate: string
    endDate: string
    baselineMetric: string
    targetMetric: string
  }
  voc: VocItem[]
  sipoc: SipocRow[]
  causes: IshikawaCause[]
  whys: WhyChain[]
  solutions: Solution[]
  controlPlan: ControlPlanRow[]
  gates: Record<DmaicPhase, boolean>
  improvedScenarioId?: string
  notes: Record<DmaicPhase, string>
  /** démarche choisie à la création (DMAIC complet ou parcours allégé) */
  method?: MrpMethod
  /** outils faits, clé « sous-étape:outil » (ex. « 2.2:msa ») */
  done?: Record<string, boolean>
  /** résultat clé retenu pour un outil, même clé */
  results?: Record<string, string>
  /** cases de la revue de fin de phase */
  gateChecks?: Partial<Record<DmaicPhase, boolean[]>>
  /** vérification des causes racines (3.4) : clé = id de la cause Ishikawa ou de la chaîne 5 Pourquoi */
  rootChecks?: Record<string, { verified: boolean; proof: string }>
  /** données des outils du projet quand il n'est pas le projet en cours (voir openProject) */
  ws?: ProjectWorkspace
}

/** Outils dont les données appartiennent au projet : AMDEC, registre des défauts, Kaizen, fiches problème et Kano. */
export interface ProjectWorkspace {
  fmea: FmeaRow[]
  defectLog: DefectRecord[]
  kaizen: KaizenItem[]
  mrp?: MrpState
}

export interface KanbanParams {
  container: number
  safety: number
  loopMin: number | null
}

export interface FmeaRow {
  id: string
  process: string
  failureMode: string
  effect: string
  cause: string
  currentControl: string
  s: number
  o: number
  d: number
  action: string
  owner: string
  s2: number | null
  o2: number | null
  d2: number | null
}

export interface DefectRecord {
  id: string
  date: string
  category: string
  station: string
  count: number
  consequence: string
  cost: number
}

export interface FiveSAudit {
  scores: Record<string, number[]>
  actions: ActionItem[]
  date: string
  area: string
}

export type MrpMethod = 'kaizen' | 'a3' | '8d' | 'dmaic' | 'projet'

export interface ProblemSheet {
  id: string
  title: string
  createdAt: string
  method: MrpMethod
  qqoqcpc: Record<'quoi' | 'qui' | 'ou' | 'quand' | 'comment' | 'pourquoi' | 'combien', string>
  indicator: string
  d8: string[]
  a3: Record<string, string>
  ideas: { id: string; text: string; group: string; votes: number }[]
  criteria: { id: string; name: string; weight: number }[]
  scores: Record<string, Record<string, number>>
}

export interface KanoItem {
  id: string
  need: string
  answers: { f: 1 | 2 | 3 | 4 | 5; d: 1 | 2 | 3 | 4 | 5 }[]
}

export interface MrpState {
  sheets: ProblemSheet[]
  kano: KanoItem[]
}

export interface ToolsState {
  mrp?: MrpState
  fiveS: Record<string, FiveSAudit>
  smed: Record<string, SmedOperation[]>
  kaizen: KaizenItem[]
  dmaic: DmaicProject[]
  fmea: FmeaRow[]
  defectLog: DefectRecord[]
  /** paramètres de dimensionnement Kanban, par scénario */
  kanban?: Record<string, KanbanParams>
}

export const DASHBOARD_WIDGETS = [
  { id: 'kpis', label: 'Indicateurs clés' },
  { id: 'oee', label: 'TRS / OEE' },
  { id: 'production', label: 'Production vs demande' },
  { id: 'wip', label: 'Évolution des encours' },
  { id: 'stations', label: 'États des postes' },
  { id: 'quality', label: 'Qualité & capabilité' },
  { id: 'pareto', label: 'Pareto des défauts' },
  { id: 'scenarios', label: 'Comparaison des scénarios' },
  { id: 'costs', label: 'Économie journalière' },
] as const

export type WidgetId = (typeof DASHBOARD_WIDGETS)[number]['id']

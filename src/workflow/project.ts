// Suivi d'un projet le long de la démarche : parcours complet ou allégé, avancement, prochaines actions.
import type { DmaicProject, MrpMethod } from '../store/types'
import { PHASES, type Phase, type PhaseId, type Step, type StepTool } from './phases'

/** Outils du parcours allégé (Kaizen, A3, 8D) : l'essentiel de chaque étape, sans la statistique avancée. */
export const LIGHT_TOOLS = new Set([
  'qqoqcpc', 'voc', 'sipoc', 'vsm', 'charter',
  'defect-log', 'data', 'simulation', 'kpi', 'capability',
  'pareto', 'muda', 'toc', 'wizard', 'ideas', 'ishikawa', 'why', 'root', 'plan',
  'smed', 'kanban', 'vote', 'scenarios',
  'spc', 'control-plan', '5s', 'kaizen', 'a3', '8d',
])

export const METHOD_LABEL: Record<MrpMethod, string> = {
  dmaic: 'DMAIC complet',
  projet: 'Projet (DMAIC complet)',
  kaizen: 'Kaizen / PDCA (allégé)',
  a3: 'A3 (allégé)',
  '8d': '8D (allégé)',
}

export const isLight = (p: Pick<DmaicProject, 'method'>) => p.method === 'kaizen' || p.method === 'a3' || p.method === '8d'

export const doneKey = (step: Step, t: StepTool) => `${step.n}:${t.id}`

/** Sous-étapes d'une phase avec les outils du parcours du projet (les sous-étapes vides sont retirées). */
export function stepsFor(phase: Phase, light: boolean): Step[] {
  return phase.steps
    .map((s) => ({ ...s, tools: light ? s.tools.filter((t) => LIGHT_TOOLS.has(t.id)) : s.tools }))
    .filter((s) => s.tools.length > 0)
}

export function phaseProgress(p: DmaicProject, phaseId: PhaseId) {
  const phase = PHASES.find((x) => x.id === phaseId)!
  const items = stepsFor(phase, isLight(p)).flatMap((s) => s.tools.map((t) => doneKey(s, t)))
  const done = items.filter((k) => p.done?.[k]).length
  return { done, total: items.length, ratio: items.length ? done / items.length : 0 }
}

export function projectProgress(p: DmaicProject) {
  let done = 0
  let total = 0
  for (const ph of PHASES) {
    const r = phaseProgress(p, ph.id)
    done += r.done
    total += r.total
  }
  return { done, total, ratio: total ? done / total : 0 }
}

/** Prochains outils à faire dans la phase en cours du projet. */
export function nextTodo(p: DmaicProject, max = 3): { phase: Phase; step: Step; tool: StepTool }[] {
  const phase = PHASES.find((x) => x.id === p.phase)!
  const out: { phase: Phase; step: Step; tool: StepTool }[] = []
  for (const s of stepsFor(phase, isLight(p))) for (const t of s.tools) if (!p.done?.[doneKey(s, t)] && out.length < max) out.push({ phase, step: s, tool: t })
  return out
}

/** Résultats clés saisis, dans l'ordre de la démarche. */
export function keyResults(p: DmaicProject): { step: Step; tool: StepTool; value: string }[] {
  return PHASES.flatMap((ph) => ph.steps.flatMap((s) => s.tools.map((t) => ({ step: s, tool: t, value: p.results?.[doneKey(s, t)]?.trim() ?? '' })))).filter((x) => x.value)
}

export function emptyProject(id: string, name: string, scenarioId: string, method: MrpMethod, problem = ''): DmaicProject {
  return {
    id,
    name,
    scenarioId,
    phase: 'define',
    createdAt: new Date().toISOString(),
    method,
    charter: { problem, businessCase: '', goal: '', scope: '', sponsor: '', leader: '', team: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', baselineMetric: '', targetMetric: '' },
    voc: [],
    sipoc: [],
    causes: [],
    whys: [],
    solutions: [],
    controlPlan: [],
    gates: { define: false, measure: false, analyze: false, improve: false, control: false },
    notes: { define: '', measure: '', analyze: '', improve: '', control: '' },
    done: {},
    results: {},
    gateChecks: {},
  }
}

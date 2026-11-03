// Contenu des livrables d'un projet (A3, 8D, rapport) assemblé à partir des données saisies.
// Ce qui a été écrit à la main dans les fiches A3 / 8D est prioritaire ; sinon le texte est composé
// à partir de la charte, des outils faits, des résultats retenus, des causes, des solutions et du plan de contrôle.
import type { DmaicProject, ProjectWorkspace } from '../store/types'
import { A3, D8 } from '../data/mrp'
import { PHASES, toolById, type PhaseId } from '../workflow/phases'
import { doneKey, isLight, phaseProgress, stepsFor } from '../workflow/project'

export interface Block {
  title: string
  text: string
}

const lines = (xs: (string | false | undefined | null)[]) => xs.filter((x): x is string => !!x && !!x.trim()).join('\n')
const bullet = (xs: string[]) => xs.filter((x) => x.trim()).map((x) => `- ${x}`)

/** Résultats retenus d'une phase, sous la forme « rôle ou outil : valeur ». */
export function phaseResults(p: DmaicProject, phase: PhaseId): string[] {
  const ph = PHASES.find((x) => x.id === phase)!
  return ph.steps.flatMap((s) =>
    s.tools
      .map((t) => ({ t, v: p.results?.[doneKey(s, t)]?.trim() }))
      .filter((x) => x.v)
      .map((x) => `${x.t.role ?? toolById(x.t.id)!.name} : ${x.v}`),
  )
}

export function sheetOf(ws: ProjectWorkspace) {
  return ws.mrp?.sheets[0]
}

function qq(ws: ProjectWorkspace): string[] {
  const s = sheetOf(ws)
  if (!s) return []
  const q = s.qqoqcpc
  return bullet([q.quoi && `Quoi : ${q.quoi}`, q.qui && `Qui : ${q.qui}`, q.ou && `Où : ${q.ou}`, q.quand && `Quand : ${q.quand}`, q.comment && `Comment : ${q.comment}`, q.combien && `Combien : ${q.combien}`].filter(Boolean) as string[])
}

function topDefects(ws: ProjectWorkspace): string[] {
  const m = new Map<string, number>()
  for (const d of ws.defectLog) m.set(d.category, (m.get(d.category) ?? 0) + d.count)
  const tot = [...m.values()].reduce((a, b) => a + b, 0)
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} : ${v} (${Math.round((v / Math.max(1, tot)) * 100)} %)`)
}

export function rootCauses(p: DmaicProject): string[] {
  const tag = (id: string, label: string) => {
    const c = p.rootChecks?.[id]
    return c?.verified ? `${label} [vérifiée${c.proof.trim() ? ` : ${c.proof.trim()}` : ''}]` : `${label} [hypothèse non vérifiée]`
  }
  const fromWhy = p.whys.filter((w) => w.rootCause.trim()).map((w) => tag(w.id, w.rootCause.trim()))
  const likely = p.causes.filter((c) => c.likely).map((c) => tag(c.id, `${c.text} (${c.category})`))
  return [...new Set([...fromWhy, ...likely])]
}

export function chosenSolutions(p: DmaicProject): string[] {
  const sel = p.solutions.filter((s) => s.selected)
  return (sel.length ? sel : []).map((s) => s.label)
}

function controlRows(p: DmaicProject): string[] {
  return p.controlPlan.filter((c) => c.characteristic.trim()).map((c) => lines([`${c.characteristic}${c.spec ? ` (${c.spec})` : ''} : ${[c.method, c.frequency, c.chart].filter(Boolean).join(', ')}${c.reaction ? ` ; réaction : ${c.reaction}` : ''}${c.owner ? ` ; resp. ${c.owner}` : ''}`]))
}

function actions(ws: ProjectWorkspace): string[] {
  const k = ws.kaizen.map((x) => `${x.title} — ${x.owner || 'resp. à définir'} — ${x.status}`)
  const f = ws.fmea.filter((x) => x.action.trim()).map((x) => `${x.action} — ${x.owner || 'resp. à définir'} (AMDEC : ${x.failureMode})`)
  return [...k, ...f]
}

const pick = (manual: string | undefined, auto: string) => (manual && manual.trim() ? manual.trim() : auto)
const TODO = 'À compléter.'

export function a3Blocks(p: DmaicProject, ws: ProjectWorkspace): Block[] {
  const s = sheetOf(ws)
  const ch = p.charter
  const auto: Record<string, string> = {
    contexte: lines([ch.businessCase, ch.problem && `Problème : ${ch.problem}`]),
    actuel: lines([...qq(ws), ch.baselineMetric && `Indicateur de départ : ${ch.baselineMetric}`, ...bullet(phaseResults(p, 'define')), ...bullet(phaseResults(p, 'measure'))]),
    objectif: lines([ch.goal, ch.targetMetric && `Cible : ${ch.targetMetric}`, ch.endDate && `Échéance : ${ch.endDate}`]),
    causes: lines([...bullet(topDefects(ws).map((x) => `Pareto : ${x}`)), ...bullet(rootCauses(p).map((x) => `Cause : ${x}`)), ...bullet(phaseResults(p, 'analyze'))]),
    contremesures: lines(bullet(chosenSolutions(p))),
    plan: lines(bullet(actions(ws))),
    suivi: lines([ch.baselineMetric && `Avant : ${ch.baselineMetric}`, ch.targetMetric && `Cible : ${ch.targetMetric}`, ...bullet(phaseResults(p, 'improve')), ...bullet(phaseResults(p, 'control'))]),
    standard: lines(bullet(controlRows(p))),
  }
  return A3.map(([k, t]) => ({ title: t, text: pick(s?.a3[k], auto[k]) || TODO }))
}

export function d8Blocks(p: DmaicProject, ws: ProjectWorkspace): Block[] {
  const s = sheetOf(ws)
  const ch = p.charter
  const auto = [
    '',
    lines([ch.leader && `Pilote : ${ch.leader}`, ch.team && `Équipe : ${ch.team}`, ch.sponsor && `Sponsor : ${ch.sponsor}`]),
    lines([ch.problem, ...qq(ws), ch.baselineMetric && `Indicateur : ${ch.baselineMetric}`]),
    '',
    lines([...bullet(rootCauses(p)), ...bullet(phaseResults(p, 'analyze'))]),
    lines(bullet(chosenSolutions(p))),
    lines([...bullet(actions(ws)), ...bullet(phaseResults(p, 'improve'))]),
    lines([...bullet(controlRows(p)), ...bullet(phaseResults(p, 'control'))]),
    '',
  ]
  return D8.map(([k, t], i) => ({ title: `${k} — ${t}`, text: pick(s?.d8[i], auto[i]) || TODO }))
}

export interface PhaseSummary {
  id: PhaseId
  title: string
  gate: boolean
  progress: string
  done: { step: string; tool: string; result: string }[]
  todo: string[]
  notes: string
}

export function phaseSummary(p: DmaicProject, id: PhaseId): PhaseSummary {
  const ph = PHASES.find((x) => x.id === id)!
  const pr = phaseProgress(p, id)
  const done: PhaseSummary['done'] = []
  const todo: string[] = []
  for (const s of stepsFor(ph, isLight(p)))
    for (const t of s.tools) {
      const k = doneKey(s, t)
      const name = t.role ?? toolById(t.id)!.name
      if (p.done?.[k]) done.push({ step: s.n, tool: name, result: p.results?.[k]?.trim() ?? '' })
      else if (p.results?.[k]?.trim()) done.push({ step: s.n, tool: name, result: p.results[k].trim() })
      else todo.push(`${s.n} ${name}`)
    }
  return { id, title: `${ph.n}. ${ph.label} — ${ph.marp}`, gate: !!p.gates[id], progress: `${pr.done} / ${pr.total} outils faits`, done, todo, notes: p.notes[id] ?? '' }
}

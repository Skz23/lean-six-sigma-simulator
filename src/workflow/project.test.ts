import { describe, expect, it } from 'vitest'
import { PHASES } from './phases'
import { LIGHT_TOOLS, doneKey, emptyProject, isLight, keyResults, nextTodo, phaseProgress, projectProgress, stepsFor } from './project'
import { TOOLS } from './phases'

describe('suivi de projet', () => {
  it('un projet neuf démarre en Définir, sans avancement', () => {
    const p = emptyProject('p1', 'Test', 'sc', 'dmaic')
    expect(p.phase).toBe('define')
    expect(projectProgress(p).done).toBe(0)
    expect(projectProgress(p).total).toBe(PHASES.reduce((n, ph) => n + ph.steps.reduce((m, s) => m + s.tools.length, 0), 0))
  })
  it('le parcours allégé garde au moins un outil par phase et uniquement des outils connus', () => {
    for (const id of LIGHT_TOOLS) expect(TOOLS.some((t) => t.id === id), id).toBe(true)
    for (const ph of PHASES) {
      const light = stepsFor(ph, true)
      expect(light.length, ph.id).toBeGreaterThan(0)
      expect(light.flatMap((s) => s.tools).length).toBeLessThan(stepsFor(ph, false).flatMap((s) => s.tools).length + 1)
    }
    const k = emptyProject('p', 'K', 'sc', 'kaizen')
    expect(isLight(k)).toBe(true)
    expect(projectProgress(k).total).toBeLessThan(projectProgress(emptyProject('q', 'D', 'sc', 'dmaic')).total)
  })
  it('cocher un outil fait avancer la phase et propose l\'outil suivant', () => {
    const p = emptyProject('p1', 'Test', 'sc', 'dmaic')
    const def = PHASES[0]
    const first = def.steps[0]
    const [a, b] = nextTodo(p, 2)
    expect(a.tool.id).toBe(first.tools[0].id)
    p.done = { [doneKey(first, first.tools[0])]: true }
    expect(phaseProgress(p, 'define').done).toBe(1)
    expect(nextTodo(p, 1)[0].tool.id).toBe(b.tool.id)
  })
  it('les résultats retenus sont listés dans l\'ordre de la démarche', () => {
    const p = emptyProject('p1', 'Test', 'sc', 'dmaic')
    const m = PHASES[1].steps[1]
    const d = PHASES[0].steps[0]
    p.results = { [doneKey(m, m.tools[0])]: '%R&R = 14 %', [doneKey(d, d.tools[0])]: 'Rebuts 6 %', x: '  ' }
    expect(keyResults(p).map((r) => r.value)).toEqual(['Rebuts 6 %', '%R&R = 14 %'])
  })
})

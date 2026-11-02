import { it, expect } from 'vitest'
import { createInitialScenario, applyLssImprovements } from '../data/demo'
import { demoTools } from '../data/demoTools'
import { simulate } from '../engine/simulation'
import { computeKpis } from '../engine/kpi'
import { generateReport, SECTIONS } from './pdf'

it('génère un rapport PDF complet', async () => {
  const b = createInitialScenario()
  const a = applyLssImprovements(b)
  const rb = simulate(b)
  const ra = simulate(a)
  const doc = await generateReport(
    { title: 'Rapport test', author: 'Test', before: { sc: b, r: rb, k: computeKpis(b, rb) }, after: { sc: a, r: ra, k: computeKpis(a, ra) }, tools: demoTools(b.id), sections: SECTIONS.map(() => true) },
    false,
  )
  expect(doc.getNumberOfPages()).toBeGreaterThan(11)
})

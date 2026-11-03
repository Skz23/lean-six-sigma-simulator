import { describe, expect, it } from 'vitest'
import { demoDmaic, demoTools } from '../data/demoTools'
import { emptyProject } from '../workflow/project'
import { emptyWorkspace } from '../store/useStore'
import { LESSONS, PHASE_LESSONS } from '../workflow/lessons'
import { PHASES, TOOLS } from '../workflow/phases'
import { a3Blocks, d8Blocks, phaseSummary } from './projectContent'
import { a3Report, eightDReport, projectReport } from './projectPdf'

const demo = () => {
  const t = demoTools('sc')
  return { p: demoDmaic('sc'), ws: { fmea: t.fmea, defectLog: t.defectLog, kaizen: t.kaizen, mrp: t.mrp } }
}

describe('livrables du projet', () => {
  it('chaque outil et chaque phase a son rappel de cours', () => {
    for (const t of TOOLS) {
      expect(LESSONS[t.id], t.id).toBeDefined()
      expect(LESSONS[t.id].how.length, t.id).toBeGreaterThan(0)
    }
    for (const p of PHASES) expect(PHASE_LESSONS[p.id].pitfalls.length).toBeGreaterThan(0)
  })
  it('A3 et 8D se remplissent à partir des données du projet', () => {
    const { p, ws } = demo()
    const a3 = a3Blocks(p, ws)
    expect(a3).toHaveLength(8)
    expect(a3[0].text).toContain('non-qualité') // enjeu de la charte
    expect(a3[3].text).toContain('Pareto') // registre des défauts
    expect(a3[3].text).toContain('Diamètre hors tolérance')
    const d8 = d8Blocks(p, ws)
    expect(d8).toHaveLength(9)
    expect(d8[2].text).toContain(p.charter.problem.slice(0, 20))
  })
  it('un projet vide donne des cadres « à compléter », sans erreur', () => {
    const p = emptyProject('x', 'Vide', 'sc', 'kaizen')
    const ws = emptyWorkspace()
    expect(a3Blocks(p, ws).every((b) => b.text === 'À compléter.')).toBe(true)
    expect(phaseSummary(p, 'define').done).toEqual([])
  })
  it('ce qui est écrit à la main dans la fiche A3 est prioritaire', () => {
    const { p, ws } = demo()
    const s = structuredClone(ws)
    s.mrp = { sheets: [{ id: 's', title: 't', createdAt: '', method: 'a3', qqoqcpc: { quoi: '', qui: '', ou: '', quand: '', comment: '', pourquoi: '', combien: '' }, indicator: '', d8: [], a3: { objectif: 'Mon objectif' }, ideas: [], criteria: [], scores: {} }], kano: [] }
    expect(a3Blocks(p, s)[2].text).toBe('Mon objectif')
  })
  it('les trois PDF se génèrent', async () => {
    const { p, ws } = demo()
    for (const doc of [await projectReport(p, ws, { save: false }), await projectReport(p, ws, { phase: 'define', save: false }), await a3Report(p, ws, false), await eightDReport(p, ws, false)]) {
      expect(doc.getNumberOfPages()).toBeGreaterThan(0)
    }
  })
})

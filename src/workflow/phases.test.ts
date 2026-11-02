import { describe, expect, it } from 'vitest'
import appSrc from '../App.tsx?raw'
import method from '../pages/MethodPage.tsx?raw'
import defects from '../pages/sixsigma/DefectsPage.tsx?raw'
import stats from '../pages/sixsigma/StatsPage.tsx?raw'
import msa from '../pages/sixsigma/MsaPage.tsx?raw'
import { PHASES, TOOLS, stepsOf, toolById, toolsAt } from './phases'

const routes = [...appSrc.matchAll(/path="([^"]+)"/g)].map((m) => '/' + m[1])
const pageTabs: Record<string, string> = { '/methode': method, '/sixsigma/defects': defects, '/sixsigma/stats': stats, '/sixsigma/msa': msa }
const tabsOf = (src: string) => src.match(/const TABS = \[([^\]]+)\]/)![1]

describe('démarche DMAIC : phases, sous-étapes et outils', () => {
  it('chaque outil pointe vers une route existante (et un onglet valide en mode outil seul)', () => {
    for (const t of TOOLS) {
      const path = t.to.split('?')[0]
      if (routes.includes(path)) continue
      const base = path.replace(/\/[^/]+$/, '')
      expect(routes, t.id).toContain(base + '/:tab')
      expect(tabsOf(pageTabs[base]), t.id).toContain(`'${path.split('/').pop()}'`)
    }
  })
  it('chaque phase a 4 sous-étapes numérotées, chacune avec au moins un outil connu', () => {
    for (const p of PHASES) {
      expect(p.steps.length, p.id).toBe(4)
      p.steps.forEach((s, i) => {
        expect(s.n).toBe(`${p.n}.${i + 1}`)
        expect(s.tools.length).toBeGreaterThan(0)
        for (const x of s.tools) expect(toolById(x.id), x.id).toBeDefined()
      })
    }
  })
  it('chaque outil est rangé dans au moins une étape ; un outil présent plusieurs fois a un rôle à chaque fois', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length)
    for (const t of TOOLS) {
      const occ = stepsOf(t.id)
      expect(occ.length, t.id).toBeGreaterThan(0)
      if (occ.length > 1) for (const o of occ) expect(o.role, `${t.id} en ${o.step.n}`).toBeTruthy()
    }
  })
  it('retrouve l\'outil à partir de l\'adresse', () => {
    expect(toolsAt('/sixsigma/stats/anova', '').map((t) => t.id)).toEqual(['anova'])
    expect(toolsAt('/lean/smed', '').map((t) => t.id)).toEqual(['smed'])
    expect(toolsAt('/sixsigma/dmaic', '?phase=control').map((t) => t.id)).toEqual(['control-plan'])
    expect(toolsAt('/inconnu', '')).toEqual([])
  })
})

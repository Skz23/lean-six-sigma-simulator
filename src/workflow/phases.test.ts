import { describe, expect, it } from 'vitest'
import appSrc from '../App.tsx?raw'
import method from '../pages/MethodPage.tsx?raw'
import defects from '../pages/sixsigma/DefectsPage.tsx?raw'
import stats from '../pages/sixsigma/StatsPage.tsx?raw'
import msa from '../pages/sixsigma/MsaPage.tsx?raw'
import { PHASES, TOOLS, toolsAt, toolsOf } from './phases'

const routes = [...appSrc.matchAll(/path="([^"]+)"/g)].map((m) => '/' + m[1])
const pageTabs: Record<string, string> = { '/methode': method, '/sixsigma/defects': defects, '/sixsigma/stats': stats, '/sixsigma/msa': msa }

describe('catalogue des outils DMAIC', () => {
  it('chaque outil pointe vers une route existante et un onglet valide', () => {
    for (const t of TOOLS) {
      const [path, q] = t.to.split('?')
      expect(routes, t.id).toContain(path)
      if (q) {
        const tab = new URLSearchParams(q).get('tab')!
        expect(pageTabs[path], t.id).toBeDefined()
        expect(pageTabs[path].match(/const TABS = \[([^\]]+)\]/)![1], t.id).toContain(`'${tab}'`)
      }
    }
  })
  it('chaque phase a au moins un outil incontournable', () => {
    for (const p of PHASES) expect(toolsOf(p.id).some((t) => t.key?.includes(p.id)), p.id).toBe(true)
  })
  it('les identifiants sont uniques et les outils clés appartiennent à leur phase', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length)
    for (const t of TOOLS) for (const k of t.key ?? []) expect(t.phases).toContain(k)
  })
  it('retrouve l\'outil à partir de l\'adresse', () => {
    expect(toolsAt('/sixsigma/stats', '?tab=anova').map((t) => t.id)).toEqual(['anova'])
    expect(toolsAt('/lean/smed', '').map((t) => t.id)).toEqual(['smed'])
    expect(toolsAt('/inconnu', '')).toEqual([])
  })
})

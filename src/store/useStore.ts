/**
 * État global persistant (localStorage). La couche de persistance est isolée ici :
 * elle peut être remplacée par une API/base de données sans toucher aux pages.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Scenario } from '../engine/types'
import { demoScenarios } from '../data/demo'
import { demoTools } from '../data/demoTools'
import type { ToolsState, WidgetId } from './types'
import { DASHBOARD_WIDGETS } from './types'

export interface Version {
  id: string
  at: string
  label: string
  scenario: Scenario
}

interface State {
  scenarios: Scenario[]
  activeId: string
  versions: Record<string, Version[]>
  tools: ToolsState
  theme: 'light' | 'dark'
  widgets: WidgetId[]
  baselineId: string
  comparisonId: string
  setActive: (id: string) => void
  updateScenario: (id: string, fn: (s: Scenario) => void, versionLabel?: string) => void
  addScenario: (s: Scenario) => void
  duplicateScenario: (id: string, name?: string) => string
  deleteScenario: (id: string) => void
  saveVersion: (id: string, label: string) => void
  restoreVersion: (id: string, versionId: string) => void
  setTools: (fn: (t: ToolsState) => void) => void
  toggleTheme: () => void
  setWidgets: (w: WidgetId[]) => void
  setBaseline: (id: string) => void
  setComparison: (id: string) => void
  resetDemo: () => void
  importAll: (data: Partial<State>) => void
}

export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

function initial() {
  const sc = demoScenarios()
  return {
    scenarios: sc,
    activeId: sc[0].id,
    versions: {} as Record<string, Version[]>,
    tools: demoTools(sc[0].id),
    baselineId: sc[0].id,
    comparisonId: sc[3].id,
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(),
      theme: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      widgets: DASHBOARD_WIDGETS.map((w) => w.id),
      setActive: (id) => set({ activeId: id }),
      updateScenario: (id, fn, versionLabel) =>
        set((st) => {
          const scenarios = st.scenarios.map((s) => {
            if (s.id !== id) return s
            const c = clone(s)
            fn(c)
            c.updatedAt = new Date().toISOString()
            return c
          })
          let versions = st.versions
          if (versionLabel) {
            const prev = st.scenarios.find((s) => s.id === id)!
            const list = [{ id: uid('v'), at: new Date().toISOString(), label: versionLabel, scenario: clone(prev) }, ...(st.versions[id] ?? [])].slice(0, 30)
            versions = { ...st.versions, [id]: list }
          }
          return { scenarios, versions }
        }),
      addScenario: (s) => set((st) => ({ scenarios: [...st.scenarios, s], activeId: s.id })),
      duplicateScenario: (id, name) => {
        const src = get().scenarios.find((s) => s.id === id)!
        const c = clone(src)
        c.id = uid('sc')
        c.name = name ?? `${src.name} (copie)`
        c.kind = 'custom'
        c.createdAt = c.updatedAt = new Date().toISOString()
        set((st) => ({ scenarios: [...st.scenarios, c], activeId: c.id }))
        return c.id
      },
      deleteScenario: (id) =>
        set((st) => {
          if (st.scenarios.length <= 1) return st
          const scenarios = st.scenarios.filter((s) => s.id !== id)
          const fallback = scenarios[0].id
          return {
            scenarios,
            activeId: st.activeId === id ? fallback : st.activeId,
            baselineId: st.baselineId === id ? fallback : st.baselineId,
            comparisonId: st.comparisonId === id ? fallback : st.comparisonId,
          }
        }),
      saveVersion: (id, label) =>
        set((st) => {
          const s = st.scenarios.find((x) => x.id === id)
          if (!s) return st
          const list = [{ id: uid('v'), at: new Date().toISOString(), label, scenario: clone(s) }, ...(st.versions[id] ?? [])].slice(0, 30)
          return { versions: { ...st.versions, [id]: list } }
        }),
      restoreVersion: (id, versionId) =>
        set((st) => {
          const v = st.versions[id]?.find((x) => x.id === versionId)
          if (!v) return st
          const current = st.scenarios.find((x) => x.id === id)!
          const backup = { id: uid('v'), at: new Date().toISOString(), label: 'Avant restauration', scenario: clone(current) }
          return {
            scenarios: st.scenarios.map((s) => (s.id === id ? { ...clone(v.scenario), id, updatedAt: new Date().toISOString() } : s)),
            versions: { ...st.versions, [id]: [backup, ...st.versions[id]].slice(0, 30) },
          }
        }),
      setTools: (fn) =>
        set((st) => {
          const t = clone(st.tools)
          fn(t)
          return { tools: t }
        }),
      toggleTheme: () => set((st) => ({ theme: st.theme === 'dark' ? 'light' : 'dark' })),
      setWidgets: (w) => set({ widgets: w }),
      setBaseline: (id) => set({ baselineId: id }),
      setComparison: (id) => set({ comparisonId: id }),
      resetDemo: () => set({ ...initial() }),
      importAll: (data) => set((st) => ({ ...st, ...data })),
    }),
    {
      name: 'lss-simulator-v1',
      version: 1,
      // Stockage tolérant : si localStorage est indisponible, l'application fonctionne sans persistance
      storage: createJSONStorage(() => ({
        getItem: (k: string) => {
          try {
            return localStorage.getItem(k)
          } catch {
            return null
          }
        },
        setItem: (k: string, v: string) => {
          try {
            localStorage.setItem(k, v)
          } catch {
            /* ignoré */
          }
        },
        removeItem: (k: string) => {
          try {
            localStorage.removeItem(k)
          } catch {
            /* ignoré */
          }
        },
      })),
    },
  ),
)

export function useActiveScenario(): Scenario {
  return useStore((s) => s.scenarios.find((x) => x.id === s.activeId) ?? s.scenarios[0])
}

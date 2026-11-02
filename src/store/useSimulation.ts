import { useMemo } from 'react'
import type { Scenario, SimResults } from '../engine/types'
import { simulate } from '../engine/simulation'
import { computeKpis, type Kpis } from '../engine/kpi'

export interface Run {
  results: SimResults
  kpis: Kpis
}

const cache = new Map<string, Run>()

function keyOf(sc: Scenario): string {
  const { name: _n, description: _d, updatedAt: _u, createdAt: _c, company: _co, actions: _a, kind: _k, ...rest } = sc
  return JSON.stringify(rest)
}

/** Exécute (ou récupère du cache) la simulation d'une journée pour un scénario. */
export function runScenario(sc: Scenario): Run {
  const k = keyOf(sc)
  const hit = cache.get(k)
  if (hit) return hit
  const results = simulate(sc)
  const run = { results, kpis: computeKpis(sc, results) }
  cache.set(k, run)
  if (cache.size > 40) cache.delete(cache.keys().next().value!)
  return run
}

export function useSimulation(sc: Scenario): Run {
  return useMemo(() => runScenario(sc), [sc])
}

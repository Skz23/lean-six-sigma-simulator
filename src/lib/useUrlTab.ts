import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toolsAt, type Tool } from '../workflow/phases'

/**
 * Onglet courant d'une page multi-outils.
 * - /page/:tab  → mode « outil seul » (solo) : un seul outil affiché, sans barre d'onglets.
 * - /page?tab=… → page complète à onglets (adresses historiques).
 */
export function useUrlTab<T extends string>(def: T, valid: readonly T[]): [T, (t: T) => void, boolean] {
  const { tab: routeTab } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const loc = useLocation()
  if (routeTab && valid.includes(routeTab as T)) {
    const set = (t: T) => nav(loc.pathname.replace(/[^/]+$/, t), { replace: true })
    return [routeTab as T, set, true]
  }
  const raw = params.get('tab') as T | null
  const tab = raw && valid.includes(raw) ? raw : def
  const set = (t: T) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('tab', t)
        return n
      },
      { replace: true },
    )
  return [tab, set, false]
}

/** Outil du catalogue affiché à l'adresse courante (s'il est unique). */
export function useCurrentTool(): Tool | undefined {
  const loc = useLocation()
  const t = toolsAt(loc.pathname, loc.search)
  return t.length === 1 ? t[0] : undefined
}

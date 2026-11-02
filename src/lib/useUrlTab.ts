import { useSearchParams } from 'react-router-dom'

/** Onglet courant lu dans l'adresse (?tab=…), pour pouvoir ouvrir un outil directement depuis une phase. */
export function useUrlTab<T extends string>(def: T, valid: readonly T[]): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams()
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
  return [tab, set]
}

import { describe, expect, it } from 'vitest'
import { createInitialScenario } from '../data/demo'
import { pathLength, spaghettiAnalysis } from './tools'

describe('diagramme spaghetti', () => {
  it('longueur d\'un trajet tracé', () => {
    expect(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBeCloseTo(11, 9)
  })
  it('un trajet tracé remplace la distance rectilinéaire', () => {
    const sc = createInitialScenario()
    const r = sc.operatorRoutes[0]
    const before = spaghettiAnalysis(sc).routes[0]
    r.path = [{ x: 0, y: 0 }, { x: 0, y: 12.5 }]
    const after = spaghettiAnalysis(sc).routes[0]
    expect(after.distance).toBeCloseTo(12.5, 9)
    expect(after.daily).toBeCloseTo(12.5 * 2 * r.tripsPerShift, 9)
    expect(after.distance).not.toBeCloseTo(before.distance, 3)
  })
})

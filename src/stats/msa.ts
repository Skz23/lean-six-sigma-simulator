/**
 * Analyse du système de mesure (MSA).
 *  - Étude R&R croisée par ANOVA à deux facteurs (pièce × opérateur, avec interaction),
 *    méthode préférée dans le cours (identique à Minitab / AIAG MSA 4e éd.).
 *  - Méthode de Charbonneau (capabilité du moyen de contrôle Cmc), cours ENSGSI.
 */
import { fCdf } from './distributions'
import { d2 } from './spc'

/** data[p][o][r] : mesure de la pièce p par l'opérateur o, répétition r. */
export type GageData = number[][][]

export interface GageComponent {
  source: string
  variance: number
  sd: number
  /** % de contribution (variance). */
  contribution: number
  /** % de la variation de l'étude (écart-type / écart-type total). */
  studyVar: number
  /** % de la tolérance (6σ / IT), si IT fourni. */
  tolerance?: number
}

export interface GageResult {
  parts: number
  operators: number
  replicates: number
  anova: { source: string; df: number; ss: number; ms: number; F?: number; p?: number }[]
  interactionPooled: boolean
  components: GageComponent[]
  /** %R&R = σ R&R / σ total (définition du cours). */
  pctRR: number
  pctTolerance?: number
  /** Nombre de catégories distinctes. */
  ndc: number
  verdict: 'souhaitable' | 'acceptable' | 'conditionnel' | 'à améliorer'
  operatorMeans: number[]
  partMeans: number[]
  /** Moyennes pièce × opérateur (graphique d'interaction). */
  cellMeans: number[][]
}

const sq = (x: number) => x * x

export function gageRR(data: GageData, tolerance?: number, alphaInteraction = 0.05): GageResult {
  const p = data.length
  const o = data[0].length
  const r = data[0][0].length
  if (p < 2 || o < 2 || r < 2) throw new Error('Il faut au moins 2 pièces, 2 opérateurs et 2 répétitions.')
  const all = data.flat(2)
  const grand = all.reduce((a, b) => a + b, 0) / all.length
  const cell = data.map((pp) => pp.map((oo) => oo.reduce((a, b) => a + b, 0) / r))
  const partMeans = cell.map((row) => row.reduce((a, b) => a + b, 0) / o)
  const opMeans = Array.from({ length: o }, (_, j) => cell.reduce((a, row) => a + row[j], 0) / p)
  const ssP = o * r * partMeans.reduce((a, m) => a + sq(m - grand), 0)
  const ssO = p * r * opMeans.reduce((a, m) => a + sq(m - grand), 0)
  let ssPO = 0
  let ssE = 0
  for (let i = 0; i < p; i++)
    for (let j = 0; j < o; j++) {
      ssPO += r * sq(cell[i][j] - partMeans[i] - opMeans[j] + grand)
      for (const y of data[i][j]) ssE += sq(y - cell[i][j])
    }
  const dfP = p - 1
  const dfO = o - 1
  const dfPO = dfP * dfO
  const dfE = p * o * (r - 1)
  const msP = ssP / dfP
  const msO = ssO / dfO
  const msPO = ssPO / dfPO
  const msE = ssE / dfE
  const fPO = msPO / msE
  const pPO = 1 - fCdf(fPO, dfPO, dfE)
  const pooled = pPO > alphaInteraction
  let vRep: number
  let vO: number
  let vPO: number
  let vP: number
  const anova: GageResult['anova'] = []
  if (!pooled) {
    vRep = msE
    vPO = Math.max(0, (msPO - msE) / r)
    vO = Math.max(0, (msO - msPO) / (p * r))
    vP = Math.max(0, (msP - msPO) / (o * r))
    anova.push(
      { source: 'Pièce', df: dfP, ss: ssP, ms: msP, F: msP / msPO, p: 1 - fCdf(msP / msPO, dfP, dfPO) },
      { source: 'Opérateur', df: dfO, ss: ssO, ms: msO, F: msO / msPO, p: 1 - fCdf(msO / msPO, dfO, dfPO) },
      { source: 'Pièce × Opérateur', df: dfPO, ss: ssPO, ms: msPO, F: fPO, p: pPO },
      { source: 'Répétabilité', df: dfE, ss: ssE, ms: msE },
    )
  } else {
    const dfR = dfPO + dfE
    const msR = (ssPO + ssE) / dfR
    vRep = msR
    vPO = 0
    vO = Math.max(0, (msO - msR) / (p * r))
    vP = Math.max(0, (msP - msR) / (o * r))
    anova.push(
      { source: 'Pièce', df: dfP, ss: ssP, ms: msP, F: msP / msR, p: 1 - fCdf(msP / msR, dfP, dfR) },
      { source: 'Opérateur', df: dfO, ss: ssO, ms: msO, F: msO / msR, p: 1 - fCdf(msO / msR, dfO, dfR) },
      { source: 'Répétabilité (interaction regroupée)', df: dfR, ss: ssPO + ssE, ms: msR },
    )
  }
  anova.push({ source: 'Total', df: p * o * r - 1, ss: ssP + ssO + ssPO + ssE, ms: NaN })
  const vReprod = vO + vPO
  const vRR = vRep + vReprod
  const vTot = vRR + vP
  const comp = (source: string, v: number): GageComponent => ({
    source,
    variance: v,
    sd: Math.sqrt(v),
    contribution: v / vTot,
    studyVar: Math.sqrt(v / vTot),
    tolerance: tolerance ? (6 * Math.sqrt(v)) / tolerance : undefined,
  })
  const components = [
    comp('R&R total (système de mesure)', vRR),
    comp('Répétabilité (instrument)', vRep),
    comp('Reproductibilité (opérateurs)', vReprod),
    ...(pooled ? [] : [comp('Opérateur × pièce', vPO)]),
    comp('Pièce à pièce', vP),
    comp('Variation totale', vTot),
  ]
  const pctRR = Math.sqrt(vRR / vTot)
  return {
    parts: p,
    operators: o,
    replicates: r,
    anova,
    interactionPooled: pooled,
    components,
    pctRR,
    pctTolerance: tolerance ? (6 * Math.sqrt(vRR)) / tolerance : undefined,
    ndc: vRR > 0 ? Math.max(1, Math.floor(1.41 * Math.sqrt(vP / vRR))) : Infinity,
    verdict: pctRR < 0.1 ? 'souhaitable' : pctRR < 0.2 ? 'acceptable' : pctRR < 0.3 ? 'conditionnel' : 'à améliorer',
    operatorMeans: opMeans,
    partMeans,
    cellMeans: cell,
  }
}

export interface CharbonneauResult {
  ranges: number[]
  rbar: number
  sigma: number
  dispersion: number
  cmc: number
  verdict: 'capable' | 'à surveiller' | 'non capable'
}

/**
 * Méthode de Charbonneau (cours ENSGSI) : chaque pièce est mesurée une fois par 2 ou 3 contrôleurs ;
 * σ mesure = R̄ / d2 (n = nombre de contrôleurs), dispersion = 6σ, Cmc = IT / dispersion.
 * Cmc > 4 : moyen capable ; Cmc < 3 : à améliorer.
 */
export function charbonneau(rows: number[][], tolerance: number): CharbonneauResult {
  const n = rows[0]?.length ?? 0
  if (n < 2 || n > 10) throw new Error('2 à 10 contrôleurs par pièce.')
  const ranges = rows.map((r) => Math.max(...r) - Math.min(...r))
  const rbar = ranges.reduce((a, b) => a + b, 0) / ranges.length
  const sigma = rbar / d2(n)
  const dispersion = 6 * sigma
  const cmc = tolerance / dispersion
  return { ranges, rbar, sigma, dispersion, cmc, verdict: cmc > 4 ? 'capable' : cmc >= 3 ? 'à surveiller' : 'non capable' }
}

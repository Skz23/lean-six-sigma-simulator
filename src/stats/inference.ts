/**
 * Statistiques inférentielles : tests d'hypothèses, ANOVA, corrélation,
 * régression linéaire (simple et multiple), test de normalité.
 */
import { chi2Cdf, fCdf, normalCdf, tCdf, tInv } from './distributions'
import { mean, sorted, stdDev, sum, variance } from './descriptive'

export type Alternative = 'two-sided' | 'less' | 'greater'

export interface TestResult {
  name: string
  statistic: number
  statisticName: string
  df?: number
  df2?: number
  pValue: number
  ci?: [number, number]
  estimate?: number
  alpha: number
  reject: boolean
  conclusion: string
}

function pFromT(t: number, df: number, alt: Alternative): number {
  if (alt === 'two-sided') return 2 * (1 - tCdf(Math.abs(t), df))
  if (alt === 'greater') return 1 - tCdf(t, df)
  return tCdf(t, df)
}

function pFromZ(z: number, alt: Alternative): number {
  if (alt === 'two-sided') return 2 * (1 - normalCdf(Math.abs(z)))
  if (alt === 'greater') return 1 - normalCdf(z)
  return normalCdf(z)
}

const conclude = (p: number, alpha: number, h1: string, h0: string) =>
  p < alpha
    ? `${pEq(p)} < α = ${alpha} : on rejette H0. ${h1}`
    : `${pEq(p)} ≥ α = ${alpha} : on ne peut pas rejeter H0. ${h0}`

export const fmtP = (p: number) => (p < 0.0001 ? '< 0,0001' : p.toFixed(4).replace('.', ','))
/** « p = 0,0123 » ou « p < 0,0001 » */
export const pEq = (p: number) => (p < 0.0001 ? 'p < 0,0001' : `p = ${fmtP(p)}`)

/** Test t à un échantillon : H0 μ = μ0. */
export function tTestOneSample(xs: number[], mu0: number, alpha = 0.05, alt: Alternative = 'two-sided'): TestResult {
  const n = xs.length
  const m = mean(xs)
  const se = stdDev(xs) / Math.sqrt(n)
  const t = (m - mu0) / se
  const df = n - 1
  const p = pFromT(t, df, alt)
  const tc = tInv(1 - alpha / 2, df)
  return {
    name: 'Test t à un échantillon',
    statistic: t,
    statisticName: 't',
    df,
    pValue: p,
    estimate: m,
    ci: [m - tc * se, m + tc * se],
    alpha,
    reject: p < alpha,
    conclusion: conclude(p, alpha, `La moyenne diffère significativement de ${mu0}.`, `Aucune preuve que la moyenne diffère de ${mu0}.`),
  }
}

/** Test t à deux échantillons indépendants (Welch par défaut, variances non supposées égales). */
export function tTestTwoSample(a: number[], b: number[], alpha = 0.05, alt: Alternative = 'two-sided', pooled = false): TestResult {
  const n1 = a.length
  const n2 = b.length
  const v1 = variance(a)
  const v2 = variance(b)
  const diff = mean(a) - mean(b)
  let se: number
  let df: number
  if (pooled) {
    const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2)
    se = Math.sqrt(sp2 * (1 / n1 + 1 / n2))
    df = n1 + n2 - 2
  } else {
    se = Math.sqrt(v1 / n1 + v2 / n2)
    df = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1))
  }
  const t = diff / se
  const p = pFromT(t, df, alt)
  const tc = tInv(1 - alpha / 2, df)
  return {
    name: pooled ? 'Test t à deux échantillons (variances égales)' : 'Test t de Welch à deux échantillons',
    statistic: t,
    statisticName: 't',
    df,
    pValue: p,
    estimate: diff,
    ci: [diff - tc * se, diff + tc * se],
    alpha,
    reject: p < alpha,
    conclusion: conclude(p, alpha, 'Les deux moyennes sont significativement différentes.', 'Aucune différence significative entre les moyennes.'),
  }
}

/** Test t apparié. */
export function tTestPaired(a: number[], b: number[], alpha = 0.05, alt: Alternative = 'two-sided'): TestResult {
  const d = a.map((x, i) => x - b[i])
  const r = tTestOneSample(d, 0, alpha, alt)
  return { ...r, name: 'Test t apparié', conclusion: conclude(r.pValue, alpha, 'La différence moyenne entre paires est significative.', 'Aucune différence significative entre paires.') }
}

/** Test F d'égalité de deux variances. */
export function fTestVariances(a: number[], b: number[], alpha = 0.05): TestResult {
  const v1 = variance(a)
  const v2 = variance(b)
  const F = v1 / v2
  const d1 = a.length - 1
  const d2 = b.length - 1
  const cdf = fCdf(F, d1, d2)
  const p = 2 * Math.min(cdf, 1 - cdf)
  return {
    name: 'Test F d\'égalité des variances',
    statistic: F,
    statisticName: 'F',
    df: d1,
    df2: d2,
    pValue: p,
    estimate: F,
    alpha,
    reject: p < alpha,
    conclusion: conclude(p, alpha, 'Les dispersions sont significativement différentes.', 'Aucune différence significative de dispersion.'),
  }
}

/** Test z de comparaison de deux proportions (ex. taux de défauts avant/après). */
export function twoProportionTest(x1: number, n1: number, x2: number, n2: number, alpha = 0.05, alt: Alternative = 'two-sided'): TestResult {
  const p1 = x1 / n1
  const p2 = x2 / n2
  const p = (x1 + x2) / (n1 + n2)
  const z = (p1 - p2) / Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
  const pv = pFromZ(z, alt)
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2)
  return {
    name: 'Test de comparaison de deux proportions',
    statistic: z,
    statisticName: 'z',
    pValue: pv,
    estimate: p1 - p2,
    ci: [p1 - p2 - 1.959964 * se, p1 - p2 + 1.959964 * se],
    alpha,
    reject: pv < alpha,
    conclusion: conclude(pv, alpha, 'Les proportions diffèrent significativement.', 'Aucune différence significative entre les proportions.'),
  }
}

/** Test du χ² d'indépendance sur un tableau de contingence. */
export function chiSquareIndependence(table: number[][], alpha = 0.05): TestResult {
  const rows = table.map(sum)
  const cols = table[0].map((_, j) => sum(table.map((r) => r[j])))
  const total = sum(rows)
  let chi = 0
  table.forEach((r, i) =>
    r.forEach((o, j) => {
      const e = (rows[i] * cols[j]) / total
      if (e > 0) chi += (o - e) ** 2 / e
    }),
  )
  const df = (rows.length - 1) * (cols.length - 1)
  const p = 1 - chi2Cdf(chi, df)
  return {
    name: 'Test du χ² d\'indépendance',
    statistic: chi,
    statisticName: 'χ²',
    df,
    pValue: p,
    alpha,
    reject: p < alpha,
    conclusion: conclude(p, alpha, 'Les deux variables sont dépendantes.', 'Aucune preuve de dépendance.'),
  }
}

export interface AnovaResult {
  groups: { name: string; n: number; mean: number; sd: number }[]
  ssBetween: number
  ssWithin: number
  ssTotal: number
  dfBetween: number
  dfWithin: number
  msBetween: number
  msWithin: number
  F: number
  pValue: number
  rSquared: number
  alpha: number
  reject: boolean
  conclusion: string
}

/** ANOVA à un facteur. */
export function anovaOneWay(groups: number[][], names?: string[], alpha = 0.05): AnovaResult {
  const all = groups.flat()
  const gm = mean(all)
  const k = groups.length
  const N = all.length
  let ssb = 0
  let ssw = 0
  for (const g of groups) {
    const m = mean(g)
    ssb += g.length * (m - gm) ** 2
    for (const x of g) ssw += (x - m) ** 2
  }
  const dfb = k - 1
  const dfw = N - k
  const msb = ssb / dfb
  const msw = ssw / dfw
  const F = msb / msw
  const p = 1 - fCdf(F, dfb, dfw)
  return {
    groups: groups.map((g, i) => ({ name: names?.[i] ?? `Groupe ${i + 1}`, n: g.length, mean: mean(g), sd: stdDev(g) })),
    ssBetween: ssb,
    ssWithin: ssw,
    ssTotal: ssb + ssw,
    dfBetween: dfb,
    dfWithin: dfw,
    msBetween: msb,
    msWithin: msw,
    F,
    pValue: p,
    rSquared: ssb / (ssb + ssw),
    alpha,
    reject: p < alpha,
    conclusion: conclude(p, alpha, 'Au moins une moyenne de groupe diffère des autres.', 'Aucune différence significative entre les moyennes des groupes.'),
  }
}

export interface CorrelationResult {
  r: number
  r2: number
  t: number
  pValue: number
  n: number
  strength: string
}

/** Corrélation de Pearson avec test de significativité (H0 : ρ = 0). */
export function pearson(x: number[], y: number[]): CorrelationResult {
  const n = x.length
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  const r = sxy / Math.sqrt(sxx * syy)
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(Math.max(1e-300, 1 - r * r))
  const p = 2 * (1 - tCdf(Math.abs(t), n - 2))
  const a = Math.abs(r)
  const strength = a >= 0.8 ? 'très forte' : a >= 0.6 ? 'forte' : a >= 0.4 ? 'modérée' : a >= 0.2 ? 'faible' : 'négligeable'
  return { r, r2: r * r, t, pValue: p, n, strength }
}

// ---------- Algèbre linéaire minimale ----------
export function transpose(m: number[][]): number[][] {
  return m[0].map((_, j) => m.map((r) => r[j]))
}
export function matMul(a: number[][], b: number[][]): number[][] {
  return a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)))
}
/** Inversion par Gauss-Jordan avec pivot partiel. */
export function invert(m: number[][]): number[][] {
  const n = m.length
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r
    if (Math.abs(a[piv][c]) < 1e-12) throw new Error('Matrice singulière (facteurs colinéaires ?)')
    ;[a[c], a[piv]] = [a[piv], a[c]]
    const d = a[c][c]
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = a[r][c]
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j]
    }
  }
  return a.map((r) => r.slice(n))
}

export interface RegressionTerm {
  name: string
  coef: number
  se: number
  t: number
  pValue: number
}

export interface RegressionResult {
  terms: RegressionTerm[]
  rSquared: number
  adjRSquared: number
  s: number
  F: number
  pValue: number
  n: number
  residuals: number[]
  fitted: number[]
  predict: (x: number[]) => number
  equation: string
}

/** Régression linéaire multiple par moindres carrés ordinaires : β = (XᵀX)⁻¹Xᵀy. */
export function linearRegression(X: number[][], y: number[], names: string[], yName = 'Y'): RegressionResult {
  const n = y.length
  const p = names.length + 1
  const D = X.map((r) => [1, ...r])
  const Dt = transpose(D)
  const XtXi = invert(matMul(Dt, D))
  const beta = matMul(XtXi, matMul(Dt, y.map((v) => [v]))).map((r) => r[0])
  const fitted = D.map((r) => r.reduce((s, v, k) => s + v * beta[k], 0))
  const residuals = y.map((v, i) => v - fitted[i])
  const sse = sum(residuals.map((e) => e * e))
  const my = mean(y)
  const sst = sum(y.map((v) => (v - my) ** 2))
  const dfe = n - p
  const mse = sse / dfe
  const r2 = 1 - sse / sst
  const F = (sst - sse) / (p - 1) / mse
  const terms = beta.map((b, k) => {
    const se = Math.sqrt(mse * XtXi[k][k])
    const t = b / se
    return { name: k === 0 ? 'Constante' : names[k - 1], coef: b, se, t, pValue: 2 * (1 - tCdf(Math.abs(t), dfe)) }
  })
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(2) : Math.abs(v) >= 1 ? v.toFixed(4) : v.toPrecision(4))
  const equation =
    `${yName} = ${fmt(beta[0])}` + beta.slice(1).map((b, k) => ` ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b))}·${names[k]}`).join('')
  return {
    terms,
    rSquared: r2,
    adjRSquared: 1 - (1 - r2) * ((n - 1) / dfe),
    s: Math.sqrt(mse),
    F,
    pValue: 1 - fCdf(F, p - 1, dfe),
    n,
    residuals,
    fitted,
    predict: (x) => beta[0] + x.reduce((s, v, k) => s + v * beta[k + 1], 0),
    equation,
  }
}

export function simpleRegression(x: number[], y: number[], xName = 'X', yName = 'Y'): RegressionResult {
  return linearRegression(x.map((v) => [v]), y, [xName], yName)
}

export interface NormalityResult {
  ad: number
  adStar: number
  pValue: number
  normal: boolean
  conclusion: string
}

/**
 * Test d'Anderson-Darling de normalité (paramètres estimés).
 * Statistique corrigée A*² = A²(1 + 0,75/n + 2,25/n²) ; p-valeur selon
 * D'Agostino & Stephens (1986), table 4.9.
 */
export function andersonDarling(xs: number[], alpha = 0.05): NormalityResult {
  const n = xs.length
  const s = sorted(xs)
  const m = mean(xs)
  const sd = stdDev(xs)
  let acc = 0
  for (let i = 0; i < n; i++) {
    const fi = Math.min(Math.max(normalCdf((s[i] - m) / sd), 1e-300), 1 - 1e-16)
    const fj = Math.min(Math.max(normalCdf((s[n - 1 - i] - m) / sd), 1e-300), 1 - 1e-16)
    acc += (2 * i + 1) * (Math.log(fi) + Math.log(1 - fj))
  }
  const A2 = -n - acc / n
  const a = A2 * (1 + 0.75 / n + 2.25 / (n * n))
  let p: number
  if (a >= 0.6) p = Math.exp(1.2937 - 5.709 * a + 0.0186 * a * a)
  else if (a >= 0.34) p = Math.exp(0.9177 - 4.279 * a - 1.38 * a * a)
  else if (a >= 0.2) p = 1 - Math.exp(-8.318 + 42.796 * a - 59.938 * a * a)
  else p = 1 - Math.exp(-13.436 + 101.14 * a - 223.73 * a * a)
  p = Math.min(1, Math.max(0, p))
  return {
    ad: A2,
    adStar: a,
    pValue: p,
    normal: p >= alpha,
    conclusion:
      p >= alpha
        ? `${pEq(p)} ≥ ${alpha} : l'hypothèse de normalité n'est pas rejetée ; l'utilisation de la loi normale (courbe, PPM attendus) est justifiée.`
        : `${pEq(p)} < ${alpha} : les données ne suivent pas une loi normale. Les PPM attendus calculés sous hypothèse normale sont à interpréter avec prudence ; privilégier les PPM observés ou une transformation.`,
  }
}

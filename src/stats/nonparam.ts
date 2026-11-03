/**
 * Tests complémentaires : égalité des variances (Bartlett, Levene) et tests non paramétriques
 * (Mann-Whitney, Wilcoxon signé, Kruskal-Wallis, Spearman). Approximations normales / khi² avec
 * correction des ex aequo, comme SciPy (valeurs de référence dans les tests unitaires).
 */
import { chi2Cdf, fCdf, normalCdf, tCdf } from './distributions'
import { mean, median, sum, variance } from './descriptive'
import { pEq, type TestResult } from './inference'

const conclude = (p: number, alpha: number, h1: string, h0: string) =>
  p < alpha ? `${pEq(p)} < α = ${alpha} : on rejette H0. ${h1}` : `${pEq(p)} ≥ α = ${alpha} : on ne peut pas rejeter H0. ${h0}`

/** Rangs moyens (ex aequo = rang moyen) et somme des (t³ − t) des groupes d'ex aequo. */
export function ranks(xs: number[]): { r: number[]; ties: number } {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const r = new Array<number>(xs.length)
  let ties = 0
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg
    const t = j - i + 1
    if (t > 1) ties += t ** 3 - t
    i = j + 1
  }
  return { r, ties }
}

/** Test de Bartlett d'égalité des variances (groupes normaux). */
export function bartlett(groups: number[][], alpha = 0.05): TestResult {
  const k = groups.length
  const ns = groups.map((g) => g.length)
  const N = sum(ns)
  const vs = groups.map(variance)
  const sp = sum(ns.map((n, i) => (n - 1) * vs[i])) / (N - k)
  const num = (N - k) * Math.log(sp) - sum(ns.map((n, i) => (n - 1) * Math.log(vs[i])))
  const den = 1 + (sum(ns.map((n) => 1 / (n - 1))) - 1 / (N - k)) / (3 * (k - 1))
  const stat = num / den
  const p = 1 - chi2Cdf(stat, k - 1)
  return { name: 'Test de Bartlett (égalité des variances)', statistic: stat, statisticName: 'χ²', df: k - 1, pValue: p, alpha, reject: p < alpha, conclusion: conclude(p, alpha, 'Au moins une variance diffère des autres.', 'Rien ne permet de dire que les variances diffèrent.') }
}

/** Test de Levene (variante de Brown-Forsythe, centrée sur la médiane) : robuste à la non-normalité. */
export function levene(groups: number[][], alpha = 0.05): TestResult {
  const k = groups.length
  const z = groups.map((g) => {
    const m = median(g)
    return g.map((x) => Math.abs(x - m))
  })
  const ns = z.map((g) => g.length)
  const N = sum(ns)
  const zbar = mean(z.flat())
  const zi = z.map(mean)
  const between = sum(ns.map((n, i) => n * (zi[i] - zbar) ** 2))
  const within = sum(z.map((g, i) => sum(g.map((v) => (v - zi[i]) ** 2))))
  const W = ((N - k) / (k - 1)) * (between / within)
  const p = 1 - fCdf(W, k - 1, N - k)
  return { name: 'Test de Levene (égalité des variances, robuste)', statistic: W, statisticName: 'W', df: k - 1, df2: N - k, pValue: p, alpha, reject: p < alpha, conclusion: conclude(p, alpha, 'Au moins une dispersion diffère des autres.', 'Rien ne permet de dire que les dispersions diffèrent.') }
}

/** Test de Mann-Whitney (deux échantillons indépendants), approximation normale avec correction de continuité. */
export function mannWhitney(a: number[], b: number[], alpha = 0.05): TestResult {
  const n1 = a.length
  const n2 = b.length
  const { r, ties } = ranks([...a, ...b])
  const R1 = sum(r.slice(0, n1))
  const U1 = R1 - (n1 * (n1 + 1)) / 2
  const mu = (n1 * n2) / 2
  const N = n1 + n2
  const sd = Math.sqrt(((n1 * n2) / 12) * (N + 1 - ties / (N * (N - 1))))
  const z = (Math.abs(U1 - mu) - 0.5) / sd
  const p = Math.min(1, 2 * (1 - normalCdf(z)))
  return { name: 'Test de Mann-Whitney (deux échantillons, non paramétrique)', statistic: U1, statisticName: 'U', pValue: p, estimate: median(a) - median(b), alpha, reject: p < alpha, conclusion: conclude(p, alpha, 'Les deux groupes ne sont pas centrés au même endroit (médianes différentes).', 'Rien ne permet de dire que les deux groupes diffèrent.') }
}

/** Test des rangs signés de Wilcoxon (données appariées, ou un échantillon contre une valeur). */
export function wilcoxonSigned(diffs: number[], alpha = 0.05): TestResult {
  const d = diffs.filter((x) => x !== 0)
  const n = d.length
  const { r, ties } = ranks(d.map(Math.abs))
  const Wp = sum(r.filter((_, i) => d[i] > 0))
  const Wm = sum(r.filter((_, i) => d[i] < 0))
  const T = Math.min(Wp, Wm)
  const mu = (n * (n + 1)) / 4
  const sd = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - ties / 48)
  const z = (Math.abs(T - mu) - 0.5) / sd
  const p = n ? Math.min(1, 2 * (1 - normalCdf(z))) : 1
  return { name: 'Test des rangs signés de Wilcoxon (non paramétrique)', statistic: T, statisticName: 'T', pValue: p, estimate: median(diffs), alpha, reject: p < alpha, conclusion: conclude(p, alpha, 'Le décalage médian est différent de zéro.', 'Rien ne permet de dire qu\'il y a un décalage.') }
}

/** Test de Kruskal-Wallis (3 groupes ou plus, non paramétrique). */
export function kruskalWallis(groups: number[][], alpha = 0.05): TestResult {
  const all = groups.flat()
  const N = all.length
  const { r, ties } = ranks(all)
  let off = 0
  let H = 0
  for (const g of groups) {
    const R = sum(r.slice(off, off + g.length))
    H += (R * R) / g.length
    off += g.length
  }
  H = (12 / (N * (N + 1))) * H - 3 * (N + 1)
  H /= 1 - ties / (N ** 3 - N)
  const p = 1 - chi2Cdf(H, groups.length - 1)
  return { name: 'Test de Kruskal-Wallis (plusieurs groupes, non paramétrique)', statistic: H, statisticName: 'H', df: groups.length - 1, pValue: p, alpha, reject: p < alpha, conclusion: conclude(p, alpha, 'Au moins un groupe n\'est pas centré comme les autres.', 'Rien ne permet de dire que les groupes diffèrent.') }
}

/** Corrélation de rang de Spearman (relation monotone, non paramétrique). */
export function spearman(x: number[], y: number[], alpha = 0.05): TestResult {
  const rx = ranks(x).r
  const ry = ranks(y).r
  const mx = mean(rx)
  const my = mean(ry)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < x.length; i++) {
    sxy += (rx[i] - mx) * (ry[i] - my)
    sxx += (rx[i] - mx) ** 2
    syy += (ry[i] - my) ** 2
  }
  const rho = sxy / Math.sqrt(sxx * syy)
  const n = x.length
  const t = rho * Math.sqrt((n - 2) / Math.max(1e-12, 1 - rho * rho))
  const p = 2 * (1 - tCdf(Math.abs(t), n - 2))
  return { name: 'Corrélation de Spearman (rangs)', statistic: rho, statisticName: 'ρ', df: n - 2, pValue: p, estimate: rho, alpha, reject: p < alpha, conclusion: conclude(p, alpha, 'Il existe une relation monotone entre les deux variables.', 'Rien ne permet de dire que les deux variables sont liées.') }
}

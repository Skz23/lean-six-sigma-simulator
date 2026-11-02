/**
 * Fonctions de distribution de probabilité.
 * Implémentations numériques classiques (références dans docs/FORMULES.md) :
 *  - Loi normale : algorithme de West (2005), précision ~1e-15.
 *  - Quantile normal : Acklam + un pas de raffinement de Halley.
 *  - Gamma : approximation de Lanczos (g = 7, n = 9).
 *  - Bêta incomplète régularisée : fraction continue de Lentz (Numerical Recipes).
 *  - Gamma incomplète régularisée : série / fraction continue.
 * Toutes les valeurs sont validées contre SciPy dans les tests unitaires.
 */

/** Fonction de répartition de la loi normale centrée réduite Φ(z). */
export function normalCdf(z: number): number {
  if (Number.isNaN(z)) return NaN
  if (z === Infinity) return 1
  if (z === -Infinity) return 0
  const x = Math.abs(z)
  let c: number
  if (x > 37) {
    c = 0
  } else {
    const e = Math.exp((-x * x) / 2)
    if (x < 7.07106781186547) {
      let b = 3.52624965998911e-2 * x + 0.700383064443688
      b = b * x + 6.37396220353165
      b = b * x + 33.912866078383
      b = b * x + 112.079291497871
      b = b * x + 221.213596169931
      b = b * x + 220.206867912376
      let d = 8.83883476483184e-2 * x + 1.75566716318264
      d = d * x + 16.064177579207
      d = d * x + 86.7807322029461
      d = d * x + 296.564248779674
      d = d * x + 637.333633378831
      d = d * x + 793.826512519948
      d = d * x + 440.413735824752
      c = (e * b) / d
    } else {
      let b = x + 0.65
      b = x + 4 / b
      b = x + 3 / b
      b = x + 2 / b
      b = x + 1 / b
      c = e / b / 2.506628274631
    }
  }
  return z > 0 ? 1 - c : c
}

/** Densité de la loi normale N(mu, sigma). */
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
}

/** Quantile de la loi normale centrée réduite Φ⁻¹(p). */
export function normalInv(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pLow = 0.02425
  let x: number
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= 1 - pLow) {
    const q = p - 0.5
    const r = q * q
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  // Raffinement de Halley
  const e = normalCdf(x) - p
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2)
  x = x - u / (1 + (x * u) / 2)
  return x
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

/** Logarithme de la fonction Gamma. */
export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x)
  x -= 1
  let a = LANCZOS[0]
  const t = x + 7.5
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300
  const EPS = 1e-15
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Fonction bêta incomplète régularisée I_x(a, b). */
export function regIncBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** Fonction gamma incomplète inférieure régularisée P(a, x). */
export function regIncGamma(a: number, x: number): number {
  if (x <= 0) return 0
  if (x < a + 1) {
    let sum = 1 / a
    let del = sum
    let ap = a
    for (let n = 0; n < 500; n++) {
      ap += 1
      del *= x / ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
  }
  // Fraction continue pour Q(a, x)
  const FPMIN = 1e-300
  let b = x + 1 - a
  let c = 1 / FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-15) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}

/** Fonction de répartition de la loi de Student à df degrés de liberté. */
export function tCdf(t: number, df: number): number {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0
  const x = df / (df + t * t)
  const tail = 0.5 * regIncBeta(x, df / 2, 0.5)
  return t > 0 ? 1 - tail : tail
}

/** Quantile de la loi de Student (résolution par bissection + Newton). */
export function tInv(p: number, df: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p === 0.5) return 0
  // Point de départ : quantile normal
  let x = normalInv(p)
  let lo = -1e4
  let hi = 1e4
  for (let i = 0; i < 200; i++) {
    const f = tCdf(x, df) - p
    if (Math.abs(f) < 1e-14) break
    if (f > 0) hi = x
    else lo = x
    const dens = tPdf(x, df)
    let next = x - f / dens
    if (!Number.isFinite(next) || next <= lo || next >= hi) next = (lo + hi) / 2
    x = next
  }
  return x
}

export function tPdf(t: number, df: number): number {
  return Math.exp(logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI) - ((df + 1) / 2) * Math.log(1 + (t * t) / df))
}

/** Fonction de répartition de la loi du χ² à k degrés de liberté. */
export function chi2Cdf(x: number, k: number): number {
  return regIncGamma(k / 2, x / 2)
}

/** Fonction de répartition de la loi de Fisher F(d1, d2). */
export function fCdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  return regIncBeta((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2)
}

/** Quantile de la loi de Fisher (bissection). */
export function fInv(p: number, d1: number, d2: number): number {
  let lo = 0
  let hi = 1
  while (fCdf(hi, d1, d2) < p) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (fCdf(mid, d1, d2) < p) lo = mid
    else hi = mid
    if (hi - lo < 1e-12) break
  }
  return (lo + hi) / 2
}

/** Quantile de la loi du χ² (bissection). */
export function chi2Inv(p: number, k: number): number {
  let lo = 0
  let hi = Math.max(1, k)
  while (chi2Cdf(hi, k) < p) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (chi2Cdf(mid, k) < p) lo = mid
    else hi = mid
    if (hi - lo < 1e-12) break
  }
  return (lo + hi) / 2
}

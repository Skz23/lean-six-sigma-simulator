/**
 * Générateur pseudo-aléatoire reproductible (mulberry32) et lois usuelles.
 * Chaque poste et le modèle procédé disposent de leur propre flux (graine dérivée),
 * ce qui permet des comparaisons « à nombres aléatoires communs » entre scénarios :
 * deux configurations ne diffèrent que par leurs paramètres, pas par le hasard.
 */
export class Rng {
  private s: number
  private spare: number | null = null
  constructor(seed: number) {
    this.s = seed >>> 0
  }
  /** Uniforme [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  /** Normale N(mu, sd) — Box-Muller. */
  normal(mu = 0, sd = 1): number {
    if (this.spare !== null) {
      const v = this.spare
      this.spare = null
      return mu + sd * v
    }
    let u = 0
    while (u === 0) u = this.next()
    const v = this.next()
    const r = Math.sqrt(-2 * Math.log(u))
    this.spare = r * Math.sin(2 * Math.PI * v)
    return mu + sd * r * Math.cos(2 * Math.PI * v)
  }
  /** Exponentielle de moyenne `mean`. */
  exponential(mean: number): number {
    let u = 0
    while (u === 0) u = this.next()
    return -mean * Math.log(u)
  }
  /** Log-normale paramétrée par sa moyenne et son coefficient de variation. */
  lognormal(mean: number, cv: number): number {
    if (cv <= 0) return mean
    const s2 = Math.log(1 + cv * cv)
    const mu = Math.log(mean) - s2 / 2
    return Math.exp(mu + Math.sqrt(s2) * this.normal())
  }
  bernoulli(p: number): boolean {
    return this.next() < p
  }
  pick<T>(xs: T[]): T {
    return xs[Math.floor(this.next() * xs.length)]
  }
}

/** Dérive une graine indépendante à partir d'une graine maître et d'une étiquette. */
export function deriveSeed(seed: number, label: string): number {
  let h = 2166136261 ^ seed
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

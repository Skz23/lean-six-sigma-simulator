/**
 * Assistant « Quel test ? » : enchaîne les vérifications préalables (normalité, égalité des variances)
 * puis choisit le test adapté, à la manière des logigrammes de décision des cours de statistique.
 */
import { mean, median, stdDev } from './descriptive'
import { andersonDarling, anovaOneWay, chiSquareIndependence, fTestVariances, pEq, pearson, simpleRegression, tTestOneSample, tTestPaired, tTestTwoSample, type TestResult } from './inference'
import { bartlett, kruskalWallis, levene, mannWhitney, spearman, wilcoxonSigned } from './nonparam'

export type Goal = 'means' | 'target' | 'variances' | 'relation' | 'categorical'

export interface WizardGroup {
  name: string
  values: number[]
}

export interface WizardInput {
  goal: Goal
  groups: WizardGroup[]
  paired?: boolean
  target?: number
  table?: number[][]
  alpha?: number
}

export interface WizardStep {
  title: string
  question: string
  answer: string
  status: 'ok' | 'warn' | 'info' | 'key'
  detail?: string
}

export interface WizardResult {
  steps: WizardStep[]
  main?: TestResult
  extra?: TestResult[]
  verdict: string
  practical: string
  error?: string
}

const pTxt = pEq
const f = (x: number, d = 4) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '—')

function normalityStep(groups: WizardGroup[], alpha: number): { step: WizardStep; allNormal: boolean } {
  const res = groups.map((g) => ({ g, ad: andersonDarling(g.values, alpha) }))
  const bad = res.filter((x) => !x.ad.normal)
  const small = groups.some((g) => g.values.length < 8)
  return {
    allNormal: bad.length === 0,
    step: {
      title: 'Normalité (Anderson-Darling)',
      question: groups.length > 1 ? 'Chaque groupe suit-il une loi normale ?' : 'Les données suivent-elles une loi normale ?',
      answer: bad.length === 0 ? 'Oui' : `Non (${bad.map((x) => x.g.name).join(', ')})`,
      status: bad.length === 0 ? 'ok' : 'warn',
      detail:
        res.map((x) => `${x.g.name} : ${pTxt(x.ad.pValue)}`).join(' · ') +
        (small ? ' — moins de 8 valeurs dans un groupe : le test de normalité manque de puissance, restez prudent.' : '') +
        (bad.length ? ' Données non normales : cherchez-en la cause (mélange de populations, valeurs aberrantes, limite physique) ; on bascule vers un test non paramétrique.' : ''),
    },
  }
}

function varianceStep(groups: WizardGroup[], normal: boolean, alpha: number): { step: WizardStep; equal: boolean; test: TestResult } {
  const test = normal ? (groups.length === 2 ? fTestVariances(groups[0].values, groups[1].values, alpha) : bartlett(groups.map((g) => g.values), alpha)) : levene(groups.map((g) => g.values), alpha)
  return {
    equal: !test.reject,
    test,
    step: {
      title: `Égalité des variances (${normal ? (groups.length === 2 ? 'Fisher' : 'Bartlett') : 'Levene'})`,
      question: 'Les dispersions des groupes peuvent-elles être supposées égales ?',
      answer: test.reject ? 'Non' : 'Oui',
      status: test.reject ? 'warn' : 'ok',
      detail: `${pTxt(test.pValue)} · écarts-types : ${groups.map((g) => `${g.name} ${f(stdDev(g.values))}`).join(', ')}${normal ? '' : ' (Levene, car données non normales)'}`,
    },
  }
}

const groupLine = (groups: WizardGroup[], center: 'mean' | 'median') =>
  groups.map((g) => `${g.name} : ${center === 'mean' ? 'moyenne' : 'médiane'} ${f(center === 'mean' ? mean(g.values) : median(g.values))} (n = ${g.values.length})`).join(' · ')

function finish(steps: WizardStep[], main: TestResult, practical: string, extra?: TestResult[]): WizardResult {
  steps.push({ title: main.name, question: 'Résultat du test', answer: main.reject ? 'H0 rejetée' : 'H0 non rejetée', status: 'key', detail: main.conclusion })
  const verdict = main.reject
    ? `Différence / lien statistiquement significatif (${pTxt(main.pValue)}).`
    : `Pas de preuve de différence / de lien (${pTxt(main.pValue)}). Soit il n'y en a pas, soit l'échantillon est trop petit (voir « Puissance et effectif »).`
  return { steps, main, extra, verdict, practical }
}

export function runWizard(inp: WizardInput): WizardResult {
  const alpha = inp.alpha ?? 0.05
  const groups = inp.groups.filter((g) => g.values.length > 0)
  const steps: WizardStep[] = []
  const fail = (error: string): WizardResult => ({ steps, verdict: '', practical: '', error })

  if (inp.goal === 'categorical') {
    const t = inp.table ?? []
    if (t.length < 2 || t[0].length < 2) return fail('Collez un tableau de contingence d\'au moins 2 lignes × 2 colonnes (effectifs).')
    const tot = t.flat().reduce((a, b) => a + b, 0)
    const rows = t.map((r) => r.reduce((a, b) => a + b, 0))
    const cols = t[0].map((_, j) => t.reduce((a, r) => a + r[j], 0))
    const low = rows.flatMap((r) => cols.map((c) => (r * c) / tot)).filter((e) => e < 5).length
    steps.push({ title: 'Conditions du khi²', question: 'Chaque effectif attendu est-il ≥ 5 ?', answer: low ? `Non (${low} case(s) < 5)` : 'Oui', status: low ? 'warn' : 'ok', detail: low ? 'Regroupez des catégories rares, ou collectez plus de données : le test est moins fiable.' : undefined })
    const main = chiSquareIndependence(t, alpha)
    return finish(steps, main, main.reject ? 'La répartition d\'une variable dépend de l\'autre (ex. le type de défaut dépend de l\'équipe) : regardez quelles cases s\'écartent le plus de l\'attendu.' : 'Les deux variables semblent indépendantes.')
  }

  if (inp.goal === 'relation') {
    if (groups.length < 2) return fail('Il faut deux colonnes de même longueur : X (le facteur, ex. température) et Y (le résultat, ex. diamètre).')
    const [X, Y] = groups
    const n = Math.min(X.values.length, Y.values.length)
    const x = X.values.slice(0, n)
    const y = Y.values.slice(0, n)
    if (n < 5) return fail('Au moins 5 couples (X, Y) sont nécessaires.')
    const reg = simpleRegression(x, y, X.name, Y.name)
    const ad = andersonDarling(reg.residuals, alpha)
    steps.push({ title: 'Forme de la relation', question: 'Régression linéaire Y = a + b·X', answer: reg.equation, status: 'info', detail: `R² = ${f(reg.rSquared * 100, 1)} % de la variation de ${Y.name} expliquée par ${X.name}.` })
    steps.push({ title: 'Normalité des résidus (Anderson-Darling)', question: 'Les écarts à la droite suivent-ils une loi normale ?', answer: ad.normal ? 'Oui' : 'Non', status: ad.normal ? 'ok' : 'warn', detail: `${pTxt(ad.pValue)}${ad.normal ? '' : ' — relation peut-être non linéaire ou valeurs aberrantes : on confirme avec Spearman (rangs).'}` })
    const pc = pearson(x, y)
    const main: TestResult = {
      name: 'Corrélation de Pearson (test de la pente)',
      statistic: pc.r,
      statisticName: 'r',
      df: n - 2,
      pValue: pc.pValue,
      estimate: pc.r,
      alpha,
      reject: pc.pValue < alpha,
      conclusion: pc.pValue < alpha ? `${pTxt(pc.pValue)} < α : la relation est significative (r = ${f(pc.r, 3)}, ${pc.strength}).` : `${pTxt(pc.pValue)} ≥ α : pas de relation linéaire démontrée.`,
    }
    const extra = ad.normal ? undefined : [spearman(x, y, alpha)]
    return finish(steps, main, `${reg.equation}. Corrélation ne veut pas dire causalité : confirmez par un essai (plan d'expériences) avant d'agir sur ${X.name}.`, extra)
  }

  if (inp.goal === 'target') {
    if (groups.length < 1 || groups[0].values.length < 3) return fail('Collez au moins 3 valeurs dans une colonne.')
    const target = inp.target ?? NaN
    if (!Number.isFinite(target)) return fail('Indiquez la valeur cible (ex. le nominal 25,000).')
    const g = groups[0]
    const nm = normalityStep([g], alpha)
    steps.push(nm.step)
    const main = nm.allNormal ? tTestOneSample(g.values, target, alpha) : wilcoxonSigned(g.values.map((v) => v - target), alpha)
    return finish(steps, main, `${nm.allNormal ? 'Moyenne' : 'Médiane'} observée ${f(nm.allNormal ? mean(g.values) : median(g.values))} pour une cible de ${f(target)} : ${main.reject ? 'le procédé est décentré, un recentrage est justifié.' : 'pas de décentrage démontré.'}`)
  }

  if (groups.length < 2) return fail('Collez au moins deux colonnes (une par groupe : machine, équipe, lot, avant / après…).')
  if (groups.some((g) => g.values.length < 3)) return fail('Chaque groupe doit contenir au moins 3 valeurs.')

  if (inp.goal === 'variances') {
    const nm = normalityStep(groups, alpha)
    steps.push(nm.step)
    const v = varianceStep(groups, nm.allNormal, alpha)
    return finish(steps, v.test, v.test.reject ? 'La dispersion n\'est pas la même partout : le groupe le plus dispersé est la piste à creuser (réglage, usure, méthode).' : 'Les dispersions sont comparables.')
  }

  // Comparer des moyennes / positions
  if (inp.paired) {
    if (groups.length !== 2) return fail('Des données appariées se comparent deux à deux : collez exactement deux colonnes (ex. avant / après sur les mêmes pièces).')
    const n = Math.min(groups[0].values.length, groups[1].values.length)
    const d = groups[0].values.slice(0, n).map((v, i) => v - groups[1].values[i])
    steps.push({ title: 'Données appariées', question: 'Les mesures vont-elles par paires (même pièce, même opérateur) ?', answer: 'Oui : on travaille sur les différences', status: 'info', detail: `${n} paires · différence moyenne ${f(mean(d))}` })
    const nm = normalityStep([{ name: 'Différences', values: d }], alpha)
    steps.push(nm.step)
    const main = nm.allNormal ? tTestPaired(groups[0].values.slice(0, n), groups[1].values.slice(0, n), alpha) : wilcoxonSigned(d, alpha)
    return finish(steps, main, `Écart moyen ${groups[0].name} − ${groups[1].name} = ${f(mean(d))}. ${main.reject ? 'L\'écart est réel.' : 'Pas d\'écart démontré.'}`)
  }

  const nm = normalityStep(groups, alpha)
  steps.push(nm.step)
  const v = varianceStep(groups, nm.allNormal, alpha)
  steps.push(v.step)

  if (groups.length === 2) {
    const [a, b] = groups
    if (nm.allNormal) {
      const main = tTestTwoSample(a.values, b.values, alpha, 'two-sided', v.equal)
      steps.push({ title: 'Choix du test', question: 'Quel test de comparaison de moyennes ?', answer: v.equal ? 'Test t (variances égales)' : 'Test t de Welch (variances inégales)', status: 'info' })
      return finish(steps, main, `${groupLine(groups, 'mean')}. ${main.reject ? 'Les deux groupes ne produisent pas la même moyenne : ce facteur influence le résultat.' : 'Pas de différence de moyenne démontrée.'}`)
    }
    steps.push({ title: 'Choix du test', question: 'Quel test pour des données non normales ?', answer: 'Mann-Whitney (comparaison des médianes)', status: 'info' })
    const main = mannWhitney(a.values, b.values, alpha)
    return finish(steps, main, `${groupLine(groups, 'median')}. ${main.reject ? 'Les deux groupes ne sont pas centrés au même endroit.' : 'Pas de différence démontrée.'}`)
  }

  if (nm.allNormal) {
    const an = anovaOneWay(groups.map((g) => g.values), groups.map((g) => g.name), alpha)
    const main: TestResult = { name: 'ANOVA à un facteur', statistic: an.F, statisticName: 'F', df: an.dfBetween, df2: an.dfWithin, pValue: an.pValue, alpha, reject: an.reject, conclusion: an.conclusion }
    steps.push({ title: 'Choix du test', question: 'Quel test pour comparer 3 moyennes ou plus ?', answer: 'ANOVA à un facteur', status: 'info', detail: v.equal ? undefined : 'Variances inégales : l\'ANOVA est moins fiable, le test de Kruskal-Wallis est donné en confirmation.' })
    const extra = v.equal ? undefined : [kruskalWallis(groups.map((g) => g.values), alpha)]
    return finish(steps, main, `${groupLine(groups, 'mean')}. Part de variation expliquée par le facteur : ${f(an.rSquared * 100, 1)} %. ${an.reject ? 'Au moins un groupe diffère : repérez-le sur le graphique des moyennes.' : 'Pas de différence démontrée entre les groupes.'}`, extra)
  }
  steps.push({ title: 'Choix du test', question: 'Quel test pour 3 groupes ou plus non normaux ?', answer: 'Kruskal-Wallis', status: 'info' })
  const main = kruskalWallis(groups.map((g) => g.values), alpha)
  return finish(steps, main, `${groupLine(groups, 'median')}. ${main.reject ? 'Au moins un groupe n\'est pas centré comme les autres.' : 'Pas de différence démontrée.'}`)
}

/** Lecture d'un collage Excel : colonnes = groupes, première ligne = noms si non numérique. */
export function parseColumns(text: string): WizardGroup[] {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .map((l) => l.split(/\t|;/))
  if (!rows.length) return []
  const num = (s: string) => {
    const v = Number(s.trim().replace(/\s/g, '').replace(',', '.'))
    return s.trim() === '' ? NaN : v
  }
  const header = rows[0].some((c) => c.trim() && !Number.isFinite(num(c)))
  const width = Math.max(...rows.map((r) => r.length))
  const names = Array.from({ length: width }, (_, j) => (header ? rows[0][j]?.trim() || `Groupe ${j + 1}` : `Groupe ${j + 1}`))
  const body = header ? rows.slice(1) : rows
  return names.map((name, j) => ({ name, values: body.map((r) => num(r[j] ?? '')).filter(Number.isFinite) })).filter((g) => g.values.length)
}

/** Tableau de contingence collé : première ligne / colonne d'étiquettes facultatives. */
export function parseTable(text: string): { rows: string[]; cols: string[]; table: number[][] } {
  const g = parseColumns(text)
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/\t|;/))
  const firstColText = lines.length > 1 && lines.slice(1).every((l) => l[0] && !Number.isFinite(Number(l[0].trim().replace(',', '.'))))
  const cols = firstColText ? g.map((x) => x.name) : g.map((x) => x.name)
  const table = g.length ? g[0].values.map((_, i) => g.map((col) => col.values[i] ?? 0)) : []
  const rows = firstColText ? lines.slice(1).map((l) => l[0].trim()) : table.map((_, i) => `Ligne ${i + 1}`)
  return { rows, cols, table }
}

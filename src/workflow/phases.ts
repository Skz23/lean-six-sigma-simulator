// Démarche DMAIC : définition des phases et catalogue des outils rangés par phase.
// Source unique utilisée par le menu, les pages de phase, la boîte à outils et le fil d'Ariane.

export type PhaseId = 'define' | 'measure' | 'analyze' | 'improve' | 'control'

export interface Phase {
  id: PhaseId
  n: number
  label: string
  en: string
  marp: string
  goal: string
  questions: string[]
  deliverables: string[]
  gate: string[]
}

export const PHASES: Phase[] = [
  {
    id: 'define',
    n: 1,
    label: 'Définir',
    en: 'Define',
    marp: 'Définir le problème',
    goal: 'Se mettre d\'accord sur le problème à traiter, le client concerné, le périmètre et l\'objectif chiffré, avant de chercher quoi que ce soit.',
    questions: [
      'Quel est le problème, décrit par des faits et non par une solution ?',
      'Qui est le client, et quelles caractéristiques sont critiques pour lui (CTQ) ?',
      'Quel est le périmètre du processus étudié (début, fin, fournisseurs, clients) ?',
      'Quel gain vise-t-on, pour quand, et avec quelle démarche ?',
    ],
    deliverables: ['Charte projet signée', 'Énoncé du problème (QQOQCPC)', 'CTQ issus de la voix du client', 'SIPOC et cartographie du flux actuel'],
    gate: ['Le problème est mesurable', 'Le client et ses CTQ sont identifiés', 'Le périmètre et l\'équipe sont validés', 'L\'objectif est chiffré et daté'],
  },
  {
    id: 'measure',
    n: 2,
    label: 'Mesurer',
    en: 'Measure',
    marp: 'Observer la situation actuelle',
    goal: 'Établir la performance actuelle à partir de données fiables : vérifier le système de mesure, collecter, puis calculer la capabilité et le niveau sigma de départ.',
    questions: [
      'Le moyen de mesure est-il fiable (R&R, Cmc) ?',
      'Combien de mesures faut-il, et comment les échantillonner ?',
      'Quelle est la performance actuelle (TRS, Lead Time, capabilité, DPMO) ?',
      'Où naissent les défauts dans le flux ?',
    ],
    deliverables: ['Plan de collecte et données relevées', 'Validation du système de mesure', 'Indicateurs de référence (baseline)', 'Capabilité et niveau sigma initiaux'],
    gate: ['Le système de mesure est acceptable', 'Les données sont suffisantes et représentatives', 'La performance de départ est chiffrée'],
  },
  {
    id: 'analyze',
    n: 3,
    label: 'Analyser',
    en: 'Analyze',
    marp: 'Chercher les causes',
    goal: 'Lister les causes possibles, les hiérarchiser, puis prouver par les données lesquelles sont les causes racines.',
    questions: [
      'Quels défauts ou gaspillages pèsent le plus (Pareto) ?',
      'Quelles causes possibles (6M, 5 Pourquoi) ?',
      'Lesquelles sont confirmées statistiquement (corrélation, tests, ANOVA) ?',
      'D\'où vient la variation : pièce à pièce, dans le temps, entre lots ?',
    ],
    deliverables: ['Pareto des défauts', 'Diagramme d\'Ishikawa et 5 Pourquoi', 'Causes racines vérifiées par les données', 'Goulot et gaspillages identifiés'],
    gate: ['Les causes racines sont prouvées, pas supposées', 'Leur impact sur le CTQ est quantifié'],
  },
  {
    id: 'improve',
    n: 4,
    label: 'Innover',
    en: 'Improve',
    marp: 'Chercher et valider des solutions',
    goal: 'Imaginer des solutions aux causes racines, choisir les meilleures, optimiser les réglages puis vérifier le gain avant de déployer.',
    questions: [
      'Quelles solutions traitent chaque cause racine ?',
      'Lesquelles choisir (impact, coût, délai, risque) ?',
      'Quels réglages optimaux (plan d\'expériences) ?',
      'Le gain est-il confirmé par la simulation ou un pilote ?',
    ],
    deliverables: ['Solutions évaluées et retenues', 'Réglages optimisés', 'Résultats du pilote ou de la simulation', 'Plan de déploiement et risques (AMDEC)'],
    gate: ['Le gain est démontré sur le CTQ', 'Les risques des solutions sont maîtrisés', 'Le déploiement est planifié'],
  },
  {
    id: 'control',
    n: 5,
    label: 'Contrôler',
    en: 'Control',
    marp: 'Pérenniser',
    goal: 'Garantir que le gain dure : surveiller le processus, standardiser les nouvelles pratiques, puis clôturer et capitaliser.',
    questions: [
      'La capabilité après amélioration atteint-elle l\'objectif ?',
      'Comment détecter une dérive (cartes de contrôle, plan de contrôle) ?',
      'Les nouveaux standards sont-ils écrits et appliqués ?',
      'Quel est le gain final, et qui pilote ensuite ?',
    ],
    deliverables: ['Capabilité après amélioration', 'Cartes de contrôle en place', 'Plan de contrôle et standards', 'Bilan des gains et rapport de clôture'],
    gate: ['Le processus est sous contrôle et capable', 'Le propriétaire du processus a repris la main', 'Le projet est documenté et clôturé'],
  },
]

export const phaseById = (id: string | undefined) => PHASES.find((p) => p.id === id)

export type Family = 'Projet' | 'Lean' | 'Six Sigma' | 'Qualité' | 'Statistiques' | 'Simulation'

export interface Tool {
  id: string
  name: string
  to: string
  family: Family
  phases: PhaseId[]
  desc: string
  /** outil incontournable de la phase (mis en avant) */
  key?: PhaseId[]
}

export const TOOLS: Tool[] = [
  // ── Définir
  { id: 'charter', name: 'Charte projet, VOC → CTQ, SIPOC', to: '/sixsigma/dmaic', family: 'Projet', phases: ['define'], key: ['define'], desc: 'Problème, enjeu, objectif, périmètre ; voix du client traduite en CTQ ; SIPOC du processus.' },
  { id: 'method', name: 'Choisir la démarche', to: '/methode?tab=choose', family: 'Qualité', phases: ['define'], desc: 'Kaizen, A3, 8D ou DMAIC selon la complexité du problème et si la solution est connue.' },
  { id: 'qqoqcpc', name: 'QQOQCPC', to: '/methode?tab=qqoqcpc', family: 'Qualité', phases: ['define'], key: ['define'], desc: 'Décrire le problème par les faits : quoi, qui, où, quand, comment, pourquoi, combien.' },
  { id: 'kano', name: 'Kano', to: '/methode?tab=kano', family: 'Qualité', phases: ['define'], desc: 'Classer les attentes des clients : obligatoires, proportionnelles, attractives.' },
  { id: 'vsm', name: 'VSM — cartographie du flux', to: '/lean/vsm', family: 'Lean', phases: ['define', 'measure'], key: ['define'], desc: 'Chaîne de valeur actuelle : stocks, temps de cycle, ligne de temps VA / NVA.' },
  { id: 'line', name: 'Ligne de production', to: '/lean/line', family: 'Simulation', phases: ['define', 'improve'], desc: 'Modéliser les postes, la journée, la demande, les lots et le pilotage poussé / tiré.' },
  // ── Mesurer
  { id: 'data', name: 'Mes données', to: '/data', family: 'Projet', phases: ['measure'], key: ['measure'], desc: 'Importer mesures, défauts et ligne réels (Excel, CSV, collage), puis caler le modèle.' },
  { id: 'defect-log', name: 'Registre des défauts', to: '/sixsigma/defects?tab=log', family: 'Qualité', phases: ['measure'], desc: 'Feuille de relevés : types de défauts, postes, quantités, coûts.' },
  { id: 'power', name: 'Échantillonnage — puissance et effectif', to: '/sixsigma/stats?tab=power', family: 'Statistiques', phases: ['measure'], desc: 'Combien de mesures collecter pour détecter un écart donné.' },
  { id: 'msa', name: 'Étude R&R (ANOVA)', to: '/sixsigma/msa?tab=rr', family: 'Six Sigma', phases: ['measure'], key: ['measure'], desc: 'Répétabilité et reproductibilité du moyen de mesure : %R&R, ndc.' },
  { id: 'cmc', name: 'Capabilité du moyen de contrôle (Cmc)', to: '/sixsigma/msa?tab=cmc', family: 'Six Sigma', phases: ['measure'], desc: 'Méthode de Charbonneau : le moyen de contrôle est-il assez précis pour la tolérance ?' },
  { id: 'simulation', name: 'Simulation de la journée', to: '/lean/simulation', family: 'Simulation', phases: ['measure', 'improve'], desc: 'Voir l\'usine tourner : files d\'attente, goulot en direct, historique d\'une pièce.' },
  { id: 'kpi', name: 'Indicateurs Lean (TRS, TRG, Lead Time, Takt)', to: '/lean/kpi', family: 'Lean', phases: ['measure', 'control'], key: ['measure'], desc: 'Takt, temps de cycle, Lead Time, WIP, TRS, TRG, RTF, VA / NVA.' },
  { id: 'dist', name: 'Histogramme et normalité', to: '/sixsigma/stats?tab=dist', family: 'Statistiques', phases: ['measure'], desc: 'Forme de la distribution, droite de Henry, test d\'Anderson-Darling.' },
  { id: 'capability', name: 'Capabilité (Cm, Cmk, Cp, Cpk)', to: '/sixsigma/capability', family: 'Six Sigma', phases: ['measure', 'control'], key: ['measure', 'control'], desc: 'Convention française ou internationale, PPM, Cpm et Taguchi, Box-Cox.' },
  { id: 'process', name: 'Paramètres procédé', to: '/sixsigma/process', family: 'Six Sigma', phases: ['measure', 'improve'], desc: 'Effet de la température, de la pression et de la vitesse sur le CTQ ; tester un réglage.' },
  { id: 'fmea', name: 'AMDEC / NPR', to: '/sixsigma/defects?tab=fmea', family: 'Qualité', phases: ['measure', 'improve'], desc: 'Modes de défaillance, gravité × occurrence × détection, actions.' },
  // ── Analyser
  { id: 'pareto', name: 'Pareto des défauts', to: '/sixsigma/defects?tab=pareto', family: 'Qualité', phases: ['analyze'], key: ['analyze'], desc: 'Les 20 % de causes qui font 80 % des défauts ou des coûts.' },
  { id: 'ideas', name: 'Brainstorming et KJ', to: '/methode?tab=ideas', family: 'Qualité', phases: ['analyze', 'improve'], desc: 'Produire des idées en groupe puis les regrouper par affinité.' },
  { id: 'ishikawa', name: 'Ishikawa 6M', to: '/sixsigma/defects?tab=ishikawa', family: 'Qualité', phases: ['analyze'], key: ['analyze'], desc: 'Causes possibles classées en Matière, Milieu, Méthode, Matériel, Main-d\'œuvre, Mesure.' },
  { id: 'why', name: '5 Pourquoi', to: '/sixsigma/defects?tab=why', family: 'Qualité', phases: ['analyze'], desc: 'Remonter d\'un symptôme à sa cause racine.' },
  { id: 'root', name: 'Causes racines', to: '/sixsigma/defects?tab=root', family: 'Qualité', phases: ['analyze'], desc: 'Synthèse des causes retenues et de leur vérification.' },
  { id: 'muda', name: '8 gaspillages (Muda)', to: '/lean/muda', family: 'Lean', phases: ['analyze'], key: ['analyze'], desc: 'Détection automatique des gaspillages, impact en €/jour et pistes.' },
  { id: 'spaghetti', name: 'Diagramme spaghetti', to: '/lean/spaghetti', family: 'Lean', phases: ['analyze', 'improve'], desc: 'Mesurer les déplacements et tester une autre implantation.' },
  { id: 'toc', name: 'Goulot et théorie des contraintes', to: '/lean/kpi', family: 'Lean', phases: ['analyze'], desc: 'Équilibrage (Yamazumi) et 5 étapes de Goldratt appliquées à la ligne.' },
  { id: 'corr', name: 'Corrélation et régression', to: '/sixsigma/stats?tab=corr', family: 'Statistiques', phases: ['analyze'], key: ['analyze'], desc: 'Quel paramètre influence le CTQ, et de combien.' },
  { id: 'tests', name: 'Tests d\'hypothèses', to: '/sixsigma/stats?tab=tests', family: 'Statistiques', phases: ['analyze', 'control'], desc: 'Test t, F, comparaison de proportions : la différence est-elle réelle ?' },
  { id: 'anova', name: 'ANOVA', to: '/sixsigma/stats?tab=anova', family: 'Statistiques', phases: ['analyze'], desc: 'Comparer les moyennes de plusieurs groupes (machines, équipes, lots).' },
  { id: 'explore', name: 'Boîtes à moustaches et multi-vari', to: '/sixsigma/stats?tab=explore', family: 'Statistiques', phases: ['analyze'], desc: 'D\'où vient la variation : pièce à pièce, temps ou lots.' },
  { id: 'chi2', name: 'Khi²', to: '/sixsigma/stats?tab=chi2', family: 'Statistiques', phases: ['analyze'], desc: 'Deux variables qualitatives sont-elles liées ?' },
  // ── Innover
  { id: 'plan', name: 'Diagnostic et plan d\'amélioration', to: '/plan', family: 'Projet', phases: ['analyze', 'improve'], key: ['improve'], desc: 'Actions proposées automatiquement et chiffrées par simulation (gain, ROI).' },
  { id: 'vote', name: 'Vote pondéré', to: '/methode?tab=vote', family: 'Qualité', phases: ['improve'], key: ['improve'], desc: 'Choisir les solutions avec des critères pondérés (notes 1-3-9).' },
  { id: 'doe', name: 'Plans d\'expériences (DOE)', to: '/sixsigma/stats?tab=doe', family: 'Statistiques', phases: ['improve'], desc: 'Tester plusieurs facteurs à la fois, trouver le meilleur réglage.' },
  { id: 'smed', name: 'SMED', to: '/lean/smed', family: 'Lean', phases: ['improve'], desc: 'Réduire les changements de série : interne / externe, gain simulé.' },
  { id: 'kanban', name: 'Kanban', to: '/lean/kanban', family: 'Lean', phases: ['improve'], desc: 'Nombre de cartes et passage en flux tiré.' },
  { id: 'lss', name: 'Comparaison Lean / Six Sigma / LSS', to: '/lss', family: 'Simulation', phases: ['improve'], key: ['improve'], desc: 'Gains de chaque approche et combinés, ROI et retour sur investissement.' },
  { id: 'scenarios', name: 'Scénarios et versions', to: '/scenarios', family: 'Simulation', phases: ['improve', 'control'], desc: 'Comparer avant / après, historique des versions, export.' },
  // ── Contrôler
  { id: 'spc', name: 'Cartes de contrôle (SPC)', to: '/sixsigma/spc', family: 'Six Sigma', phases: ['control'], key: ['control'], desc: 'X̄-R, I-MR, p, np, c, u et règles de détection.' },
  { id: 'control-plan', name: 'Plan de contrôle et suivi', to: '/sixsigma/dmaic', family: 'Projet', phases: ['control'], key: ['control'], desc: 'Caractéristique, méthode, fréquence, réaction ; suivi des indicateurs du projet.' },
  { id: '5s', name: '5S', to: '/lean/5s', family: 'Lean', phases: ['control'], desc: 'Audit sur 5 dimensions, radar et plan d\'action.' },
  { id: 'kaizen', name: 'Kaizen — PDCA', to: '/lean/kaizen', family: 'Lean', phases: ['improve', 'control'], desc: 'Tableau d\'amélioration continue, mesure avant / après.' },
  { id: 'a3', name: 'A3', to: '/methode?tab=a3', family: 'Qualité', phases: ['control'], desc: 'Le projet résumé sur une page.' },
  { id: '8d', name: '8D', to: '/methode?tab=8d', family: 'Qualité', phases: ['control'], desc: 'Rapport de résolution en 8 disciplines (confinement, cause, actions, prévention).' },
  { id: 'reports', name: 'Rapports PDF', to: '/reports', family: 'Projet', phases: ['control'], desc: 'Rapport complet à présenter ou archiver.' },
]

export const toolsOf = (phase: PhaseId) => TOOLS.filter((t) => t.phases.includes(phase))

/** Outils correspondant à l'adresse courante (chemin + onglet éventuel). */
export function toolsAt(pathname: string, search: string): Tool[] {
  const tab = new URLSearchParams(search).get('tab')
  return TOOLS.filter((t) => {
    const [p, q] = t.to.split('?')
    if (p !== pathname) return false
    if (!q) return true
    const want = new URLSearchParams(q).get('tab')
    return !tab || want === tab
  })
}

const LAST = 'lss-last-phase'
export function rememberPhase(id: string) {
  try {
    sessionStorage.setItem(LAST, id)
  } catch {
    /* stockage indisponible */
  }
}
export function lastPhase(): string | null {
  try {
    return sessionStorage.getItem(LAST)
  } catch {
    return null
  }
}


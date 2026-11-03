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
  steps: Step[]
}

export interface StepTool {
  id: string
  /** rôle de l'outil à cette étape, quand il sert dans plusieurs phases */
  role?: string
}
export interface Step {
  n: string
  title: string
  hint: string
  tools: StepTool[]
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
    steps: [
      { n: '1.1', title: 'Décrire le problème', hint: 'Partir des faits, pas d\'une solution supposée.', tools: [{ id: 'qqoqcpc' }] },
      { n: '1.2', title: 'Écouter le client', hint: 'Ce qui compte pour le client devient une caractéristique mesurable (CTQ).', tools: [{ id: 'voc' }, { id: 'kano' }] },
      { n: '1.3', title: 'Délimiter le processus', hint: 'Où commence et où finit le processus étudié, et comment le flux circule aujourd\'hui.', tools: [{ id: 'sipoc' }, { id: 'vsm', role: 'Cartographie de l\'état actuel' }, { id: 'line', role: 'Modéliser la ligne actuelle' }] },
      { n: '1.4', title: 'Formaliser le projet', hint: 'Enjeu, objectif chiffré, périmètre, équipe et planning validés par le commanditaire.', tools: [{ id: 'charter' }] },
    ],
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
    steps: [
      { n: '2.1', title: 'Préparer la collecte', hint: 'Quoi mesurer, combien de mesures, sur quelle feuille.', tools: [{ id: 'power' }, { id: 'defect-log', role: 'Feuille de relevés' }] },
      { n: '2.2', title: 'Vérifier le système de mesure', hint: 'Avant d\'analyser des données, s\'assurer que l\'instrument et les opérateurs sont fiables.', tools: [{ id: 'msa' }, { id: 'cmc' }] },
      { n: '2.3', title: 'Collecter les données', hint: 'Données réelles importées, ou journée simulée de la ligne.', tools: [{ id: 'data' }, { id: 'simulation', role: 'Observer l\'état actuel' }] },
      { n: '2.4', title: 'Chiffrer la situation de départ', hint: 'La référence (baseline) à laquelle on comparera le résultat final.', tools: [{ id: 'kpi', role: 'Indicateurs de départ' }, { id: 'dist' }, { id: 'capability', role: 'Capabilité initiale' }] },
    ],
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
    steps: [
      { n: '3.1', title: 'Hiérarchiser les problèmes', hint: 'S\'attaquer d\'abord à ce qui pèse le plus.', tools: [{ id: 'pareto' }, { id: 'muda' }, { id: 'toc' }, { id: 'spaghetti', role: 'Mesurer les déplacements' }] },
      { n: '3.2', title: 'Lister les causes possibles', hint: 'Toutes les hypothèses, en groupe, sans les juger encore.', tools: [{ id: 'ideas', role: 'Idées de causes' }, { id: 'ishikawa' }, { id: 'why' }, { id: 'fmea', role: 'Modes de défaillance et causes' }] },
      { n: '3.3', title: 'Vérifier les causes par les données', hint: 'Une cause n\'est retenue que si les données la confirment.', tools: [{ id: 'corr' }, { id: 'explore' }, { id: 'anova' }, { id: 'tests', role: 'Comparer des groupes' }, { id: 'chi2' }, { id: 'process', role: 'Effet des réglages sur le CTQ' }] },
      { n: '3.4', title: 'Retenir les causes racines', hint: 'Synthèse des causes prouvées et de leur poids.', tools: [{ id: 'root' }, { id: 'plan', role: 'Diagnostic automatique' }] },
    ],
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
    steps: [
      { n: '4.1', title: 'Imaginer des solutions', hint: 'Au moins une solution par cause racine.', tools: [{ id: 'ideas', role: 'Idées de solutions' }, { id: 'plan', role: 'Actions proposées et chiffrées' }, { id: 'smed' }, { id: 'kanban' }] },
      { n: '4.2', title: 'Choisir les solutions', hint: 'Critères pondérés : efficacité, coût, délai, risque.', tools: [{ id: 'vote' }] },
      { n: '4.3', title: 'Optimiser et tester', hint: 'Trouver le meilleur réglage et essayer la nouvelle organisation sans risque.', tools: [{ id: 'doe' }, { id: 'process', role: 'Tester un réglage' }, { id: 'line', role: 'Modifier la ligne' }, { id: 'simulation', role: 'Tester la nouvelle ligne' }, { id: 'spaghetti', role: 'Tester une implantation' }] },
      { n: '4.4', title: 'Valider le gain et les risques', hint: 'Le gain est-il réel, et que peut-il mal tourner ?', tools: [{ id: 'lss' }, { id: 'scenarios', role: 'Comparer avant / après' }, { id: 'fmea', role: 'Risques des solutions' }] },
    ],
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
    steps: [
      { n: '5.1', title: 'Confirmer le résultat', hint: 'Comparer à la situation de départ mesurée en phase 2.', tools: [{ id: 'capability', role: 'Capabilité après amélioration' }, { id: 'kpi', role: 'Indicateurs après amélioration' }, { id: 'tests', role: 'Écart avant / après significatif ?' }] },
      { n: '5.2', title: 'Surveiller le processus', hint: 'Détecter une dérive avant qu\'elle ne produise des défauts.', tools: [{ id: 'spc' }, { id: 'control-plan' }] },
      { n: '5.3', title: 'Standardiser', hint: 'Les nouvelles pratiques deviennent la règle.', tools: [{ id: '5s' }, { id: 'kaizen' }] },
      { n: '5.4', title: 'Clôturer et capitaliser', hint: 'Bilan, documentation et passage de relais.', tools: [{ id: 'reports' }, { id: 'a3' }, { id: '8d' }] },
    ],
  },
]

export const phaseById = (id: string | undefined) => PHASES.find((p) => p.id === id)

export type Family = 'Projet' | 'Lean' | 'Six Sigma' | 'Qualité' | 'Statistiques' | 'Simulation'

export interface Tool {
  id: string
  name: string
  to: string
  family: Family
  desc: string
  /** phases où l'outil sert (déduit des étapes) */
  phases: PhaseId[]
}

const CATALOG: Omit<Tool, 'phases'>[] = [
  { id: 'qqoqcpc', name: 'QQOQCPC', to: '/methode/qqoqcpc', family: 'Qualité', desc: 'Décrire le problème par les faits : quoi, qui, où, quand, comment, pourquoi, combien.' },
  { id: 'voc', name: 'Voix du client → CTQ', to: '/sixsigma/dmaic?phase=define&focus=voc', family: 'Projet', desc: 'Traduire les attentes du client en caractéristiques mesurables avec une cible.' },
  { id: 'kano', name: 'Kano', to: '/methode/kano', family: 'Qualité', desc: 'Classer les attentes des clients : obligatoires, proportionnelles, attractives.' },
  { id: 'sipoc', name: 'SIPOC', to: '/sixsigma/dmaic?phase=define&focus=sipoc', family: 'Projet', desc: 'Fournisseurs, entrées, processus, sorties, clients : le périmètre en une ligne.' },
  { id: 'vsm', name: 'VSM — cartographie du flux', to: '/lean/vsm', family: 'Lean', desc: 'Chaîne de valeur : stocks, temps de cycle, ligne de temps VA / NVA.' },
  { id: 'line', name: 'Ligne de production', to: '/lean/line', family: 'Simulation', desc: 'Postes, journée, demande, lots et pilotage poussé / tiré.' },
  { id: 'charter', name: 'Charte projet', to: '/sixsigma/dmaic?phase=define&focus=charter', family: 'Projet', desc: 'Problème, enjeu, objectif, périmètre, indicateur de départ et cible.' },
  { id: 'power', name: 'Échantillonnage — puissance et effectif', to: '/sixsigma/stats/power', family: 'Statistiques', desc: 'Combien de mesures collecter pour détecter un écart donné.' },
  { id: 'defect-log', name: 'Registre des défauts', to: '/sixsigma/defects/log', family: 'Qualité', desc: 'Types de défauts, postes, quantités, coûts.' },
  { id: 'msa', name: 'Étude R&R (ANOVA)', to: '/sixsigma/msa/rr', family: 'Six Sigma', desc: 'Répétabilité et reproductibilité du moyen de mesure : %R&R, ndc.' },
  { id: 'cmc', name: 'Capabilité du moyen de contrôle (Cmc)', to: '/sixsigma/msa/cmc', family: 'Six Sigma', desc: 'Méthode de Charbonneau : le moyen de contrôle est-il assez précis pour la tolérance ?' },
  { id: 'data', name: 'Mes données', to: '/data', family: 'Projet', desc: 'Importer mesures, défauts et ligne réels (Excel, CSV, collage), puis caler le modèle.' },
  { id: 'simulation', name: 'Simulation de la journée', to: '/lean/simulation', family: 'Simulation', desc: 'Voir l\'usine tourner : files d\'attente, goulot en direct, historique d\'une pièce.' },
  { id: 'kpi', name: 'Indicateurs Lean (TRS, Lead Time, Takt)', to: '/lean/kpi', family: 'Lean', desc: 'Takt, temps de cycle, Lead Time, WIP, TRS, TRG, RTF, VA / NVA.' },
  { id: 'dist', name: 'Histogramme et normalité', to: '/sixsigma/stats/dist', family: 'Statistiques', desc: 'Forme de la distribution, droite de Henry, test d\'Anderson-Darling.' },
  { id: 'capability', name: 'Capabilité (Cm, Cmk, Cp, Cpk)', to: '/sixsigma/capability', family: 'Six Sigma', desc: 'Convention française ou internationale, PPM, Cpm et Taguchi, Box-Cox.' },
  { id: 'pareto', name: 'Pareto des défauts', to: '/sixsigma/defects/pareto', family: 'Qualité', desc: 'Les quelques causes qui font l\'essentiel des défauts ou des coûts.' },
  { id: 'muda', name: '8 gaspillages (Muda)', to: '/lean/muda', family: 'Lean', desc: 'Détection automatique des gaspillages, impact en €/jour et pistes.' },
  { id: 'toc', name: 'Goulot et équilibrage (TOC)', to: '/lean/toc', family: 'Lean', desc: 'Charge des postes face au takt (Yamazumi) et 5 étapes de Goldratt.' },
  { id: 'spaghetti', name: 'Diagramme spaghetti', to: '/lean/spaghetti', family: 'Lean', desc: 'Mesurer les déplacements et tester une autre implantation.' },
  { id: 'ideas', name: 'Brainstorming et KJ', to: '/methode/ideas', family: 'Qualité', desc: 'Produire des idées en groupe puis les regrouper par affinité.' },
  { id: 'ishikawa', name: 'Ishikawa 6M', to: '/sixsigma/defects/ishikawa', family: 'Qualité', desc: 'Causes possibles classées en Matière, Milieu, Méthode, Matériel, Main-d\'œuvre, Mesure.' },
  { id: 'why', name: '5 Pourquoi', to: '/sixsigma/defects/why', family: 'Qualité', desc: 'Remonter d\'un symptôme à sa cause racine.' },
  { id: 'fmea', name: 'AMDEC / NPR', to: '/sixsigma/defects/fmea', family: 'Qualité', desc: 'Modes de défaillance, gravité × occurrence × détection, actions.' },
  { id: 'corr', name: 'Corrélation et régression', to: '/sixsigma/stats/corr', family: 'Statistiques', desc: 'Quel paramètre influence le CTQ, et de combien.' },
  { id: 'explore', name: 'Boîtes à moustaches et multi-vari', to: '/sixsigma/stats/explore', family: 'Statistiques', desc: 'D\'où vient la variation : pièce à pièce, temps ou lots.' },
  { id: 'anova', name: 'ANOVA', to: '/sixsigma/stats/anova', family: 'Statistiques', desc: 'Comparer les moyennes de plusieurs groupes (machines, équipes, lots).' },
  { id: 'tests', name: 'Tests d\'hypothèses', to: '/sixsigma/stats/tests', family: 'Statistiques', desc: 'Test t, F, comparaison de proportions : la différence est-elle réelle ?' },
  { id: 'chi2', name: 'Khi²', to: '/sixsigma/stats/chi2', family: 'Statistiques', desc: 'Deux variables qualitatives sont-elles liées ?' },
  { id: 'process', name: 'Paramètres procédé', to: '/sixsigma/process', family: 'Six Sigma', desc: 'Effet de la température, de la pression et de la vitesse sur le CTQ.' },
  { id: 'root', name: 'Causes racines', to: '/sixsigma/defects/root', family: 'Qualité', desc: 'Synthèse des causes retenues et de leur vérification.' },
  { id: 'plan', name: 'Diagnostic et plan d\'amélioration', to: '/plan', family: 'Projet', desc: 'Leviers détectés sur vos données, actions chiffrées par simulation (gain, ROI).' },
  { id: 'smed', name: 'SMED', to: '/lean/smed', family: 'Lean', desc: 'Réduire les changements de série : interne / externe, gain simulé.' },
  { id: 'kanban', name: 'Kanban', to: '/lean/kanban', family: 'Lean', desc: 'Nombre de cartes et passage en flux tiré.' },
  { id: 'vote', name: 'Vote pondéré', to: '/methode/vote', family: 'Qualité', desc: 'Choisir avec des critères pondérés (notes 1-3-9).' },
  { id: 'doe', name: 'Plans d\'expériences (DOE)', to: '/sixsigma/stats/doe', family: 'Statistiques', desc: 'Tester plusieurs facteurs à la fois, trouver le meilleur réglage.' },
  { id: 'lss', name: 'Comparaison Lean / Six Sigma / LSS', to: '/lss', family: 'Simulation', desc: 'Gains de chaque approche et combinés, ROI et retour sur investissement.' },
  { id: 'scenarios', name: 'Scénarios et versions', to: '/scenarios', family: 'Simulation', desc: 'Comparer des scénarios, historique des versions, export.' },
  { id: 'spc', name: 'Cartes de contrôle (SPC)', to: '/sixsigma/spc', family: 'Six Sigma', desc: 'X̄-R, I-MR, p, np, c, u et règles de détection.' },
  { id: 'control-plan', name: 'Plan de contrôle et suivi', to: '/sixsigma/dmaic?phase=control', family: 'Projet', desc: 'Caractéristique, méthode, fréquence, réaction ; suivi des indicateurs du projet.' },
  { id: '5s', name: '5S', to: '/lean/5s', family: 'Lean', desc: 'Audit sur 5 dimensions, radar et plan d\'action.' },
  { id: 'kaizen', name: 'Kaizen — PDCA', to: '/lean/kaizen', family: 'Lean', desc: 'Tableau d\'amélioration continue, mesure avant / après.' },
  { id: 'reports', name: 'Rapports PDF', to: '/reports', family: 'Projet', desc: 'Rapport complet à présenter ou archiver.' },
  { id: 'a3', name: 'A3', to: '/methode/a3', family: 'Qualité', desc: 'Le projet résumé sur une page.' },
  { id: '8d', name: '8D', to: '/methode/8d', family: 'Qualité', desc: 'Rapport de résolution en 8 disciplines (confinement, cause, actions, prévention).' },
]

export const TOOLS: Tool[] = CATALOG.map((t) => ({ ...t, phases: PHASES.filter((p) => p.steps.some((s) => s.tools.some((x) => x.id === t.id))).map((p) => p.id) }))
export const toolById = (id: string) => TOOLS.find((t) => t.id === id)

export const toolsOf = (phase: PhaseId) => TOOLS.filter((t) => t.phases.includes(phase))

/** Étapes (toutes phases) où un outil intervient. */
export function stepsOf(id: string): { phase: Phase; step: Step; role?: string }[] {
  return PHASES.flatMap((phase) => phase.steps.flatMap((step) => step.tools.filter((x) => x.id === id).map((x) => ({ phase, step, role: x.role }))))
}

/** Outils correspondant à l'adresse courante (chemin + paramètres éventuels). */
export function toolsAt(pathname: string, search: string): Tool[] {
  const cur = new URLSearchParams(search)
  return TOOLS.filter((t) => {
    const [p, q] = t.to.split('?')
    if (p !== pathname) return false
    if (!q) return true
    return [...new URLSearchParams(q)].every(([k, v]) => !cur.get(k) || cur.get(k) === v)
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


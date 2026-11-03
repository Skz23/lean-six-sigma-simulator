// Rappels de cours : à quoi sert l'outil, comment s'en servir, pièges à éviter.
// Rédaction propre à l'appli (synthèse des pratiques Lean Six Sigma usuelles), sans reprise de supports de cours.
import type { PhaseId } from './phases'

export interface Lesson {
  why: string
  how: string[]
  tips: string[]
}

export const PHASE_LESSONS: Record<PhaseId, { key: string; pitfalls: string[] }> = {
  define: {
    key: 'Un problème bien posé est à moitié résolu. On décrit un écart mesurable entre la situation actuelle et l\'attendu, sans évoquer de cause ni de solution.',
    pitfalls: ['Formuler le problème comme une solution (« il faut acheter une machine »)', 'Un périmètre trop large : le projet ne finit jamais', 'Un objectif sans chiffre ni date', 'Oublier le client : on améliore ce qui ne compte pas pour lui'],
  },
  measure: {
    key: 'On ne peut améliorer que ce que l\'on mesure, et seulement si la mesure est fiable. La situation de départ chiffrée sert de référence à tout le projet.',
    pitfalls: ['Analyser des données issues d\'un moyen de mesure non vérifié', 'Trop peu de mesures, ou prises sur une seule journée / une seule équipe', 'Mélanger des données de périodes ou de réglages différents', 'Calculer une capabilité sur un processus instable'],
  },
  analyze: {
    key: 'On passe des causes possibles aux causes prouvées. Une cause n\'est retenue que si les données montrent son lien avec le problème.',
    pitfalls: ['Retenir la cause « évidente » sans la vérifier', 'Confondre corrélation et causalité', 'S\'arrêter au symptôme au lieu de la cause racine', 'Traiter toutes les causes au lieu des plus importantes (Pareto)'],
  },
  improve: {
    key: 'Chaque solution doit répondre à une cause racine prouvée. On la choisit sur des critères explicites, on la teste à petite échelle, puis on vérifie le gain avant de déployer.',
    pitfalls: ['Choisir la solution du chef sans critères', 'Déployer partout sans pilote', 'Ignorer les risques créés par la solution (AMDEC)', 'Changer plusieurs choses à la fois sans savoir laquelle a marché'],
  },
  control: {
    key: 'Sans pérennisation, le processus revient à son ancien état. On prouve le gain, on surveille, on standardise, puis on rend le processus à son propriétaire.',
    pitfalls: ['Clôturer avant d\'avoir prouvé le gain sur la durée', 'Pas de réaction définie quand une carte de contrôle alerte', 'Des standards écrits mais ni formés ni audités', 'Ne pas capitaliser : le même problème réapparaît ailleurs'],
  },
}

export const LESSONS: Record<string, Lesson> = {
  qqoqcpc: {
    why: 'Décrire un problème par des faits vérifiables, pour que toute l\'équipe parle de la même chose.',
    how: ['Répondre à chaque question par des faits observés (pas d\'opinion)', 'Quoi : le défaut ou l\'écart constaté ; Qui : qui le constate, qui est concerné', 'Où et Quand : lieu, poste, période, fréquence', 'Comment : circonstances ; Pourquoi : enjeu (pas la cause) ; Combien : ampleur chiffrée', 'Résumer en un énoncé du problème d\'une ou deux phrases'],
    tips: ['« Pourquoi » décrit l\'enjeu pour le client ou l\'entreprise, pas la cause du problème', 'Si une réponse est inconnue, c\'est une donnée à collecter'],
  },
  method: {
    why: 'Adapter l\'effort au problème : inutile de lancer six mois de DMAIC pour un problème simple.',
    how: ['Évaluer la complexité du problème et si la solution est déjà connue', 'Solution connue, problème simple : Kaizen / PDCA', 'Complexité moyenne, travail en groupe : A3 ou 8D (8D si client à protéger vite)', 'Cause inconnue, variabilité, données à analyser : DMAIC'],
    tips: ['Toutes ces démarches suivent les mêmes grandes étapes : définir, chercher les causes, chercher des solutions, valider, pérenniser'],
  },
  voc: {
    why: 'Traduire ce que dit le client en caractéristiques mesurables (CTQ) avec une cible et des limites.',
    how: ['Collecter les verbatims : réclamations, enquêtes, entretiens', 'Identifier le besoin derrière chaque verbatim', 'Traduire chaque besoin en caractéristique mesurable (CTQ)', 'Fixer une cible et des limites acceptables'],
    tips: ['Un CTQ sans unité de mesure n\'est pas un CTQ', 'Le client peut être interne (poste suivant)'],
  },
  kano: {
    why: 'Distinguer les attentes obligatoires (dont l\'absence fâche) des attentes qui font la différence.',
    how: ['Pour chaque attente, poser deux questions : si elle est présente ? si elle est absente ?', 'Classer les réponses avec la table de Kano', 'Retenir la catégorie majoritaire et les coefficients de satisfaction'],
    tips: ['Les attentes obligatoires ne rapportent rien quand elles sont satisfaites, mais coûtent cher quand elles manquent', 'Les catégories évoluent dans le temps : l\'attractif d\'hier devient obligatoire'],
  },
  sipoc: {
    why: 'Fixer le périmètre du processus étudié en une vue : d\'où il part, où il s\'arrête, qui le nourrit et qui il sert.',
    how: ['Décrire le processus en 4 à 7 grandes étapes', 'Lister les sorties et leurs clients', 'Lister les entrées et leurs fournisseurs', 'Valider les bornes (début / fin) avec le commanditaire'],
    tips: ['On remplit souvent le P d\'abord, puis O et C, puis I et S'],
  },
  vsm: {
    why: 'Voir tout le flux, du fournisseur au client : où la valeur est créée et où le temps est perdu.',
    how: ['Suivre une famille de produits à travers tous les postes', 'Relever temps de cycle, changements de série, disponibilité, stocks', 'Tracer la ligne de temps : attentes (stocks) et temps de valeur ajoutée', 'Calculer le Lead Time et la part de valeur ajoutée'],
    tips: ['La VSM se fait sur le terrain, pas au bureau', 'Le temps à valeur ajoutée est souvent moins de 1 % du Lead Time'],
  },
  line: {
    why: 'Décrire la ligne (postes, temps, pannes, stocks, demande) pour pouvoir la simuler et tester des améliorations sans risque.',
    how: ['Créer un poste par opération, dans l\'ordre du flux', 'Renseigner temps de cycle, changement de série, disponibilité, taux de défauts', 'Régler la journée, la demande et la taille de lot', 'Vérifier que la simulation ressemble à la réalité observée'],
    tips: ['Commencez simple, puis affinez le poste goulot en priorité'],
  },
  charter: {
    why: 'Contractualiser le projet avec le commanditaire : problème, enjeu, objectif, périmètre, équipe et planning.',
    how: ['Énoncer le problème (issu du QQOQCPC)', 'Chiffrer l\'enjeu (coût de non-qualité, pénalités, perte de ventes)', 'Fixer un objectif SMART : spécifique, mesurable, atteignable, réaliste, daté', 'Préciser le périmètre (dans / hors), l\'équipe et les jalons', 'Faire valider par le commanditaire'],
    tips: ['L\'indicateur de départ sera mesuré précisément en phase Mesurer'],
  },
  power: {
    why: 'Décider combien de mesures collecter : assez pour détecter l\'écart qui compte, sans gaspiller.',
    how: ['Fixer l\'écart à détecter (en unité du CTQ) et l\'écart-type attendu', 'Choisir le risque α (souvent 5 %) et la puissance visée (souvent 80 %)', 'Lire l\'effectif nécessaire'],
    tips: ['Plus l\'écart à détecter est petit, plus il faut de mesures (effectif × 4 quand l\'écart est divisé par 2)'],
  },
  'defect-log': {
    why: 'Relever les défauts de façon structurée (type, poste, nombre, coût) pour pouvoir les hiérarchiser ensuite.',
    how: ['Définir les catégories de défauts avant de commencer', 'Relever chaque jour : date, catégorie, poste, quantité, conséquence, coût', 'Garder les mêmes catégories sur toute la période'],
    tips: ['Une feuille de relevés simple et tenue vaut mieux qu\'un système parfait abandonné'],
  },
  msa: {
    why: 'Vérifier que la variation vient des pièces et non de l\'instrument (répétabilité) ou des opérateurs (reproductibilité).',
    how: ['Choisir 10 pièces couvrant la plage de fabrication', '2 ou 3 opérateurs mesurent chaque pièce 2 ou 3 fois, dans un ordre aléatoire', 'Lire le %R&R et le nombre de catégories distinctes (ndc)'],
    tips: ['%R&R < 10 % : bon ; 10 à 30 % : acceptable selon l\'enjeu ; > 30 % : à améliorer avant toute analyse', 'ndc ≥ 5 pour pouvoir distinguer les pièces'],
  },
  cmc: {
    why: 'Vérifier rapidement qu\'un moyen de contrôle est assez précis par rapport à la tolérance.',
    how: ['Plusieurs contrôleurs mesurent les mêmes pièces', 'Estimer la dispersion de mesure à partir des étendues', 'Comparer la tolérance à 6 fois cette dispersion (Cmc)'],
    tips: ['Cmc > 4 : moyen capable ; < 3 : à améliorer'],
  },
  data: {
    why: 'Travailler sur vos données réelles plutôt que sur des estimations.',
    how: ['Télécharger le modèle Excel (ligne, mesures, défauts)', 'Importer le classeur, un CSV ou un copier-coller', 'Vérifier l\'association des colonnes', 'Caler le modèle qualité sur vos mesures si besoin'],
    tips: ['Gardez l\'ordre chronologique des mesures : il compte pour les cartes de contrôle'],
  },
  simulation: {
    why: 'Observer le comportement du flux sur une journée : files d\'attente, goulot, pannes, encours.',
    how: ['Lancer la journée et accélérer', 'Repérer où les pièces s\'accumulent', 'Suivre une pièce pour voir où elle attend'],
    tips: ['Une même graine aléatoire donne la même journée : changez-la pour voir la variabilité'],
  },
  kpi: {
    why: 'Chiffrer la performance du flux : rythme client, capacité, délais, rendement.',
    how: ['Comparer le temps de cycle du goulot au Takt Time', 'Lire le Lead Time et la part de valeur ajoutée', 'Lire le TRS = disponibilité × performance × qualité'],
    tips: ['Si le temps de cycle du goulot dépasse le Takt, la demande ne peut pas être servie', 'Le TRS d\'un poste non goulot est faible par construction'],
  },
  dist: {
    why: 'Regarder la forme des données avant de calculer : centrage, dispersion, normalité, valeurs aberrantes.',
    how: ['Tracer l\'histogramme et le comparer aux limites', 'Vérifier la normalité (droite de Henry, Anderson-Darling)', 'Repérer les mélanges de populations (plusieurs bosses)'],
    tips: ['Une distribution à deux bosses signale souvent deux machines, deux équipes ou deux lots'],
  },
  capability: {
    why: 'Savoir si le processus est capable de produire dans les tolérances, et s\'il est bien centré.',
    how: ['Vérifier d\'abord que le processus est stable (carte de contrôle)', 'Vérifier la normalité (sinon Box-Cox)', 'Lire Cp (dispersion seule) et Cpk (dispersion + centrage)'],
    tips: ['Cpk très inférieur à Cp : le processus est décentré, souvent facile à corriger', 'Convention française : Cm/Cmk (machine, objectif > 2), Cp/Cpk (processus, objectif > 1,33 à 1,66)'],
  },
  pareto: {
    why: 'Concentrer l\'effort sur les quelques causes qui expliquent la majorité des défauts ou des coûts.',
    how: ['Classer les catégories par ordre décroissant', 'Tracer le cumul en pourcentage', 'Retenir les catégories qui font environ 80 %'],
    tips: ['Faire un Pareto en nombre et un en coût : ils ne donnent pas toujours le même ordre'],
  },
  muda: {
    why: 'Repérer les 8 gaspillages : surproduction, attentes, transports, traitements inutiles, stocks, mouvements, défauts, compétences inutilisées.',
    how: ['Observer le flux poste par poste', 'Classer chaque gaspillage observé dans une des 8 familles', 'Chiffrer son impact et prioriser'],
    tips: ['La surproduction est le pire : elle crée les autres (stocks, transports, attentes)'],
  },
  toc: {
    why: 'La ligne ne va pas plus vite que son goulot : améliorer ailleurs ne sert à rien.',
    how: ['Identifier le goulot (poste le plus chargé)', 'L\'exploiter au maximum (pas de panne, pas d\'attente)', 'Subordonner le reste du flux à son rythme', 'Augmenter sa capacité si nécessaire, puis recommencer'],
    tips: ['Une heure perdue au goulot est une heure perdue pour toute l\'usine'],
  },
  spaghetti: {
    why: 'Visualiser les déplacements des personnes ou des pièces pour réduire les distances parcourues.',
    how: ['Tracer chaque trajet sur le plan de l\'atelier', 'Mesurer les distances journalières', 'Tester une autre implantation et comparer'],
    tips: ['Un tracé très enchevêtré révèle une implantation par fonction plutôt que par flux'],
  },
  ideas: {
    why: 'Produire beaucoup d\'idées en groupe, puis les organiser par affinité (méthode KJ).',
    how: ['Une idée par post-it, sans critique pendant la production', 'Regrouper les idées proches en familles', 'Nommer chaque famille', 'Voter pour faire émerger les priorités'],
    tips: ['La quantité d\'abord : la qualité vient au tri'],
  },
  ishikawa: {
    why: 'Lister toutes les causes possibles d\'un effet, classées en 6M pour ne rien oublier.',
    how: ['Écrire l\'effet (le problème) à la tête du poisson', 'Chercher les causes par famille : Matière, Milieu, Méthode, Matériel, Main-d\'œuvre, Mesure', 'Marquer les causes probables à vérifier par les données'],
    tips: ['Ce sont des hypothèses : elles doivent être confirmées en 3.3'],
  },
  why: {
    why: 'Remonter d\'un symptôme à sa cause racine en demandant « pourquoi ? » successivement.',
    how: ['Partir du problème constaté', 'Demander pourquoi, en s\'appuyant sur des faits', 'Répéter jusqu\'à une cause sur laquelle on peut agir (souvent 5 fois)'],
    tips: ['Si la réponse est « erreur humaine », continuer : pourquoi l\'erreur était-elle possible ?'],
  },
  fmea: {
    why: 'Anticiper les défaillances possibles et leurs causes, et prioriser les actions par le risque.',
    how: ['Lister les modes de défaillance par étape', 'Noter gravité, occurrence et détection (1 à 10)', 'Calculer NPR = G × O × D et traiter les plus élevés', 'Réévaluer après action'],
    tips: ['Une gravité élevée se traite même si le NPR est moyen'],
  },
  wizard: {
    why: 'Choisir le bon test statistique sans se tromper, en suivant l\'algorithme de décision : conditions d\'abord, test ensuite, conclusion pratique enfin.',
    how: ['Dire ce que l\'on cherche : comparer des groupes, comparer à une cible, comparer des dispersions, lier deux mesures, lier deux catégories', 'Coller les données (une colonne par groupe)', 'L\'appli vérifie la normalité (Anderson-Darling) puis l\'égalité des variances', 'Elle choisit le test : t, Welch, apparié, ANOVA, ou leur équivalent non paramétrique (Mann-Whitney, Wilcoxon, Kruskal-Wallis, Levene, Spearman)', 'Lire la conclusion et la noter comme preuve'],
    tips: ['p < α : différence prouvée ; p ≥ α : pas de preuve (pas forcément pas de différence : l\'échantillon est peut-être trop petit)', 'Des données non normales cachent souvent un mélange (deux machines, deux équipes) : cherchez la cause avant de conclure', 'Un résultat significatif n\'est pas forcément important : regardez aussi l\'ampleur de l\'écart'],
  },
  corr: {
    why: 'Vérifier si un paramètre est lié au CTQ, et de combien il le fait varier.',
    how: ['Tracer le nuage de points paramètre / CTQ', 'Lire le coefficient r et sa p-valeur', 'Ajuster une régression pour chiffrer l\'effet'],
    tips: ['Corrélation n\'est pas causalité : confirmer par un essai (plan d\'expériences)', 'r² = part de variation expliquée'],
  },
  explore: {
    why: 'Voir d\'un coup d\'œil d\'où vient la variation : d\'une pièce à l\'autre, dans le temps, ou d\'un lot à l\'autre.',
    how: ['Tracer les boîtes à moustaches par groupe', 'Tracer le multi-vari (pièce, sous-groupe, lot)', 'Identifier la famille de variation dominante'],
    tips: ['La famille dominante oriente la recherche : variation entre lots = réglages ou matière'],
  },
  anova: {
    why: 'Tester si les moyennes de plusieurs groupes (machines, équipes, lots) sont différentes.',
    how: ['Choisir le facteur', 'Lire la p-valeur : < 0,05, au moins un groupe diffère', 'Lire la part de variation expliquée par le facteur'],
    tips: ['Vérifier que les dispersions des groupes sont comparables'],
  },
  tests: {
    why: 'Savoir si une différence observée est réelle ou due au hasard.',
    how: ['Formuler H0 (pas de différence) et H1', 'Choisir le test (t, F, proportions)', 'Conclure avec la p-valeur au risque choisi'],
    tips: ['« H0 non rejetée » ne prouve pas l\'égalité : l\'effectif est peut-être trop faible'],
  },
  chi2: {
    why: 'Tester si deux variables qualitatives sont liées (ex. type de défaut et équipe).',
    how: ['Construire le tableau de contingence', 'Comparer aux effectifs attendus sans lien', 'Conclure avec la p-valeur'],
    tips: ['Effectifs attendus d\'au moins 5 par case pour que le test soit fiable'],
  },
  process: {
    why: 'Comprendre l\'effet des réglages (température, pression, vitesse) sur le CTQ, et tester un nouveau réglage.',
    how: ['Faire varier un réglage à la fois et observer le CTQ prédit', 'Tester le réglage en simulation', 'Appliquer au scénario si le gain est confirmé'],
    tips: ['Un réglage qui recentre le processus améliore le Cpk sans réduire la dispersion'],
  },
  root: {
    why: 'Faire la synthèse des causes racines prouvées, qui seront traitées en phase Innover.',
    how: ['Reprendre les causes probables (Ishikawa) et les causes racines (5 Pourquoi)', 'Ne garder que celles confirmées par les données', 'Indiquer leur poids sur le problème'],
    tips: ['Chaque cause retenue devra avoir au moins une solution en 4.1'],
  },
  plan: {
    why: 'Faire chiffrer par l\'appli les leviers d\'amélioration détectés sur votre ligne : gain, coût, retour sur investissement.',
    how: ['Lire le diagnostic (goulot, changements de série, pannes, défauts, centrage)', 'Comparer les actions proposées, simulées avec les mêmes aléas', 'Créer le scénario amélioré à partir des actions retenues'],
    tips: ['Le gain dépend de la justesse de vos paramètres : vérifiez temps de cycle et coûts'],
  },
  smed: {
    why: 'Réduire le temps de changement de série pour produire en plus petits lots sans perdre de capacité.',
    how: ['Filmer et décomposer le changement en opérations', 'Séparer internes (machine arrêtée) et externes (machine en marche)', 'Passer un maximum d\'opérations en externe', 'Réduire les internes restantes (bridage rapide, standardisation)'],
    tips: ['Le gain sert d\'abord à réduire la taille des lots, donc les stocks et le Lead Time'],
  },
  kanban: {
    why: 'Piloter le flux en tiré : on ne produit que ce qui a été consommé, ce qui plafonne les encours.',
    how: ['Calculer le nombre de cartes : demande × délai de réapprovisionnement × (1 + sécurité) / taille du conteneur', 'Plafonner chaque stock à ce nombre de conteneurs', 'Réduire progressivement le nombre de cartes pour faire apparaître les problèmes'],
    tips: ['Kanban ne marche bien qu\'avec des changements de série courts (SMED d\'abord)'],
  },
  vote: {
    why: 'Choisir collectivement les solutions sur des critères explicites plutôt qu\'à l\'intuition.',
    how: ['Définir 3 à 5 critères et leur poids', 'Noter chaque solution 1, 3 ou 9 par critère', 'Score = somme des notes × poids ; classer'],
    tips: ['L\'échelle 1-3-9 force à trancher entre solutions'],
  },
  doe: {
    why: 'Trouver le meilleur réglage en testant plusieurs facteurs à la fois, avec peu d\'essais.',
    how: ['Choisir les facteurs et deux niveaux pour chacun', 'Réaliser les essais du plan, dans un ordre aléatoire', 'Lire les effets et interactions significatifs', 'Choisir et confirmer le réglage optimal'],
    tips: ['Changer un facteur à la fois rate les interactions et coûte plus d\'essais'],
  },
  lss: {
    why: 'Comparer les gains du Lean (flux), du Six Sigma (variabilité) et de leur combinaison, avec le retour sur investissement.',
    how: ['Choisir la situation avant et la situation après', 'Comparer débit, Lead Time, défauts, coûts', 'Lire le ROI et le délai de retour'],
    tips: ['Moyennez plusieurs journées (mode robustesse) avant de conclure'],
  },
  scenarios: {
    why: 'Garder la trace des situations comparées (avant / après) et des versions successives.',
    how: ['Dupliquer le scénario avant de modifier', 'Enregistrer une version avant une grosse modification', 'Comparer deux scénarios sur les indicateurs clés'],
    tips: ['Nommez vos scénarios clairement : « état actuel », « après SMED »…'],
  },
  spc: {
    why: 'Détecter une dérive du processus avant qu\'elle ne produise des pièces hors tolérance.',
    how: ['Choisir la carte selon la donnée (X̄-R, I-MR pour mesures ; p, np, c, u pour attributs)', 'Calculer les limites sur une période stable', 'Surveiller les points hors limites et les règles de tendance', 'Définir la réaction en cas d\'alerte'],
    tips: ['Les limites de contrôle viennent du processus, pas des tolérances client'],
  },
  'control-plan': {
    why: 'Écrire qui surveille quoi, comment, à quelle fréquence, et quoi faire en cas d\'écart.',
    how: ['Lister les caractéristiques à surveiller', 'Pour chacune : méthode, fréquence, taille d\'échantillon, carte', 'Définir la réaction et le responsable'],
    tips: ['Une surveillance sans réaction définie ne sert à rien'],
  },
  '5s': {
    why: 'Organiser le poste pour que les anomalies sautent aux yeux et que le standard tienne.',
    how: ['Seiri : trier ; Seiton : ranger ; Seiso : nettoyer', 'Seiketsu : standardiser ; Shitsuke : faire durer', 'Auditer régulièrement et suivre le score'],
    tips: ['Le 5S est la base des autres outils : sans ordre, pas de standard'],
  },
  kaizen: {
    why: 'Faire vivre l\'amélioration continue par petites actions rapides, suivies selon le PDCA.',
    how: ['Plan : décrire le problème et l\'action', 'Do : réaliser à petite échelle', 'Check : mesurer avant / après', 'Act : standardiser ou corriger, puis recommencer'],
    tips: ['Beaucoup de petites améliorations tenues valent mieux qu\'une grande oubliée'],
  },
  reports: {
    why: 'Présenter le projet et ses résultats, et archiver ce qui a été appris.',
    how: ['Choisir les scénarios avant / après', 'Choisir les sections', 'Générer le PDF'],
    tips: ['Le rapport de projet, l\'A3 et le 8D sont aussi générés depuis l\'espace projet'],
  },
  a3: {
    why: 'Résumer tout le projet sur une seule page, lisible par n\'importe qui.',
    how: ['À gauche : contexte, situation actuelle, objectif, analyse des causes', 'À droite : contre-mesures, plan d\'action, suivi des résultats', 'Rester factuel et visuel'],
    tips: ['Si ça ne tient pas sur une page, le problème est mal cerné'],
  },
  '8d': {
    why: 'Traiter un problème (souvent une réclamation client) en 8 disciplines, du confinement à la prévention.',
    how: ['D1 équipe, D2 description, D3 actions de confinement', 'D4 causes racines, D5 actions correctives choisies, D6 mise en œuvre', 'D7 prévention de la récurrence, D8 félicitations et clôture'],
    tips: ['Le confinement (D3) protège le client tout de suite, avant même de connaître la cause'],
  },
}

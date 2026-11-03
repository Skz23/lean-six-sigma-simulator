# Architecture logicielle

## Choix techniques

| Besoin | Choix | Raison |
|---|---|---|
| Interface | React 19 + TypeScript | typage fort des modèles industriels, écosystème mature |
| Style | Tailwind CSS 4 | design system cohérent, mode clair/sombre par variables CSS |
| Graphiques | Recharts | composants React interactifs (infobulles, légendes) |
| État + persistance | Zustand + `persist` (localStorage) | simple, isolé dans `src/store` : remplaçable par une API REST / base de données |
| Statistiques | bibliothèque interne `src/stats`, testée contre SciPy | contrôle total des formules, aucune dépendance opaque, documentée |
| PDF | jsPDF + jspdf-autotable (chargés à la demande) | génération 100 % côté client |
| Tests | Vitest | même pipeline que Vite |
| Routage | React Router (HashRouter) | déploiement statique sans configuration serveur |

L'application est entièrement statique : `npm run build` produit un dossier `dist/` déployable sur n'importe quel hébergement (Netlify, GitHub Pages, Nginx…).

## Organisation du code

```
src/
  engine/          Moteur de simulation commun (cœur du projet)
    types.ts       Modèles de données : Station, Scenario, ProcessModel, Product, SimResults…
    random.ts      Générateur reproductible et lois (normale, log-normale, exponentielle)
    processModel.ts Modèle statistique de la caractéristique critique (CTQ)
    simulation.ts  Simulation de la ligne (LineSimulation : pas à pas, instantané, résultats)
    kpi.ts         Indicateurs Lean / qualité / économie à partir des résultats
    compare.ts     Indicateurs comparés avant / après, rentabilité
  stats/           Bibliothèque statistique (distributions, descriptives, capabilité, SPC,
                   inférence, régression, ANOVA, normalité, DOE, métriques sigma)
  lean/            Outils Lean (takt, kanban, SMED, 5S, VSM, spaghetti, équilibrage) et Muda
  data/            Jeux de données de démonstration (MécaPrécis SAS)
  store/           État global persistant, cache des simulations
  components/      Composants d'interface, graphiques, outils qualité réutilisables
  pages/           Pages : dashboard, lean/*, sixsigma/*, LSS, scénarios, rapports, docs
  report/          Génération du rapport PDF
docs/              Hypothèses, formules, architecture
```

## Flux de données

```
Scenario (configuration) ──► LineSimulation ──► SimResults (pièces, temps par état, séries)
        ▲                                              │
        │                                              ▼
  pages d'édition                              computeKpis ──► Kpis
  (ligne, procédé, SMED,                               │
   kanban, DOE…)                                       ▼
        └──── updateScenario (+ version) ◄──── pages d'analyse (Lean, Six Sigma, LSS, rapports)
```

- Un **scénario** est la seule source de vérité. Les modules Lean et Six Sigma lisent et modifient le même objet : réduire un temps de cycle (Lean) change le débit vu par Six Sigma ; changer une consigne de température (Six Sigma) change les rebuts et le débit vus par Lean.
- `runScenario` met en cache les résultats par empreinte de configuration (une journée ≈ 50–150 ms).
- Chaque modification appliquée depuis un outil crée une **version** restaurable.

## Évolutions envisagées

- Persistance serveur (API + PostgreSQL) en remplaçant `useStore` par des appels réseau.
- Multi-références produit et matrice de changements de série.
- Partage d'opérateurs entre postes, retouches, maintenance préventive planifiée.
- Web Worker pour les réplications longues.

## Démarche DMAIC (navigation)

`src/workflow/phases.ts` est la source unique de l'organisation par démarche : les 5 phases (objectif, questions, livrables, revue de fin de phase, équivalent MARP) et le catalogue des outils (adresse, famille, phases où ils servent, outils incontournables). Le menu, les pages de phase (`/dmaic/:phase`), la boîte à outils (`/outils`), le guide et le fil d'Ariane des outils en sont dérivés. Les onglets des pages multi-outils sont pilotés par l'adresse (`?tab=`, `src/lib/useUrlTab.ts`) pour pouvoir ouvrir un outil directement. Les adresses historiques des outils sont conservées. Un test vérifie que chaque outil du catalogue pointe vers une route et un onglet existants.

## Projets

Un projet (`DmaicProject`, `tools.dmaic`) porte sa démarche (`method` : DMAIC complet ou parcours allégé Kaizen / A3 / 8D), sa phase en cours, les outils faits et les résultats retenus (clé « sous-étape:outil », ex. `2.2:msa`), les cases de revue de fin de phase et ses scénarios. Le projet en cours (`currentProjectId`) est choisi en haut de l'écran ; l'ouvrir active son scénario. Les outils SMED (`tools.smed`, clé scénario:poste), 5S (`tools.fiveS`, clé scénario), Kanban (`tools.kanban`, clé scénario) et spaghetti (positions des postes du scénario) sont rattachés au scénario : un projet créé avec sa propre copie de scénario a donc des données propres. Les calculs d'avancement sont dans `src/workflow/project.ts` (testés).

## Projets de A à Z, rappels de cours et livrables

- Au lancement, `Welcome` propose : reprendre son projet, créer un projet de A à Z (ligne vierge `blankScenario` possible) ou voir l'exemple MécaPrécis.
- Données propres au projet : en plus du scénario, l'AMDEC, le registre des défauts, le Kaizen et les fiches problème / Kano (`ProjectWorkspace`). Le projet en cours les garde dans `tools` ; `openProject` range celles du projet quitté dans `project.ws` et sort celles du projet ouvert. `workspaceOf` lit celles de n'importe quel projet. Ishikawa et 5 Pourquoi étaient déjà dans le projet.
- Rappels de cours (`src/workflow/lessons.ts`) : un par outil (à quoi ça sert, comment faire, à savoir) affiché en tête de l'outil, un par phase (l'essentiel, pièges fréquents). Rédaction propre à l'appli.
- Livrables PDF (`src/report/projectPdf.ts`, contenu assemblé par `projectContent.ts`, testé) : rapport de projet, revue d'une phase, A3 (A3 paysage) et 8D. Ce qui est écrit à la main dans les fiches A3 / 8D est prioritaire ; sinon le texte est composé à partir de la charte, des résultats retenus, du Pareto, des causes, des solutions retenues, des actions et du plan de contrôle.

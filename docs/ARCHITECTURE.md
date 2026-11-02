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

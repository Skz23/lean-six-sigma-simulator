# Lean Six Sigma Simulator

Laboratoire virtuel industriel : simuler une ligne de production, analyser ses problèmes avec les outils **Lean Manufacturing** et **Six Sigma**, tester des améliorations et mesurer leurs gains.

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (formules Lean, statistiques, moteur, rapport PDF)
npm run build      # version de production statique dans dist/
```

Prérequis : Node.js ≥ 20. Les données sont sauvegardées dans le navigateur (localStorage) ; export/import JSON depuis « Gestion des scénarios ».

## Fonctionnalités

**Moteur de simulation commun** — ligne en série à stocks finis, temps de cycle aléatoires, pannes (MTBF/MTTR), changements de série, défauts, manutention, pauses, flux poussé ou tiré, journée de mise en régime, graine reproductible. Chaque pièce porte un identifiant, son historique par poste, ses paramètres de fabrication, sa dimension et son statut.

**Lean Manufacturing** — éditeur de ligne (ajout, modification, suppression, déplacement par glisser-déposer), simulation animée (démarrer / pause / arrêter / réinitialiser, vitesse réglable, détection du goulot, historique d'une pièce), indicateurs (Takt, Cycle Time, Lead Time, Throughput, WIP, TRS, productivité, rendement, VA/NVA, PCE, Yamazumi), analyse des 8 Muda, VSM générée, SMED avec simulation des gains, Kanban (calcul et passage en flux tiré), audit 5S, diagramme spaghetti interactif, tableau Kaizen.

**Six Sigma** — projets DMAIC (charte, VOC/CTQ, SIPOC, mesure, DPMO, Ishikawa, 5 Pourquoi, vérification statistique, matrice de solutions, DOE, comparaison, cartes de contrôle, plan de contrôle, suivi sur 10 jours), paramètres procédé (what-if, contributions à la variance), capabilité (Cp/Cpk court terme vs Pp/Ppk long terme, normalité, interprétation), SPC (X̄-R, I-MR, p, np, c, u, 8 règles), analyse des défauts (registre, Pareto, Ishikawa 6M, 5 Pourquoi, AMDEC/NPR), statistiques avancées (corrélation, régressions, tests t/F/proportions, ANOVA, DOE 2³, distributions et droite de Henry).

**Lean Six Sigma** — démarche guidée en 6 étapes, tableau de bord comparatif (gains Lean, Six Sigma, combinés), rentabilité (gain annuel, ROI, délai de retour), mode robustesse (8 journées, IC 95 %).

**Scénarios et rapports** — situation initiale, Lean, Six Sigma, Lean Six Sigma (démo), duplication, versions restaurables, comparaison multi-scénarios ; rapport PDF en 11 sections.

## Jeu de démonstration

*MécaPrécis SAS* usine des arbres Ø25 ±0,05 mm (demande 420 pièces/jour). Situation initiale : flux poussé, lots de 120, changements de série longs (25 min sur le tour), goulot entre tour et fraiseuse, consigne de température décentrée → Lead Time ≈ 4 h, Cpk ≈ 0,7, 7 % de défauts. Les scénarios améliorés montrent l'effet du SMED, du kanban, de l'implantation en U, de la TPM, du recentrage par DOE et de la régulation thermique.

## Documentation

- [Hypothèses statistiques et industrielles](docs/HYPOTHESES.md)
- [Formules et méthodes de calcul](docs/FORMULES.md)
- [Architecture logicielle](docs/ARCHITECTURE.md)

Ces documents sont aussi consultables dans l'application (menu « Hypothèses & formules »).

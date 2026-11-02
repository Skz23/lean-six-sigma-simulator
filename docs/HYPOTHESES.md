# Hypothèses statistiques et industrielles

Ce document décrit le modèle utilisé par le moteur de simulation commun. Aucune valeur affichée n'est « embellie » : tous les indicateurs sont calculés à partir des pièces effectivement simulées.

## 1. Ligne de production

- Ligne **en série** de N postes, chaque poste disposant de `capacité` machines identiques en parallèle.
- Simulation **à pas de temps fixe** (dt = 1 s) avec report exact des fins d'opération à l'intérieur du pas : une opération terminée à t + 0,4 s libère la machine à cet instant et la pièce suivante démarre immédiatement (pas de biais d'arrondi sur les temps de cycle).
- Ordre de traitement : de l'aval vers l'amont à chaque pas, pour libérer la place avant que l'amont ne pousse.
- **Temps de cycle** : loi log-normale de moyenne = temps de cycle nominal et coefficient de variation `CV` (CV = 0 : déterministe). La log-normale est positive et asymétrique, comme les temps opératoires réels.
- **Pannes** : défaillances dépendantes du fonctionnement (le compteur avance uniquement quand le poste produit). Temps de bon fonctionnement ~ Exponentielle(MTBF), réparation ~ Exponentielle(MTTR), avec MTBF = MTTR · A / (1 − A), où A est la disponibilité saisie. A est donc la disponibilité d'un poste chargé en permanence.
- **Changements de série** : les pièces sont lancées par lots de `taille de lot`. Un poste effectue un changement de série (durée fixe C/O) à l'arrivée de la première pièce d'un nouveau lot, une fois toutes ses machines vides.
- **Stocks intermédiaires** : capacité finie (blocage après service : une machine qui ne peut pas évacuer sa pièce reste bloquée). Les pièces en manutention comptent dans le stock de destination.
- **Manutention** : temps = distance / vitesse de manutention, pièce à pièce.
- **Pauses** : tous les postes et manutentions s'arrêtent ; les expéditions aussi.
- **Défauts de poste** : à la fin de chaque opération, une pièce est rebutée avec la probabilité « taux de défauts » du poste ; la catégorie est tirée uniformément parmi les catégories du poste. Les pièces rebutées quittent la ligne (pas de retouche).
- **Approvisionnement** : matière première illimitée au premier poste.
- **Pilotage** :
  - *push* : le premier poste lance dès qu'il est libre ; le stock produits finis n'est pas plafonné ;
  - *pull* : le dernier poste ne peut déposer que si le supermarché produits finis est sous son plafond ; les plafonds des stocks intermédiaires jouent le rôle des boucles kanban.
- **Client** : la demande journalière est consommée au rythme du takt pendant le temps d'ouverture hors pauses ; les manquants sont comptés en retard (pénalité par pièce).
- **Mise en régime** : par défaut, une journée complète est simulée avant la journée mesurée, puis les compteurs sont remis à zéro (l'état physique — stocks, pannes en cours — est conservé). Cela évite le biais de démarrage « ligne vide » ou « stocks arbitraires ». Les pièces présentes au début de la journée mesurée sont marquées « préchargées » et exclues du Lead Time observé.
- **Reproductibilité** : générateur mulberry32 ; chaque poste et le modèle procédé ont leur propre flux, dérivé de la graine. Deux scénarios avec la même graine partagent les mêmes aléas (*nombres aléatoires communs*), ce qui rend les comparaisons avant/après plus fiables. L'option « robustesse » répète 8 journées indépendantes et donne un intervalle de confiance à 95 % (loi de Student).

## 2. Données produites par pièce

Identifiant, lot, instant de lancement et de sortie, historique (arrivée en file, début, fin) par poste, temps de manutention, paramètres réels de fabrication (T, P, V), dimension mesurée, statut conforme / non conforme, défaut éventuel (type, poste, instant).

## 3. Modèle procédé de la caractéristique critique (CTQ)

Pour chaque pièce passant au poste CTQ :

```
Y = μ0 + bT·(T − Tref) + bP·(P − Pref) + bV·(V − Vref) + bTV·(T − Tref)·(V − Vref)/1000 + δlot + u·k + ε
T, P, V ~ Normale(consigne, σ régulation)
δlot  ~ Normale(0, σlot)          tiré à chaque changement de série (qualité du réglage)
u·k                               usure outil : k = rang de la pièce depuis le dernier changement de série
ε     ~ Normale(0, σe·(V/Vref)^γ) répétabilité machine, dégradée par la vitesse
```

- Une pièce est **non conforme** si Y < LSL ou Y > USL ; elle est rebutée au poste CTQ.
- La **vitesse de coupe** réduit le temps de cycle du poste CTQ (CT = CTnominal · Vref / V) : c'est le lien explicite Lean ↔ Six Sigma (débit contre dispersion).
- La **température** décale la moyenne (dilatation) : c'est la cause racine du jeu de démonstration (consigne 43 °C pour un optimum à 35 °C).
- **Court terme / long terme** : la variation intra-sous-groupe (pièces consécutives) contient la régulation, la répétabilité et très peu d'usure ; la variation totale contient en plus les décalages entre lots et l'usure. D'où Cp/Cpk (σ intra) ≥ Pp/Ppk (σ global) en général.
- La **prédiction analytique** (page Paramètres procédé) utilise la méthode delta au premier ordre ; elle est validée par Monte-Carlo dans les tests unitaires (écart < 10 % sur σ).
- Le **DOE** n'invente aucune réponse : chaque essai fabrique réellement des pièces avec le modèle ci-dessus (un nouveau lot, donc un nouveau δlot, par essai).

## 4. Hypothèses économiques

| Poste | Hypothèse |
|---|---|
| Chiffre d'affaires | pièces expédiées × prix de vente (plafonné par la demande) |
| Matière | pièces lancées × coût matière |
| Main-d'œuvre | opérateurs × heures d'ouverture × coût horaire chargé |
| Possession des stocks | (WIP moyen + stock PF) × valeur unitaire × taux annuel / jours ouvrés |
| Coût de non-qualité | Σ pièces rebutées × (matière + main-d'œuvre déjà consommée selon leur historique) |
| Pénalités | pièces non livrées × pénalité unitaire |
| Gain annuel | Δ marge journalière × jours ouvrés |
| ROI | gain annuel / investissement des actions propres au scénario amélioré |

## 5. Détection des gaspillages (Muda)

Chaque Muda reçoit un score 0–100 (faible < 30 ≤ modéré < 60 ≤ élevé) selon des règles explicites :

| Muda | Mesure utilisée | Score |
|---|---|---|
| Surproduction | pièces bonnes − demande ; jours de stock PF | 400 × excédent/demande + 60 × jours PF |
| Attente | temps opérateurs en famine et bloqués ; part d'attente dans le Lead Time | 150 × part d'attente opérateurs + 40 × part d'attente pièces |
| Transport | distance parcourue par pièce | 0,6 × mètres |
| Surprocessus | temps des postes sans valeur ajoutée | 200 × part NVA du temps opératoire |
| Stocks | (WIP + PF) en jours de demande | 120 × jours |
| Mouvements | mètres de marche non nécessaires (spaghetti) | mètres / 20 |
| Défauts | taux de rebut | 1200 × taux |
| Compétences | 1 − utilisation des opérateurs | 120 × inactivité |

Les coûts associés sont des estimations d'ordre de grandeur, explicitement liées aux paramètres économiques du scénario.

## 6. Limites connues

- Une seule référence produit (les changements de série modélisent des variantes d'une même famille).
- Pas de retouche : toute non-conformité est rebutée.
- Opérateurs affectés à leur poste (pas de partage dynamique entre postes).
- Les pannes sont indépendantes entre postes.
- Le décalage de 1,5 σ du niveau sigma est une convention ; le Z long terme est toujours affiché à côté.

# Formules et méthodes de calcul

Toutes les formules ci-dessous sont implémentées dans `src/stats`, `src/engine/kpi.ts` et `src/lean`, et couvertes par les tests unitaires (`npm test`). Les valeurs de référence des tests statistiques proviennent de SciPy.

## Indicateurs Lean

| Indicateur | Formule |
|---|---|
| Temps disponible | durée d'ouverture − pauses |
| Takt Time | temps disponible / demande client |
| Temps de cycle effectif d'un poste | CT / (capacité × disponibilité) + C/O / taille de lot |
| Cycle Time ligne (observé) | temps planifié / pièces bonnes |
| Throughput | pièces bonnes / heures planifiées |
| WIP moyen | moyenne temporelle du nombre de pièces dans la ligne (files, machines, manutention) |
| Lead Time (Little) | WIP moyen / débit de sortie (bonnes + rebuts) |
| Lead Time observé | moyenne de (sortie − lancement) des pièces lancées et sorties le jour même |
| TRS / OEE d'un poste | Disponibilité × Performance × Qualité |
| Disponibilité | (temps planifié − pannes − changements) / temps planifié |
| Performance | (pièces traitées × CT nominal / capacité) / temps de fonctionnement |
| Qualité | pièces conformes / pièces traitées |
| TRS ligne | Disponibilité_goulot × Performance_goulot × Qualité_ligne |
| Productivité | pièces bonnes / (opérateurs × heures d'ouverture) |
| Rendement (yield) | pièces bonnes / pièces sorties ; RTY = Π qualités des postes |
| Temps VA | Σ CT des postes à valeur ajoutée |
| Temps NVA | Lead Time − temps VA |
| PCE | temps VA / Lead Time |
| Goulot (simulation) | poste au taux d'activité (production + panne + changement) maximal |
| Efficience d'équilibrage | Σ temps / (n × temps max) ; nombre minimal de postes = ⌈Σ temps / takt⌉ |

## Outils Lean

- **Kanban** (Toyota) : N = ⌈D × L × (1 + α) / C⌉ ; D demande / jour, L délai de réapprovisionnement en jours, α sécurité, C taille de conteneur. L = délai de signal + temps de production d'un conteneur au poste fournisseur + manutention.
- **SMED** : C/O avant = Σ toutes les opérations ; après = Σ opérations internes non convertibles × (1 − réduction). Taille de lot minimale = C/O / (takt − CT effectif).
- **5S** : 5 dimensions × 4 questions notées 0–4 ; score = Σ / 16 × 100 %, global = moyenne.
- **VSM** : durée d'un stock = quantité moyenne / demande journalière ; Lead Time = Σ attentes + Σ CT + manutention.
- **Spaghetti** : distance rectilinéaire |Δx| + |Δy| ; distance journalière = 2 × distance × allers-retours ; vitesse de marche 1,1 m/s.

## Statistiques descriptives

Moyenne ; variance et écart-type sans biais (n − 1) ; quantiles type 7 (Excel/NumPy) ; asymétrie G1 et kurtosis en excès G2 corrigés (Excel/Minitab).

## Capabilité

| Indice | Formule | Écart-type utilisé |
|---|---|---|
| Cp | (USL − LSL) / 6σ_intra | σ_intra = R̄ / d₂ (sous-groupes n ≥ 2) ou MR̄ / 1,128 (n = 1) |
| Cpk | min(USL − μ, μ − LSL) / 3σ_intra | court terme |
| Pp | (USL − LSL) / 6σ_global | σ_global = écart-type (n − 1) de toutes les données |
| Ppk | min(USL − μ, μ − LSL) / 3σ_global | long terme |

PPM attendus = [Φ((LSL − μ)/σ) + 1 − Φ((USL − μ)/σ)] × 10⁶ (court ou long terme selon σ). PPM observés = comptage réel. Z.bench = Φ⁻¹(1 − p). La courbe normale n'est affichée que si le test d'Anderson-Darling ne rejette pas la normalité (option pour la forcer).

## Métriques Six Sigma

DPU = D / U ; DPO = D / (U × O) ; DPMO = DPO × 10⁶ ; Z_LT = Φ⁻¹(1 − DPO) ; niveau sigma = Z_LT + 1,5 (convention Motorola, signalée comme telle). 3,4 DPMO ↔ 6σ ; 66 807 DPMO ↔ 3σ.

## Cartes de contrôle (limites à ±3σ)

| Carte | Ligne centrale | Limites |
|---|---|---|
| X̄ | X̿ | X̿ ± A₂ R̄ |
| R | R̄ | D₃ R̄ ; D₄ R̄ |
| I | X̄ | X̄ ± 3 MR̄ / 1,128 |
| MR | MR̄ | 0 ; 3,267 MR̄ |
| p | p̄ = Σd / Σn | p̄ ± 3 √(p̄(1 − p̄)/nᵢ) (limites variables) |
| np | n p̄ | n p̄ ± 3 √(n p̄ (1 − p̄)) |
| c | c̄ | c̄ ± 3 √c̄ |
| u | ū = Σc / Σn | ū ± 3 √(ū / nᵢ) |

Constantes A₂, D₃, D₄, d₂ (n = 2…10) : tables ASTM E2587 ; c₄ calculé par la fonction Gamma. Les LCL négatives sont ramenées à 0 pour les attributs.

**Règles de détection** (Western Electric / Nelson, sélectionnables) : 1) un point hors ±3σ ; 2) 9 points du même côté ; 3) 6 points croissants ou décroissants ; 4) 14 points alternés ; 5) 2 sur 3 au-delà de 2σ ; 6) 4 sur 5 au-delà de 1σ ; 7) 15 points dans ±1σ ; 8) 8 points hors ±1σ des deux côtés. Les zones sont calculées point par point (gère les limites variables).

## Inférence

- **Test t** à un échantillon, deux échantillons (Welch : ddl de Welch-Satterthwaite ; ou variances égales), apparié ; IC à 95 % par le quantile de Student.
- **Test F** d'égalité des variances (bilatéral).
- **Comparaison de deux proportions** : z = (p₁ − p₂) / √(p(1 − p)(1/n₁ + 1/n₂)).
- **χ² d'indépendance**.
- **ANOVA à un facteur** : F = CM_inter / CM_intra, p = 1 − F_cdf.
- **Corrélation de Pearson** ; test t = r √(n − 2) / √(1 − r²).
- **Régression linéaire** (simple et multiple) : β = (XᵀX)⁻¹ Xᵀ y (Gauss-Jordan avec pivot partiel), erreurs standard √(MSE · (XᵀX)⁻¹ᵢᵢ), R², R² ajusté, F global.
- **Normalité** : Anderson-Darling A², statistique corrigée A*² = A²(1 + 0,75/n + 2,25/n²), p-valeur de D'Agostino & Stephens (1986).
- **Plans factoriels 2^k** : effet = ȳ(+) − ȳ(−), coefficient = effet / 2 ; significativité par régression sur les termes principaux et interactions (si ddl résiduels suffisants) ; meilleur réglage recherché sur les sommets du domaine.

## Fonctions de répartition

Φ : algorithme de West (2005) ; Φ⁻¹ : Acklam + un pas de Halley ; ln Γ : Lanczos ; bêta et gamma incomplètes régularisées : fractions continues (Numerical Recipes). Student, Fisher et χ² en découlent ; leurs quantiles sont obtenus par Newton/bissection.

## Compléments issus des cours ENSGSI (DDQ1, MMI1, MMI2, Lean)

- **TRS** = temps utile / temps requis ; **TRG** = temps utile / temps d'ouverture = TRS × temps requis / temps d'ouverture.
- **RTF** (ratio de tension de flux) = Σ VA / (Σ VA + Takt × Σ en-cours).
- **Convention française de capabilité** : Cm = IT / 6σ instantané, Cmk = min(TS − x̄, x̄ − TI) / 3σ instantané (capabilité machine, objectif > 2) ; Cp = IT / 6σ global, Cpk = min(…) / 3σ global (capabilité processus : < 1 non capable, = 1 juste capable, > 1,33 capable, objectif > 1,66). Correspondance : Cm/Cmk ≈ Cp/Cpk « within » international ; Cp/Cpk français ≈ Pp/Ppk.
- **Cpm** = IT / 6√(σ² + (x̄ − cible)²) ; **perte de Taguchi** moyenne = k(σ² + (x̄ − cible)²), k = coût à la limite / (IT/2)².
- **Étude R&R croisée (ANOVA)** : modèle pièce + opérateur + interaction ; interaction regroupée avec la répétabilité si p > 0,05 ; composantes de variance σ²rép = CM erreur, σ²inter = (CM PO − CM E)/r, σ²op = (CM O − CM PO)/(p·r), σ²pièce = (CM P − CM PO)/(o·r) (négatifs ramenés à 0). %R&R = σ R&R / σ total : < 10 % souhaitable, 10–20 % acceptable, 20–30 % selon l'application et les coûts, > 30 % à améliorer ; ndc = ⌊1,41 σ pièce / σ R&R⌋. Validé contre un calcul NumPy/SciPy.
- **Méthode de Charbonneau** : σ mesure = R̄ / d₂ (n = nombre de contrôleurs), Cmc = IT / 6σ mesure ; capable si Cmc > 4, à améliorer si < 3.
- **Box-Cox** : y = (x^λ − 1)/λ (ln x si λ = 0) ; λ maximise la log-vraisemblance profilée −n/2·ln σ²(λ) + (λ − 1)Σ ln x (λ validé contre SciPy) ; λ arrondi à 0,5 pour l'interprétation ; tolérances transformées de la même façon (ordre inversé si λ < 0).
- **Puissance d'un test t** : 1 − T(t₁₋α/₂ − δ/ES) + T(−t₁₋α/₂ − δ/ES), ES = σ√(2/n) (deux échantillons) ou σ/√n ; effectif = plus petit n atteignant la puissance visée (n = 17 pour δ = σ, α = 5 %, 80 % — identique à la loi de Student décentrée).
- **Kano** : table d'évaluation fonctionnel × dysfonctionnel (A, O, M, I, R, Q), catégorie majoritaire, CS+ = (A + O)/(A + O + M + I), CS− = −(O + M)/(A + O + M + I).
- **Vote pondéré** : score = Σ note(1, 3 ou 9) × poids du critère.
- **Multi-vari** : décomposition emboîtée de la somme des carrés en pièce à pièce (dans un sous-groupe), temporelle (entre sous-groupes d'un lot) et entre lots.

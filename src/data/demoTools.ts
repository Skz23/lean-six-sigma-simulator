import type { ToolsState, DmaicProject } from '../store/types'
import type { SmedOperation } from '../lean/tools'

export const demoSmedTournage: SmedOperation[] = [
  { id: 'o1', label: 'Chercher le programme et la gamme', duration: 3, type: 'internal', convertible: true, reduction: 0 },
  { id: 'o2', label: 'Aller chercher les outils au magasin', duration: 5, type: 'internal', convertible: true, reduction: 0 },
  { id: 'o3', label: 'Démonter les mors et le porte-outil', duration: 4, type: 'internal', convertible: false, reduction: 0.5 },
  { id: 'o4', label: 'Monter et serrer les nouveaux mors (vis)', duration: 5, type: 'internal', convertible: false, reduction: 0.6 },
  { id: 'o5', label: 'Prérégler les outils (jauges)', duration: 4, type: 'internal', convertible: true, reduction: 0 },
  { id: 'o6', label: 'Usiner la première pièce et mesurer au labo', duration: 3, type: 'internal', convertible: false, reduction: 0.5 },
  { id: 'o7', label: 'Ranger les anciens outils', duration: 1, type: 'external', convertible: true, reduction: 0 },
]

export function demoDmaic(scenarioId: string): DmaicProject {
  return {
    id: 'dmaic-1',
    name: 'Réduction des rebuts sur le diamètre de portée Ø25',
    scenarioId,
    phase: 'measure',
    createdAt: new Date().toISOString(),
    charter: {
      problem:
        'Depuis 6 mois, 4 à 6 % des arbres AT-25 sont rebutés pour diamètre hors tolérance (Ø25 ±0,05). Le client a émis 3 réclamations et menace de qualifier un second fournisseur.',
      businessCase: 'Le coût de non-qualité dépasse 90 k€/an ; les retards de livraison entraînent des pénalités.',
      goal: 'Atteindre un Cpk ≥ 1,33 sur le diamètre et diviser par 3 le taux de rebut global d\'ici 4 mois.',
      scope: 'Poste tournage CNC — référence AT-25. Hors périmètre : débit, emballage.',
      sponsor: 'Directeur industriel',
      leader: 'Ingénieur qualité (Green Belt)',
      team: 'Régleur CNC, technicien méthodes, technicien maintenance, opérateur',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10),
      baselineMetric: 'Cpk ≈ 0,6 ; rebut ≈ 6 %',
      targetMetric: 'Cpk ≥ 1,33 ; rebut ≤ 2 %',
    },
    voc: [
      { id: 'v1', voice: '« Les arbres ne rentrent pas dans les roulements »', need: 'Montage sans effort', ctq: 'Diamètre de portée', measure: 'Ø en mm', target: '25,00 ± 0,05' },
      { id: 'v2', voice: '« Vous livrez en retard »', need: 'Livraison à l\'heure', ctq: 'Taux de service', measure: '% livré / demandé', target: '≥ 98 %' },
      { id: 'v3', voice: '« Il y a des rayures »', need: 'Aspect conforme', ctq: 'État de surface', measure: 'Défauts / 1000', target: '≤ 2' },
    ],
    sipoc: [
      { supplier: 'Aciérie', input: 'Barres C45 Ø30', process: 'Débit', output: 'Lopins', customer: 'Tournage' },
      { supplier: 'Débit', input: 'Lopins + programme CNC', process: 'Tournage CNC', output: 'Arbres tournés Ø25', customer: 'Fraisage' },
      { supplier: 'Tournage', input: 'Arbres tournés', process: 'Fraisage + ébavurage', output: 'Arbres finis', customer: 'Contrôle' },
      { supplier: 'Production', input: 'Arbres finis', process: 'Contrôle + emballage', output: 'Cartons de 20', customer: 'Client pompes' },
    ],
    causes: [
      { id: 'c1', category: 'Machine', text: 'Dilatation thermique de la broche', likely: true },
      { id: 'c2', category: 'Machine', text: 'Usure des plaquettes non compensée', likely: true },
      { id: 'c3', category: 'Méthode', text: 'Consigne de température non optimisée', likely: true },
      { id: 'c4', category: 'Méthode', text: 'Réglage après changement de série non standardisé', likely: false },
      { id: 'c5', category: 'Main-d\'œuvre', text: 'Régleurs peu formés au SPC', likely: false },
      { id: 'c6', category: 'Matière', text: 'Variation de dureté des barres', likely: false },
      { id: 'c7', category: 'Mesure', text: 'Mesure au labo éloigné, retour tardif', likely: false },
      { id: 'c8', category: 'Milieu', text: 'Température atelier variable (été)', likely: false },
    ],
    whys: [
      {
        id: 'w1',
        problem: 'Diamètre trop grand sur une partie des pièces',
        whys: [
          'La moyenne du procédé est décalée vers la limite haute',
          'La broche chauffe et la pièce se dilate pendant l\'usinage',
          'La consigne de température de broche est réglée à 43 °C',
          'La consigne n\'a jamais été optimisée depuis l\'installation',
          'Aucun standard de réglage basé sur des données n\'existe',
        ],
        rootCause: 'Consigne de température non optimisée et régulation thermique instable',
      },
    ],
    solutions: [
      { id: 's1', label: 'Optimiser la consigne de température (DOE)', impact: 5, effort: 1, cost: 1, risk: 1, selected: true },
      { id: 's2', label: 'Installer une régulation thermique de broche', impact: 4, effort: 3, cost: 4, risk: 2, selected: true },
      { id: 's3', label: 'Compensation automatique d\'usure outil', impact: 3, effort: 2, cost: 3, risk: 1, selected: true },
      { id: 's4', label: 'Contrôle 100 % automatique', impact: 2, effort: 4, cost: 5, risk: 2, selected: false },
    ],
    controlPlan: [
      { id: 'cp1', characteristic: 'Diamètre de portée', spec: '25,00 ± 0,05 mm', method: 'Micromètre au poste', frequency: '5 pièces / heure', sampleSize: '5', chart: 'X̄-R', reaction: 'Arrêt, réglage, tri du lot depuis dernier contrôle OK', owner: 'Opérateur' },
      { id: 'cp2', characteristic: 'Température broche', spec: '35 ± 2 °C', method: 'Capteur machine', frequency: 'Continu', sampleSize: '1', chart: 'I-MR', reaction: 'Alarme maintenance', owner: 'Maintenance' },
    ],
    gates: { define: true, measure: false, analyze: false, improve: false, control: false },
    notes: { define: '', measure: '', analyze: '', improve: '', control: '' },
  }
}

export function demoTools(initialScenarioId: string): ToolsState {
  const d = new Date().toISOString().slice(0, 10)
  return {
    fiveS: {
      [initialScenarioId]: {
        area: 'Îlot tournage / fraisage',
        date: d,
        scores: { seiri: [2, 1, 1, 2], seiton: [1, 1, 0, 1], seiso: [2, 2, 1, 1], seiketsu: [1, 0, 1, 0], shitsuke: [1, 0, 1, 1] },
        actions: [
          { id: 'a1', what: 'Créer un tableau d\'ombres pour les outils du tour', who: 'Régleur', when: d, status: 'à faire' },
          { id: 'a2', what: 'Marquage au sol des zones de stock', who: 'Méthodes', when: d, status: 'en cours' },
        ],
      },
    },
    smed: { [`${initialScenarioId}:S2`]: demoSmedTournage },
    kaizen: [
      { id: 'k1', title: 'Chariot d\'outillage au tour', area: 'Tournage', problem: 'L\'opérateur va 10 fois par jour au magasin outils', proposal: 'Chariot avec outils préréglés au poste', owner: 'J. Martin', status: 'en cours', kpi: 'Déplacements', before: 840, after: null, unit: 'm/jour', createdAt: d },
      { id: 'k2', title: 'Micromètre au poste', area: 'Tournage', problem: 'Mesures au labo : 12 allers-retours/jour', proposal: 'Micromètre + carte SPC au poste', owner: 'S. Benali', status: 'terminé', kpi: 'Temps de marche', before: 25, after: 4, unit: 'min/jour', createdAt: d },
      { id: 'k3', title: 'Gabarit d\'ébavurage', area: 'Ébavurage', problem: 'Chocs et rayures à la manipulation', proposal: 'Support en V et gabarit', owner: 'L. Petit', status: 'idée', kpi: 'Taux de défauts', before: 1.2, after: null, unit: '%', createdAt: d },
    ],
    dmaic: [demoDmaic(initialScenarioId)],
    fmea: [
      { id: 'f1', process: 'Tournage CNC', failureMode: 'Diamètre hors tolérance', effect: 'Montage roulement impossible chez le client', cause: 'Dérive thermique de broche', currentControl: 'Contrôle final par prélèvement', s: 8, o: 7, d: 6, action: 'Régulation thermique + SPC au poste', owner: 'Maintenance', s2: 8, o2: 2, d2: 3 },
      { id: 'f2', process: 'Tournage CNC', failureMode: 'Diamètre hors tolérance', effect: 'Rebut', cause: 'Usure outil', currentControl: 'Changement outil à fréquence fixe', s: 7, o: 6, d: 5, action: 'Compensation automatique d\'usure', owner: 'Méthodes', s2: 7, o2: 2, d2: 4 },
      { id: 'f3', process: 'Fraisage', failureMode: 'Clavette mal positionnée', effect: 'Assemblage impossible', cause: 'Bridage instable', currentControl: 'Contrôle visuel', s: 7, o: 4, d: 6, action: 'Montage avec détrompeur', owner: 'Méthodes', s2: null, o2: null, d2: null },
      { id: 'f4', process: 'Ébavurage', failureMode: 'Choc / rayure', effect: 'Défaut d\'aspect, réclamation', cause: 'Manipulation sans support', currentControl: 'Contrôle final 100 %', s: 4, o: 6, d: 3, action: 'Gabarit en V, bacs alvéolés', owner: 'Production', s2: null, o2: null, d2: null },
      { id: 'f5', process: 'Emballage', failureMode: 'Erreur d\'étiquette', effect: 'Erreur de livraison', cause: 'Saisie manuelle', currentControl: 'Aucun', s: 6, o: 2, d: 8, action: 'Étiquettes imprimées depuis l\'ERP', owner: 'Logistique', s2: null, o2: null, d2: null },
    ],
    defectLog: [
      { id: 'd1', date: d, category: 'Diamètre hors tolérance', station: 'Tournage CNC', count: 58, consequence: 'Rebut', cost: 26 },
      { id: 'd2', date: d, category: 'Rayure', station: 'Ébavurage manuel', count: 21, consequence: 'Retouche', cost: 8 },
      { id: 'd3', date: d, category: 'Position clavette', station: 'Fraisage clavette', count: 12, consequence: 'Rebut', cost: 30 },
      { id: 'd4', date: d, category: 'Bavure résiduelle', station: 'Ébavurage manuel', count: 17, consequence: 'Retouche', cost: 5 },
      { id: 'd5', date: d, category: 'Longueur incorrecte', station: 'Débit', count: 6, consequence: 'Rebut', cost: 15 },
      { id: 'd6', date: d, category: 'Erreur de marquage', station: 'Contrôle final', count: 3, consequence: 'Retouche', cost: 4 },
    ],
  }
}

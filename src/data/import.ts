/**
 * Import de données réelles : CSV (séparateur ; , ou tabulation) ou copier-coller depuis Excel.
 * Gère les guillemets, la virgule décimale et les espaces de milliers.
 */
import type { Station } from '../engine/types'

export type DatasetKind = 'measures' | 'defects' | 'line'

export interface MeasureSpec {
  name: string
  unit: string
  lsl?: number
  usl?: number
  target?: number
}

export interface Dataset {
  id: string
  name: string
  kind: DatasetKind
  createdAt: string
  /** Mesures : valeurs dans l'ordre chronologique. */
  values?: number[]
  /** Mesures : identifiant de sous-groupe / lot / date de chaque valeur (optionnel). */
  groups?: string[]
  spec?: MeasureSpec
  /** Défauts. */
  defects?: { date: string; category: string; station: string; count: number; cost: number }[]
  /** Ligne de production. */
  stations?: Station[]
}

/** Découpe un texte tabulaire en lignes / cellules. */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()
  if (!clean) return []
  const first = clean.split('\n')[0]
  const counts = { '\t': (first.match(/\t/g) ?? []).length, ';': (first.match(/;/g) ?? []).length, ',': (first.match(/,/g) ?? []).length }
  // la virgule n'est retenue comme séparateur que s'il n'y a ni tabulation ni point-virgule
  const sep = counts['\t'] > 0 ? '\t' : counts[';'] > 0 ? ';' : counts[','] > 0 ? ',' : '\t'
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (q) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === sep) {
      row.push(cell.trim())
      cell = ''
    } else if (c === '\n') {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  row.push(cell.trim())
  rows.push(row)
  return rows.filter((r) => r.some((c) => c !== ''))
}

/** Convertit une cellule en nombre (accepte « 25,012 », « 1 250 », « 95 % »). */
export function toNumber(s: string | undefined): number {
  if (s === undefined) return NaN
  let t = s.replace(/[\s  ]/g, '').replace('%', '')
  if (t === '') return NaN
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '')
  t = t.replace(',', '.')
  const v = Number(t)
  return Number.isFinite(v) ? v : NaN
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')

/** Indique si la première ligne est une ligne d'en-têtes (au moins une cellule non numérique). */
export function hasHeader(rows: string[][]): boolean {
  return rows.length > 0 && rows[0].some((c) => c !== '' && Number.isNaN(toNumber(c)))
}

export interface FieldDef {
  key: string
  label: string
  required?: boolean
  synonyms: string[]
}

export const FIELDS: Record<DatasetKind, FieldDef[]> = {
  measures: [
    { key: 'value', label: 'Valeur mesurée', required: true, synonyms: ['valeur', 'mesure', 'value', 'diametre', 'cote', 'resultat', 'x', 'y'] },
    { key: 'group', label: 'Sous-groupe / lot / date', synonyms: ['sousgroupe', 'groupe', 'lot', 'date', 'heure', 'echantillon', 'batch', 'of'] },
  ],
  defects: [
    { key: 'category', label: 'Catégorie de défaut', required: true, synonyms: ['categorie', 'defaut', 'type', 'motif', 'cause', 'nature'] },
    { key: 'count', label: 'Quantité', synonyms: ['quantite', 'nombre', 'nb', 'qte', 'frequence', 'count'] },
    { key: 'station', label: 'Poste', synonyms: ['poste', 'machine', 'atelier', 'operation', 'station'] },
    { key: 'date', label: 'Date', synonyms: ['date', 'jour', 'semaine'] },
    { key: 'cost', label: 'Coût unitaire (€)', synonyms: ['cout', 'coutunitaire', 'prix', 'cost', 'euro'] },
  ],
  line: [
    { key: 'name', label: 'Nom du poste', required: true, synonyms: ['poste', 'nom', 'operation', 'machine', 'station'] },
    { key: 'cycleTime', label: 'Temps de cycle (s)', required: true, synonyms: ['tempsdecycle', 'tempscycle', 'cycletime', 'ct', 'tc', 'cycle'] },
    { key: 'changeoverTime', label: 'Changement de série (min)', synonyms: ['changementdeserie', 'changement', 'co', 'smed', 'changeover'] },
    { key: 'operators', label: 'Opérateurs', synonyms: ['operateurs', 'operateur', 'effectif', 'mod'] },
    { key: 'availability', label: 'Disponibilité (%)', synonyms: ['disponibilite', 'dispo', 'availability', 'uptime'] },
    { key: 'mttr', label: 'Durée moyenne de panne (min)', synonyms: ['mttr', 'tempsdarret', 'arret', 'dureepanne'] },
    { key: 'defectRate', label: 'Taux de défauts (%)', synonyms: ['tauxdedefauts', 'defauts', 'rebut', 'tauxrebut', 'nonqualite'] },
    { key: 'capacity', label: 'Machines en parallèle', synonyms: ['capacite', 'machines', 'parallele', 'nbmachines'] },
    { key: 'bufferCapacity', label: 'Stock aval max', synonyms: ['stockmax', 'stock', 'wip', 'encours', 'buffer'] },
    { key: 'distanceToNext', label: 'Distance vers suivant (m)', synonyms: ['distance', 'transport', 'metres'] },
    { key: 'valueAdded', label: 'Valeur ajoutée (oui/non)', synonyms: ['valeurajoutee', 'va', 'type'] },
  ],
}

/** Associe automatiquement chaque champ attendu à une colonne d'après les en-têtes. */
export function autoMap(kind: DatasetKind, headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  const used = new Set<number>()
  for (const f of FIELDS[kind]) {
    const idx = headers.findIndex((h, i) => !used.has(i) && f.synonyms.some((s) => norm(h) === s || norm(h).startsWith(s)))
    if (idx >= 0) {
      map[f.key] = idx
      used.add(idx)
    }
  }
  if (kind === 'measures' && map.value === undefined) {
    // première colonne numérique
    const i = headers.findIndex((_, k) => !used.has(k))
    if (i >= 0) map.value = i
  }
  return map
}

const yes = (s: string) => /^(oui|o|yes|y|va|1|vrai|true)$/i.test(s.trim())

export interface BuildResult {
  dataset?: Omit<Dataset, 'id' | 'name' | 'createdAt'>
  errors: string[]
  skipped: number
}

/** Construit un jeu de données à partir des lignes (sans en-tête) et du mapping de colonnes. */
export function buildDataset(kind: DatasetKind, rows: string[][], map: Record<string, number>): BuildResult {
  const errors: string[] = []
  let skipped = 0
  const missing = FIELDS[kind].filter((f) => f.required && map[f.key] === undefined)
  if (missing.length) return { errors: missing.map((m) => `Colonne requise non associée : ${m.label}`), skipped: 0 }
  const cell = (r: string[], k: string) => (map[k] === undefined ? undefined : r[map[k]])

  if (kind === 'measures') {
    const values: number[] = []
    const groups: string[] = []
    for (const r of rows) {
      const v = toNumber(cell(r, 'value'))
      if (Number.isNaN(v)) {
        skipped++
        continue
      }
      values.push(v)
      groups.push(cell(r, 'group') ?? '')
    }
    if (values.length < 2) errors.push('Moins de 2 valeurs numériques trouvées.')
    return { dataset: { kind, values, groups: groups.some(Boolean) ? groups : undefined }, errors, skipped }
  }
  if (kind === 'defects') {
    const defects = []
    for (const r of rows) {
      const category = cell(r, 'category') ?? ''
      if (!category) {
        skipped++
        continue
      }
      const c = toNumber(cell(r, 'count'))
      defects.push({ category, count: Number.isNaN(c) ? 1 : c, station: cell(r, 'station') ?? '', date: cell(r, 'date') ?? '', cost: toNumber(cell(r, 'cost')) || 0 })
    }
    if (!defects.length) errors.push('Aucun défaut trouvé.')
    return { dataset: { kind, defects }, errors, skipped }
  }
  // Ligne de production
  const stations: Station[] = []
  rows.forEach((r) => {
    const name = cell(r, 'name') ?? ''
    const ct = toNumber(cell(r, 'cycleTime'))
    if (!name || !(ct > 0)) {
      skipped++
      return
    }
    const num = (k: string, d: number) => {
      const v = toNumber(cell(r, k))
      return Number.isNaN(v) ? d : v
    }
    let availability = num('availability', 95)
    if (availability > 1) availability /= 100
    // colonne exprimée en % (0,5 = 0,5 %)
    const defectRate = num('defectRate', 0) / 100
    const i = stations.length
    stations.push({
      id: `S${i + 1}`,
      name,
      cycleTime: ct,
      cycleTimeCV: 0.1,
      changeoverTime: num('changeoverTime', 0),
      operators: Math.round(num('operators', 1)),
      availability: Math.min(1, Math.max(0.05, availability)),
      mttr: num('mttr', 15),
      defectRate: Math.min(0.9, Math.max(0, defectRate)),
      capacity: Math.max(1, Math.round(num('capacity', 1))),
      bufferCapacity: Math.max(1, Math.round(num('bufferCapacity', 30))),
      initialWip: 0,
      valueAdded: map.valueAdded === undefined ? true : yes(cell(r, 'valueAdded') ?? 'oui'),
      distanceToNext: num('distanceToNext', 10),
      x: 6 + (i % 4) * 10,
      y: 8 + Math.floor(i / 4) * 10,
      defectTypes: ['Défaut divers'],
    })
  })
  if (stations.length < 2) errors.push('Au moins 2 postes valides sont nécessaires (nom + temps de cycle > 0).')
  if (stations.length) stations[stations.length - 1].distanceToNext = 0
  return { dataset: { kind, stations }, errors, skipped }
}

/** Modèles CSV téléchargeables (séparateur point-virgule, compatible Excel français). */
export const TEMPLATES: Record<DatasetKind, { filename: string; content: string }> = {
  measures: {
    filename: 'modele-mesures.csv',
    content: 'Date;Valeur\n2026-11-02 08:00;25,012\n2026-11-02 08:00;25,018\n2026-11-02 08:00;24,996\n2026-11-02 09:00;25,021\n2026-11-02 09:00;25,004\n',
  },
  defects: {
    filename: 'modele-defauts.csv',
    content: 'Date;Catégorie;Poste;Quantité;Coût unitaire\n2026-11-02;Rayure;Tournage;12;8\n2026-11-02;Cote hors tolérance;Tournage;5;25\n2026-11-03;Bavure;Ébavurage;9;4\n',
  },
  line: {
    filename: 'modele-ligne.csv',
    content:
      'Poste;Temps de cycle (s);Changement de série (min);Opérateurs;Disponibilité (%);MTTR (min);Taux de défauts (%);Machines en parallèle;Stock max;Distance (m);Valeur ajoutée\n' +
      'Découpe;35;10;1;95;10;0,5;1;30;15;oui\nUsinage;48;30;1;88;20;1,2;1;30;20;oui\nContrôle;25;0;1;99;5;0,2;1;30;10;non\nEmballage;20;0;1;99;5;0,1;1;100;0;non\n',
  },
}

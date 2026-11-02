import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { readXlsx, rowsToTsv } from './xlsx'
import { autoMap, buildDataset, parseTable } from './import'

describe('lecture Excel .xlsx', () => {
  it('lit les feuilles, les textes partagés, les nombres et ignore les lignes vides', async () => {
    const buf = readFileSync(new URL('./fixtures/test.xlsx', import.meta.url))
    const sheets = await readXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    expect(sheets.map((s) => s.name)).toEqual(['Ligne', 'Mesures'])
    const line = sheets[0].rows
    expect(line[0][0]).toBe('Poste')
    expect(line[1][0]).toBe('Découpe & préparation')
    expect(line[2][1]).toBe('48.5')
    expect(line.length).toBe(4)
    const rows = parseTable(rowsToTsv(line))
    const r = buildDataset('line', rows.slice(1), autoMap('line', rows[0]))
    expect(r.errors).toEqual([])
    expect(r.dataset!.stations!.map((s) => s.name)).toEqual(['Découpe & préparation', 'Usinage', 'Contrôle'])
    expect(r.dataset!.stations![1].availability).toBeCloseTo(0.88, 10)
    expect(r.dataset!.stations![2].valueAdded).toBe(false)
    // cellules au format % (0,88 affiché 88 %) et dates
    expect(line[2][4]).toBe('88')
    expect(r.dataset!.stations![1].defectRate).toBeCloseTo(0.012, 10)
    expect(sheets[1].rows[1][0]).toBe('2026-11-01')
    expect(sheets[1].rows.length).toBe(13)
    const mrows = parseTable(rowsToTsv(sheets[1].rows))
    const m = buildDataset('measures', mrows.slice(1), autoMap('measures', mrows[0])).dataset!
    expect(m.values![1]).toBeCloseTo(25.001, 10)
    expect(m.groups![0]).toBe('2026-11-01')
    expect(Number(sheets[1].rows[12][1])).toBeCloseTo(25.011, 10)
  })
  it('refuse un fichier qui n\'est pas un .xlsx', async () => {
    await expect(readXlsx(new TextEncoder().encode('bonjour').buffer)).rejects.toThrow()
  })
})

describe('écriture Excel', () => {
  it('le modèle généré se relit à l\'identique (aller-retour)', async () => {
    const { writeXlsx } = await import('./xlsx')
    const blob = writeXlsx([
      { name: 'Ligne', rows: [['Poste', 'Temps de cycle (s)'], ['Découpe <A&B>', 35.5]] },
      { name: 'Mesures', rows: [['Valeur'], [25.012]] },
    ])
    const sheets = await readXlsx(await blob.arrayBuffer())
    expect(sheets.map((s) => s.name)).toEqual(['Ligne', 'Mesures'])
    expect(sheets[0].rows).toEqual([['Poste', 'Temps de cycle (s)'], ['Découpe <A&B>', '35.5']])
    expect(sheets[1].rows[1][0]).toBe('25.012')
  })
})

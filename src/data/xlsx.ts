/**
 * Lecteur Excel (.xlsx) minimal, sans dépendance.
 * Un .xlsx est une archive ZIP de fichiers XML : on lit le répertoire central du ZIP,
 * on décompresse les entrées utiles avec DecompressionStream('deflate-raw') (natif dans
 * les navigateurs et Node ≥ 18), puis on extrait les cellules (texte partagé, texte en ligne,
 * nombres, booléens, résultats de formules).
 */

export interface Sheet {
  name: string
  rows: string[][]
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Lit les entrées d'une archive ZIP (méthodes « stocké » et « deflate »). */
async function unzip(buf: ArrayBuffer, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  const u8 = new Uint8Array(buf)
  const dv = new DataView(buf)
  // Fin du répertoire central (signature 0x06054b50), cherchée depuis la fin
  let eocd = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Fichier non reconnu : ce n\'est pas un classeur Excel .xlsx valide.')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const dec = new TextDecoder('utf-8')
  const out = new Map<string, string>()
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true)
    const csize = dv.getUint32(p + 20, true)
    const nlen = dv.getUint16(p + 28, true)
    const elen = dv.getUint16(p + 30, true)
    const clen = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen))
    p += 46 + nlen + elen + clen
    if (!wanted(name)) continue
    const lnlen = dv.getUint16(local + 26, true)
    const lelen = dv.getUint16(local + 28, true)
    const start = local + 30 + lnlen + lelen
    const raw = u8.subarray(start, start + csize)
    if (method === 0) out.set(name, dec.decode(raw))
    else if (method === 8) out.set(name, dec.decode(await inflateRaw(raw)))
    else throw new Error(`Compression ZIP non prise en charge (méthode ${method}).`)
  }
  return out
}

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')

/** Concatène tous les <t> d'un fragment (texte riche compris). */
const textOf = (xml: string) => unescapeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

type CellFormat = 'percent' | 'date' | 'plain'

/** Formats des styles de cellule (xl/styles.xml) : pourcentage, date ou standard. */
function parseStyles(xml: string | undefined): CellFormat[] {
  if (!xml) return []
  const custom = new Map<number, string>()
  for (const m of xml.matchAll(/<numFmt\b([^>]*)\/?>/g)) custom.set(Number(attr(m[1], 'numFmtId')), unescapeXml(attr(m[1], 'formatCode') ?? ''))
  const xfs = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? ''
  return [...xfs.matchAll(/<xf\b([^>]*)\/?>/g)].map((m) => {
    const id = Number(attr(m[1], 'numFmtId') ?? 0)
    if (id === 9 || id === 10) return 'percent'
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return 'date'
    const code = (custom.get(id) ?? '').replace(/"[^"]*"|\[[^\]]*\]/g, '')
    if (code.includes('%')) return 'percent'
    if (/[dmyj]/i.test(code) && !/^[#0.,\s]*$/.test(code)) return 'date'
    return 'plain'
  })
}

/** Numéro de série Excel → date ISO (AAAA-MM-JJ, avec l'heure si présente). */
function serialToDate(v: number): string {
  const ms = Math.round((v - 25569) * 86400000)
  const d = new Date(ms)
  const iso = d.toISOString()
  return v % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' ')
}

function parseSheet(xml: string, shared: string[], formats: CellFormat[] = []): string[][] {
  const rows: string[][] = []
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const rAttr = rm[1] ?? rm[3] ?? ''
    const rIdx = Number(attr(rAttr, 'r') ?? rows.length + 1) - 1
    const row: string[] = []
    let next = 0
    for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = cm[1]
      const body = cm[2] ?? ''
      const ref = attr(a, 'r')
      const ci = ref ? colIndex(ref) : next
      next = ci + 1
      const t = attr(a, 't')
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let val = ''
      if (t === 's') val = v !== undefined ? (shared[Number(v)] ?? '') : ''
      else if (t === 'inlineStr') val = textOf(body)
      else if (t === 'b') val = v === '1' ? 'VRAI' : 'FAUX'
      else if (t === 'e') val = ''
      else if (v !== undefined) {
        val = unescapeXml(v)
        const fmt = formats[Number(attr(a, 's') ?? 0)]
        const num = Number(val)
        // Une cellule affichée « 95 % » est stockée 0,95 : on restitue la valeur affichée
        if (fmt === 'percent' && Number.isFinite(num)) val = String(Math.round(num * 100 * 1e9) / 1e9)
        else if (fmt === 'date' && Number.isFinite(num)) val = serialToDate(num)
      }
      row[ci] = val
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = ''
    rows[rIdx] = row
  }
  const filled = Array.from({ length: rows.length }, (_, i) => rows[i] ?? [])
  return filled.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Lit toutes les feuilles d'un classeur .xlsx. */
export async function readXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const files = await unzip(buf, (n) => n === 'xl/workbook.xml' || n === 'xl/sharedStrings.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/styles.xml' || /^xl\/worksheets\/[^/]+\.xml$/.test(n))
  const wb = files.get('xl/workbook.xml')
  if (!wb) throw new Error('Classeur Excel invalide (workbook.xml introuvable). Les anciens fichiers .xls ne sont pas pris en charge : enregistrez-le en .xlsx ou en CSV.')
  const shared = [...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
  const formats = parseStyles(files.get('xl/styles.xml'))
  const rels = new Map<string, string>()
  for (const m of (files.get('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attr(m[1], 'Id')
    const target = attr(m[1], 'Target')
    if (id && target) rels.set(id, target.replace(/^\/?(xl\/)?/, 'xl/'))
  }
  const sheets: Sheet[] = []
  let k = 0
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    k++
    const name = unescapeXml(attr(m[1], 'name') ?? `Feuille ${k}`)
    const rid = attr(m[1], 'r:id')
    const path = (rid && rels.get(rid)) || `xl/worksheets/sheet${k}.xml`
    const xml = files.get(path)
    if (xml) sheets.push({ name, rows: parseSheet(xml, shared, formats) })
  }
  return sheets
}

/** Convertit des lignes en texte tabulé (format d'entrée de l'importeur). */
export const rowsToTsv = (rows: string[][]) => rows.map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n')

// ---------------- Écriture (modèles téléchargeables) ----------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(d: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Archive ZIP sans compression (méthode « stocké »), suffisante pour de petits classeurs. */
function zipStore(files: { name: string; data: string }[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = enc.encode(f.data)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    const cen = new Uint8Array(46 + name.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    cen.set(name, 46)
    parts.push(local, data)
    central.push(cen)
    offset += local.length + data.length
  }
  const cenSize = central.reduce((a, c) => a + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cenSize, true)
  ev.setUint32(16, offset, true)
  const all = [...parts, ...central, end]
  const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0))
  let p = 0
  for (const a of all) {
    out.set(a, p)
    p += a.length
  }
  return out
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const colName = (i: number) => {
  let s = ''
  i++
  while (i > 0) {
    const m = (i - 1) % 26
    s = String.fromCharCode(65 + m) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

/** Crée un classeur .xlsx (texte et nombres ; première ligne en gras). */
export function writeXlsx(sheets: { name: string; rows: (string | number)[][] }[]): Blob {
  const sheetXml = (rows: (string | number)[][]) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="${Math.max(1, ...rows.map((r) => r.length))}" width="24" customWidth="1"/></cols><sheetData>` +
    rows
      .map(
        (r, i) =>
          `<row r="${i + 1}">` +
          r
            .map((c, j) => {
              const ref = `${colName(j)}${i + 1}`
              const s = i === 0 ? ' s="1"' : ''
              return typeof c === 'number' ? `<c r="${ref}"${s}><v>${c}</v></c>` : `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(c)}</t></is></c>`
            })
            .join('') +
          '</row>',
      )
      .join('') +
    '</sheetData></worksheet>'
  const files = [
    {
      name: '[Content_Types].xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    {
      name: 'xl/workbook.xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s.rows) })),
  ]
  return new Blob([zipStore(files) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

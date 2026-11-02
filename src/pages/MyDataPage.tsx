import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Database, FileDown, FileUp, Plus, Trash2, Wand2 } from 'lucide-react'
import { useActiveScenario, useStore, uid } from '../store/useStore'
import { FIELDS, TEMPLATES, autoMap, buildDataset, hasHeader, parseTable, type Dataset, type DatasetKind } from '../data/import'
import { calibrateProcess, scenarioFromStations, subgroupSizeOf } from '../data/realScenario'
import { capability } from '../stats/capability'
import { Badge, Button, Card, Empty, Field, Input, Note, NumberInput, PageHeader, Select, Table, TextArea } from '../components/ui'
import { saveFile } from '../lib/download'
import { readXlsx, rowsToTsv, writeXlsx, type Sheet } from '../data/xlsx'
import { ask, notify } from '../lib/dialog'
import { eur, fmt, fmtFixed } from '../lib/format'

const KIND_LABEL: Record<DatasetKind, string> = { measures: 'Mesures (caractéristique)', defects: 'Défauts', line: 'Ligne de production' }

export default function MyDataPage() {
  const datasets = useStore((s) => s.datasets)
  return (
    <div>
      <PageHeader icon={<Database size={20} />} title="Mes données" subtitle="Importez vos données réelles, décrivez votre usine et utilisez-les dans tous les outils" />
      <div className="mb-4">
        <Note tone="tip" title="Comment ça marche">
          1. Téléchargez le modèle Excel ou partez de votre propre classeur. · 2. Importez-le (.xlsx, .csv ou copier-coller de cellules). · 3. Utilisez vos données : vos mesures apparaissent comme source dans Capabilité et SPC, vos défauts dans le Pareto, votre ligne devient un scénario simulable. · 4. Ouvrez le{' '}
          <Link className="underline" to="/plan">Plan d'amélioration</Link> pour obtenir des propositions chiffrées.
        </Note>
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Importer />
        </div>
        <div className="space-y-4 xl:col-span-5">
          <Company />
          <Templates />
        </div>
        <Card title={`Jeux de données importés (${datasets.length})`} className="xl:col-span-12">
          {datasets.length ? (
            <div className="space-y-3">
              {datasets.map((d) => (
                <DatasetRow key={d.id} d={d} />
              ))}
            </div>
          ) : (
            <Empty>Aucune donnée importée. Commencez par un modèle ci-dessus.</Empty>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">Vos données restent sur cet appareil. Le bouton « Données de démo » (Gestion des scénarios) ne les efface pas. Pensez à exporter régulièrement vos scénarios.</p>
        </Card>
      </div>
    </div>
  )
}

function Templates() {
  const dl = (k: DatasetKind) => saveFile(TEMPLATES[k].filename, new Blob(['﻿' + TEMPLATES[k].content], { type: 'text/csv' })).catch((e) => notify((e as Error).message))
  const dlExcel = () => {
    const sheets = (['line', 'measures', 'defects'] as DatasetKind[]).map((k) => ({
      name: k === 'line' ? 'Ligne' : k === 'measures' ? 'Mesures' : 'Défauts',
      rows: parseTable(TEMPLATES[k].content).map((r, i) => (i === 0 ? r : r.map((c) => (/^-?[\d\s]+(,\d+)?$/.test(c) ? Number(c.replace(/\s/g, '').replace(',', '.')) : c)))),
    }))
    saveFile('modele-lean-six-sigma.xlsx', writeXlsx(sheets)).catch((e) => notify((e as Error).message))
  }
  return (
    <Card title="Modèles de fichiers" subtitle="Complétez le modèle dans Excel puis importez-le tel quel (.xlsx) ou en CSV">
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={dlExcel} className="justify-start">
          <FileDown size={15} /> Modèle Excel complet (3 feuilles : Ligne, Mesures, Défauts) — .xlsx
        </Button>
        {(Object.keys(TEMPLATES) as DatasetKind[]).map((k) => (
          <Button key={k} onClick={() => dl(k)} className="justify-start">
            <FileDown size={15} /> Modèle CSV : {KIND_LABEL[k]}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">Les noms de colonnes sont reconnus automatiquement (ex. « Temps de cycle », « TC », « Dispo »…) ; vous pouvez ajuster l'association avant d'importer.</p>
    </Card>
  )
}

function Importer() {
  const addDataset = useStore((s) => s.addDataset)
  const sc = useActiveScenario()
  const [kind, setKind] = useState<DatasetKind>('measures')
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [header, setHeader] = useState<boolean | null>(null)
  const [map, setMap] = useState<Record<string, number> | null>(null)
  const [spec, setSpec] = useState({ name: sc.process.characteristic.name, unit: sc.process.characteristic.unit, lsl: '', usl: '', target: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [sheetIdx, setSheetIdx] = useState(0)
  const [fileErr, setFileErr] = useState('')

  const rows = useMemo(() => parseTable(text), [text])
  const hdr = header ?? hasHeader(rows)
  const headers = hdr ? rows[0] ?? [] : (rows[0] ?? []).map((_, i) => `Colonne ${i + 1}`)
  const body = hdr ? rows.slice(1) : rows
  const mapping = map ?? autoMap(kind, headers)
  const result = rows.length ? buildDataset(kind, body, mapping) : null

  const kindFromSheet = (n: string): DatasetKind | null => {
    const x = n.toLowerCase()
    if (/ligne|poste|line/.test(x)) return 'line'
    if (/mesure|valeur|cote|measure/.test(x)) return 'measures'
    if (/d[ée]faut|rebut|defect/.test(x)) return 'defects'
    return null
  }
  const pickSheet = (all: Sheet[], i: number) => {
    setSheetIdx(i)
    setText(rowsToTsv(all[i]?.rows ?? []))
    const k = kindFromSheet(all[i]?.name ?? '')
    if (k) setKind(k)
    setMap(null)
    setHeader(null)
  }
  const readFile = async (f: File) => {
    setFileErr('')
    const buf = await f.arrayBuffer()
    setName(f.name.replace(/\.[^.]+$/, ''))
    if (/\.xls[xm]$/i.test(f.name)) {
      try {
        const all = (await readXlsx(buf)).filter((sh) => sh.rows.length)
        if (!all.length) throw new Error('Le classeur ne contient aucune donnée.')
        setSheets(all)
        pickSheet(all, 0)
      } catch (e) {
        setFileErr((e as Error).message)
      }
      return
    }
    if (/\.xls$/i.test(f.name)) {
      setFileErr('Ancien format Excel (.xls) : dans Excel, faites « Enregistrer sous » → Classeur Excel (.xlsx), puis réimportez.')
      return
    }
    setSheets([])
    let t = new TextDecoder('utf-8').decode(buf)
    if (t.includes('\uFFFD')) t = new TextDecoder('windows-1252').decode(buf)
    setText(t)
    setMap(null)
    setHeader(null)
  }
  const num = (v: string) => {
    const x = parseFloat(v.replace(',', '.'))
    return Number.isFinite(x) ? x : undefined
  }
  const doImport = () => {
    if (!result?.dataset || result.errors.length) return
    const d: Dataset = { id: uid('ds'), name: name || `${KIND_LABEL[kind]} du ${new Date().toLocaleDateString('fr-FR')}`, createdAt: new Date().toISOString(), ...result.dataset }
    if (kind === 'measures') d.spec = { name: spec.name, unit: spec.unit, lsl: num(spec.lsl), usl: num(spec.usl), target: num(spec.target) }
    addDataset(d)
    setText('')
    setName('')
    setMap(null)
  }

  return (
    <Card title="Importer des données" subtitle="Classeur Excel (.xlsx), fichier CSV, ou copier-coller de cellules">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type de données">
            <Select value={kind} onChange={(e) => { setKind(e.target.value as DatasetKind); setMap(null) }}>
              {(Object.keys(KIND_LABEL) as DatasetKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          </Field>
          <Field label="Nom du jeu de données">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Diamètre semaine 45" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => fileRef.current?.click()}><FileUp size={15} /> Choisir un fichier Excel ou CSV</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { if (e.target.files?.[0]) readFile(e.target.files[0]); e.target.value = '' }} />
          <span className="text-xs text-[var(--muted)]">.xlsx, .csv — ou collez vos cellules Excel ci-dessous</span>
        </div>
        {fileErr && <p className="text-sm text-[var(--critical)]">{fileErr}</p>}
        {sheets.length > 1 && (
          <Field label="Feuille du classeur">
            <Select value={sheetIdx} onChange={(e) => pickSheet(sheets, +e.target.value)}>
              {sheets.map((sh, i) => <option key={i} value={i}>{sh.name} ({sh.rows.length} lignes)</option>)}
            </Select>
          </Field>
        )}
        <TextArea rows={6} value={text} onChange={(e) => { setText(e.target.value); setMap(null); setSheets([]) }} placeholder={TEMPLATES[kind].content} className="font-mono text-xs" />
        {rows.length > 0 && (
          <>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={hdr} onChange={(e) => setHeader(e.target.checked)} className="accent-[var(--color-brand-600)]" /> La première ligne contient les noms de colonnes
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELDS[kind].map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`}>
                  <Select value={mapping[f.key] ?? -1} onChange={(e) => setMap({ ...mapping, [f.key]: +e.target.value < 0 ? (undefined as unknown as number) : +e.target.value })}>
                    <option value={-1}>— non utilisé —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            {kind === 'measures' && (
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-black/[.03] p-2.5 sm:grid-cols-5 dark:bg-white/[.05]">
                <Field label="Caractéristique"><Input value={spec.name} onChange={(e) => setSpec({ ...spec, name: e.target.value })} /></Field>
                <Field label="Unité"><Input value={spec.unit} onChange={(e) => setSpec({ ...spec, unit: e.target.value })} /></Field>
                <Field label="LSL"><Input value={spec.lsl} onChange={(e) => setSpec({ ...spec, lsl: e.target.value })} placeholder="mini" /></Field>
                <Field label="Cible"><Input value={spec.target} onChange={(e) => setSpec({ ...spec, target: e.target.value })} placeholder="nominal" /></Field>
                <Field label="USL"><Input value={spec.usl} onChange={(e) => setSpec({ ...spec, usl: e.target.value })} placeholder="maxi" /></Field>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-black/[.06] dark:border-white/10">
              <Table dense head={headers.map((h, i) => h || `Col. ${i + 1}`)} rows={body.slice(0, 5)} />
            </div>
            {result && (
              <div className="text-sm">
                {result.errors.length ? (
                  result.errors.map((e) => <p key={e} className="text-[var(--critical)]">{e}</p>)
                ) : (
                  <p className="text-[var(--good-text)]">
                    Prêt : {kind === 'measures' ? `${result.dataset!.values!.length} valeurs` : kind === 'defects' ? `${result.dataset!.defects!.length} lignes de défauts` : `${result.dataset!.stations!.length} postes`}
                    {result.skipped ? ` · ${result.skipped} ligne(s) ignorée(s) (vides ou non numériques)` : ''}
                  </p>
                )}
              </div>
            )}
            <Button variant="primary" onClick={doImport} disabled={!result?.dataset || !!result.errors.length}>
              <Plus size={15} /> Importer
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}

function DatasetRow({ d }: { d: Dataset }) {
  const st = useStore()
  const sc = useActiveScenario()
  const nav = useNavigate()
  const [msg, setMsg] = useState('')
  const kindTone = d.kind === 'measures' ? 'info' : d.kind === 'defects' ? 'warning' : 'brand'

  let summary = ''
  if (d.kind === 'measures' && d.values?.length) {
    const n = subgroupSizeOf(d.groups)
    const c = d.values.length > 3 ? capability(d.values, { lsl: d.spec?.lsl, usl: d.spec?.usl }, n) : null
    summary = `${d.values.length} valeurs · moyenne ${fmtFixed(c?.mean, 4)} · σ ${fmtFixed(c?.sigmaOverall, 4)}${c?.cpk !== undefined ? ` · Cpk ${fmtFixed(c.cpk, 2)}` : ''}${n > 1 ? ` · sous-groupes de ${n}` : ''}`
  } else if (d.kind === 'defects') {
    const tot = d.defects!.reduce((a, x) => a + x.count, 0)
    summary = `${d.defects!.length} lignes · ${fmt(tot, 0)} défauts · ${eur(d.defects!.reduce((a, x) => a + x.count * x.cost, 0))}`
  } else if (d.kind === 'line') summary = `${d.stations!.length} postes : ${d.stations!.map((s) => s.name).join(' → ')}`

  const createScenario = () => {
    const id = uid('sc')
    const s = scenarioFromStations(sc, d.stations!, d.name, id)
    st.addScenario(s)
    setMsg(`Scénario « ${d.name} » créé et activé.`)
    nav('/lean/line')
  }
  const calibrate = () => {
    if (d.spec?.lsl === undefined || d.spec?.usl === undefined) return setMsg('Renseignez d\'abord LSL et USL pour ce jeu de mesures.')
    let info = ''
    st.updateScenario(
      sc.id,
      (s) => {
        const c = calibrateProcess(s, d)
        info = `Modèle calé : moyenne ${fmtFixed(c.mean, 4)}, σ intra ${fmtFixed(c.sigmaWithin, 5)}, σ entre lots ${fmtFixed(c.batchSd, 5)}.`
      },
      `Avant calage sur « ${d.name} »`,
    )
    setMsg(`${info} Scénario « ${sc.name} » mis à jour.`)
  }
  const toLog = () => {
    st.setTools((t) => {
      for (const x of d.defects!) t.defectLog.push({ id: uid('d'), date: x.date || new Date().toISOString().slice(0, 10), category: x.category, station: x.station, count: x.count, consequence: 'Rebut', cost: x.cost })
    })
    setMsg('Défauts ajoutés au registre (Analyse des défauts).')
  }

  return (
    <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={kindTone}>{KIND_LABEL[d.kind]}</Badge>
        <Input value={d.name} onChange={(e) => st.updateDataset(d.id, (x) => (x.name = e.target.value))} className="w-64 font-medium" />
        <span className="text-xs text-[var(--muted)]">importé le {new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>
        <Button size="sm" variant="danger" className="ml-auto" onClick={() => ask(`Supprimer « ${d.name} » ?`) && st.deleteDataset(d.id)}>
          <Trash2 size={13} />
        </Button>
      </div>
      <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{summary}</p>
      {d.kind === 'measures' && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Field label="Caractéristique"><Input value={d.spec?.name ?? ''} onChange={(e) => st.updateDataset(d.id, (x) => (x.spec = { ...(x.spec ?? { unit: '' }), name: e.target.value }))} /></Field>
          <Field label="Unité"><Input value={d.spec?.unit ?? ''} onChange={(e) => st.updateDataset(d.id, (x) => (x.spec = { ...(x.spec ?? { name: '' }), unit: e.target.value }))} /></Field>
          {(['lsl', 'target', 'usl'] as const).map((k) => (
            <Field key={k} label={k === 'lsl' ? 'LSL' : k === 'usl' ? 'USL' : 'Cible'}>
              <NumberInput value={d.spec?.[k] ?? NaN} step={0.001} onChange={(v) => st.updateDataset(d.id, (x) => (x.spec = { ...(x.spec ?? { name: '', unit: '' }), [k]: v }))} />
            </Field>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {d.kind === 'measures' && (
          <>
            <Button size="sm" onClick={() => nav('/sixsigma/capability')}>Analyser la capabilité</Button>
            <Button size="sm" onClick={() => nav('/sixsigma/spc')}>Cartes de contrôle</Button>
            <Button size="sm" onClick={calibrate}><Wand2 size={13} /> Caler le modèle qualité du scénario « {sc.name} »</Button>
          </>
        )}
        {d.kind === 'defects' && (
          <>
            <Button size="sm" onClick={() => nav('/sixsigma/defects')}>Voir le Pareto</Button>
            <Button size="sm" onClick={toLog}>Ajouter au registre des défauts</Button>
          </>
        )}
        {d.kind === 'line' && <Button size="sm" variant="primary" onClick={createScenario}><Plus size={13} /> Créer un scénario avec cette ligne</Button>}
        <Button size="sm" variant="ghost" onClick={() => nav('/plan')}>Plan d'amélioration →</Button>
      </div>
      {msg && <p className="mt-2 text-xs text-[var(--good-text)]">{msg}</p>}
    </div>
  )
}

function Company() {
  const sc = useActiveScenario()
  const update = useStore((s) => s.updateScenario)
  const set = (fn: (s: typeof sc) => void) => update(sc.id, fn)
  const c = sc.costs
  return (
    <Card title={<span className="inline-flex items-center gap-2"><Building2 size={16} /> Mon entreprise</span>} subtitle={`Paramètres du scénario actif « ${sc.name} » (utilisés pour chiffrer les gains)`}>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Entreprise" className="col-span-2"><Input value={sc.company.name} onChange={(e) => set((s) => (s.company.name = e.target.value))} /></Field>
        <Field label="Produit"><Input value={sc.company.product} onChange={(e) => set((s) => (s.company.product = e.target.value))} /></Field>
        <Field label="Secteur"><Input value={sc.company.sector} onChange={(e) => set((s) => (s.company.sector = e.target.value))} /></Field>
        <Field label="Prix de vente / pièce"><NumberInput value={c.sellingPrice} min={0} step={1} suffix="€" onChange={(v) => set((s) => (s.costs.sellingPrice = v))} /></Field>
        <Field label="Coût matière / pièce"><NumberInput value={c.materialCost} min={0} step={1} suffix="€" onChange={(v) => set((s) => (s.costs.materialCost = v))} /></Field>
        <Field label="Coût horaire opérateur"><NumberInput value={c.laborCostPerHour} min={0} step={1} suffix="€/h" onChange={(v) => set((s) => (s.costs.laborCostPerHour = v))} /></Field>
        <Field label="Valeur d'une pièce en cours"><NumberInput value={c.wipUnitValue} min={0} step={1} suffix="€" onChange={(v) => set((s) => (s.costs.wipUnitValue = v))} /></Field>
        <Field label="Coût de possession des stocks"><NumberInput value={c.holdingRate} min={0} step={1} suffix="%/an" onChange={(v) => set((s) => (s.costs.holdingRate = v))} /></Field>
        <Field label="Pénalité de retard / pièce"><NumberInput value={c.lateDeliveryPenalty} min={0} step={1} suffix="€" onChange={(v) => set((s) => (s.costs.lateDeliveryPenalty = v))} /></Field>
        <Field label="Jours ouvrés / an"><NumberInput value={c.workingDaysPerYear} min={1} max={366} step={1} onChange={(v) => set((s) => (s.costs.workingDaysPerYear = Math.round(v)))} /></Field>
        <Field label="Demande client"><NumberInput value={sc.demand} min={1} step={10} suffix="pcs/j" onChange={(v) => set((s) => (s.demand = Math.round(v)))} /></Field>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">Horaires, pauses et taille de lot : <Link className="underline" to="/lean/line">Ligne de production</Link>.</p>
    </Card>
  )
}

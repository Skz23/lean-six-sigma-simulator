/**
 * Génération du rapport PDF (jsPDF + autotable). Chargé à la demande.
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { Scenario } from '../engine/types'
import type { Kpis } from '../engine/kpi'
import type { SimResults } from '../engine/types'
import { METRICS, profitability } from '../engine/compare'
import { analyzeMuda } from '../lean/muda'
import { vsmData } from '../lean/tools'
import type { ToolsState } from '../store/types'
import { eur, fmt, fmtFixed, pct } from '../lib/format'
import { interpretCapability } from '../stats/capability'

import { SECTIONS } from './sections'
export { SECTIONS }

export interface ReportInput {
  title: string
  author: string
  before: { sc: Scenario; r: SimResults; k: Kpis }
  after: { sc: Scenario; r: SimResults; k: Kpis }
  tools: ToolsState
  sections: boolean[]
}

/** Les polices standard PDF ne couvrent que WinAnsi : on translittère les symboles. */
const t = (s: string) =>
  s
    .replace(/[  ]/g, ' ')
    .replace(/σ/g, 'sigma')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/−/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[—–]/g, '-')
    .replace(/•/g, '-')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/Ø/g, 'Diam.')
    .replace(/×/g, 'x')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/[^\x20-\x7E -ÿ€\n]/g, '')

const BRAND: [number, number, number] = [21, 122, 111]
const GREY: [number, number, number] = [82, 81, 78]

export async function generateReport(inp: ReportInput, save = true) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const M = 16
  let y = 0
  const { before: B, after: A } = inp

  const ensure = (h: number) => {
    if (y + h > 280) {
      doc.addPage()
      y = 20
    }
  }
  const h1 = (n: number, s: string) => {
    doc.addPage()
    y = 22
    doc.setFillColor(...BRAND)
    doc.rect(M, y - 6, 3, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(20, 20, 20)
    doc.text(t(`${n}. ${s}`), M + 6, y + 1)
    y += 12
  }
  const h2 = (s: string) => {
    ensure(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.setTextColor(...BRAND)
    doc.text(t(s), M, y)
    y += 6
  }
  const p = (s: string, size = 10) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(t(s), W - 2 * M) as string[]
    for (const l of lines) {
      ensure(6)
      doc.text(l, M, y)
      y += size * 0.45
    }
    y += 2
  }
  const bullets = (items: string[]) => items.forEach((s) => p(`•  ${s}`))
  const table = (head: string[], body: (string | number)[][], opts: { colWidths?: number[] } = {}) => {
    ensure(20)
    autoTable(doc, {
      startY: y,
      head: [head.map(t)],
      body: body.map((r) => r.map((c) => t(String(c)))),
      margin: { left: M, right: M },
      styles: { fontSize: 8.5, cellPadding: 1.8, textColor: [30, 30, 30] },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 246, 245] },
      columnStyles: opts.colWidths ? Object.fromEntries(opts.colWidths.map((w, i) => [i, { cellWidth: w }])) : undefined,
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }
  /** Diagramme en barres groupées avant/après (axe unique). */
  const bars = (title: string, labels: string[], a: number[], b: number[], unit: string) => {
    const h = 58
    ensure(h + 12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...GREY)
    doc.text(t(title), M, y)
    y += 4
    const x0 = M + 10
    const w = W - 2 * M - 12
    const max = Math.max(...a, ...b, 1e-9) * 1.15
    doc.setDrawColor(200, 200, 195)
    doc.line(x0, y + h, x0 + w, y + h)
    const gw = w / labels.length
    const bw = Math.min(14, gw / 3)
    labels.forEach((l, i) => {
      const gx = x0 + i * gw + gw / 2
      const ha = (a[i] / max) * h
      const hb = (b[i] / max) * h
      doc.setFillColor(42, 120, 214)
      doc.rect(gx - bw - 1, y + h - ha, bw, ha, 'F')
      doc.setFillColor(235, 104, 52)
      doc.rect(gx + 1, y + h - hb, bw, hb, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(60, 60, 60)
      doc.text(t(fmt(a[i], 1)), gx - bw / 2 - 1, y + h - ha - 1.5, { align: 'center' })
      doc.text(t(fmt(b[i], 1)), gx + bw / 2 + 1, y + h - hb - 1.5, { align: 'center' })
      doc.setFontSize(7.5)
      doc.text(doc.splitTextToSize(t(l), gw - 2) as string[], gx, y + h + 4, { align: 'center' })
    })
    doc.setFontSize(7.5)
    doc.setFillColor(42, 120, 214)
    doc.rect(x0, y - 3, 3, 3, 'F')
    doc.text(t(`Avant (${B.sc.name})`), x0 + 4.5, y - 0.6)
    doc.setFillColor(235, 104, 52)
    doc.rect(x0 + 60, y - 3, 3, 3, 'F')
    doc.text(t(`Après (${A.sc.name})  ${unit}`), x0 + 64.5, y - 0.6)
    y += h + 14
  }

  // ---------- Couverture ----------
  doc.setFillColor(15, 42, 40)
  doc.rect(0, 0, W, 297, 'F')
  doc.setFillColor(...BRAND)
  doc.rect(0, 110, W, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text(doc.splitTextToSize(t(inp.title), W - 40) as string[], 20, 80)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.text(t(`${B.sc.company.name} — ${B.sc.company.product}`), 20, 125)
  doc.setFontSize(11)
  doc.setTextColor(190, 210, 205)
  doc.text(t(`Comparaison : ${B.sc.name} -> ${A.sc.name}`), 20, 135)
  doc.text(t(`Auteur : ${inp.author || '—'}`), 20, 143)
  doc.text(t(`Date : ${new Date().toLocaleDateString('fr-FR')}`), 20, 151)
  doc.setFontSize(9)
  doc.text(t('Lean Six Sigma Simulator — rapport généré à partir de données simulées (graine reproductible).'), 20, 280)

  const muda = analyzeMuda(B.sc, B.r, B.k)
  const vsmB = vsmData(B.sc, B.r)
  const prof = profitability(B.k, A.k, B.sc, A.sc)
  const project = inp.tools.dmaic.find((d) => d.scenarioId === B.sc.id) ?? inp.tools.dmaic[0]
  const c = B.sc.process.characteristic
  let n = 0
  const on = (i: number) => inp.sections[i]

  if (on(0)) {
    h1(++n, SECTIONS[0])
    table(['Rubrique', 'Information'], [
      ['Entreprise', B.sc.company.name],
      ['Secteur', B.sc.company.sector],
      ['Produit', B.sc.company.product],
      ['Demande client', `${B.sc.demand} pièces / jour`],
      ['Organisation', `${B.sc.shift.duration / 60} h d'ouverture, ${B.sc.shift.breaks.length} pauses`],
    ], { colWidths: [45] })
    p(B.sc.company.description)
  }
  if (on(1)) {
    h1(++n, SECTIONS[1])
    p(`La ligne comporte ${B.sc.stations.length} postes en série. La caractéristique critique (CTQ) « ${c.name} » (${c.lsl} - ${c.usl} ${c.unit}) est réalisée au poste ${B.sc.stations.find((s) => s.id === B.sc.process.stationId)?.name}.`)
    table(
      ['Poste', 'CT (s)', 'C/O (min)', 'Opér.', 'Dispo.', 'Défauts', 'Stock max', 'Type'],
      B.sc.stations.map((s) => [s.name, fmt(s.cycleTime, 0), fmt(s.changeoverTime, 0), s.operators, pct(s.availability, 0), pct(s.defectRate, 1), s.bufferCapacity, s.valueAdded ? 'VA' : 'NVA']),
    )
    p(`Pilotage : ${B.sc.releasePolicy === 'push' ? 'flux poussé' : 'flux tiré (kanban)'} · taille de lot : ${B.sc.batchSize} pièces · manutention à ${B.sc.transportSpeed} m/s.`)
  }
  if (on(2)) {
    h1(++n, SECTIONS[2])
    table(['Indicateur', 'Valeur'], [
      ['Takt Time', `${fmt(B.k.taktTime, 1)} s`],
      ['Temps de cycle effectif du goulot', `${fmt(B.k.bottleneckCycleTime, 1)} s (${B.r.stations[B.r.bottleneckIndex].name})`],
      ['Pièces bonnes / jour', `${B.k.good} (demande ${B.sc.demand})`],
      ['Lead Time (Little)', `${fmt(B.k.leadTime / 60, 1)} min`],
      ['Encours moyen', `${fmt(B.k.wipAvg, 1)} pièces`],
      ['TRS / OEE', pct(B.k.oee)],
      ['Taux de défauts', pct(1 - B.k.yield, 2)],
      ['Cpk / Ppk', `${fmtFixed(B.k.dimension?.cpk, 2)} / ${fmtFixed(B.k.dimension?.ppk, 2)}`],
      ['Marge journalière', eur(B.k.costs.margin)],
    ], { colWidths: [80] })
    if (B.k.good < B.sc.demand) p(`La ligne ne couvre pas la demande : ${B.sc.demand - B.k.good} pièces manquantes par jour. Le goulot ${B.r.stations[B.r.bottleneckIndex].name} est actif ${pct(B.r.stations[B.r.bottleneckIndex].activeRatio, 0)} du temps.`)
  }
  if (on(3)) {
    h1(++n, SECTIONS[3])
    h2('Value Stream Mapping')
    p(`Lead Time VSM : ${fmt(vsmB.leadDays, 2)} jour(s) pour ${fmt(vsmB.vaSeconds, 0)} s de valeur ajoutée, soit un Process Cycle Efficiency de ${pct(vsmB.pce, 2)}. ${pct(vsmB.waitSeconds / vsmB.leadSeconds, 0)} du Lead Time est de l'attente en stock.`)
    h2('Les 8 gaspillages')
    table(['Gaspillage', 'Sévérité', 'Coût / jour', 'Constat principal'], muda.map((m) => [m.name, m.severity, eur(m.dailyCost), `${m.metrics[0].label} : ${m.metrics[0].value}`]))
    h2('Taux d\'activité des postes')
    table(['Poste', 'Production', 'Pannes', 'Changements', 'Bloqué', 'Famine', 'TRS'], B.r.stations.map((s) => {
      const tot = s.time.processing + s.time.down + s.time.changeover + s.time.blocked + s.time.starved || 1
      return [s.name, pct(s.time.processing / tot, 0), pct(s.time.down / tot, 0), pct(s.time.changeover / tot, 0), pct(s.time.blocked / tot, 0), pct(s.time.starved / tot, 0), pct(s.oee.oee, 0)]
    }))
  }
  if (on(4)) {
    h1(++n, SECTIONS[4])
    if (B.k.dimension) {
      const d = B.k.dimension
      table(['Indice', 'Court terme (capabilité)', 'Long terme (performance)'], [
        ['Écart-type', fmtFixed(d.sigmaWithin, 5), fmtFixed(d.sigmaOverall, 5)],
        ['Potentiel (Cp / Pp)', fmtFixed(d.cp, 2), fmtFixed(d.pp, 2)],
        ['Réel (Cpk / Ppk)', fmtFixed(d.cpk, 2), fmtFixed(d.ppk, 2)],
        ['PPM attendus', fmt(d.ppmWithin, 0), fmt(d.ppmOverall, 0)],
      ])
      p(`Moyenne : ${fmtFixed(d.mean, 4)} ${c.unit} (cible ${c.nominal}). PPM observés : ${fmt(d.ppmObserved, 0)}.`)
      bullets(interpretCapability(d, { lsl: c.lsl, usl: c.usl, target: c.nominal }))
    }
    h2('Pareto des défauts')
    const tot = B.k.defectsByType.reduce((s, x) => s + x.count, 0) || 1
    let cum = 0
    table(['Défaut', 'Nombre', 'Part', 'Cumul'], B.k.defectsByType.map((x) => {
      cum += x.count
      return [x.type, x.count, pct(x.count / tot, 1), pct(cum / tot, 1)]
    }))
    p(`DPMO global : ${fmt(B.k.sigma.dpmo, 0)} — niveau sigma ${fmtFixed(B.k.sigma.sigmaLevel, 2)} (convention de décalage de 1,5 sigma).`)
  }
  if (on(5) && project) {
    h1(++n, SECTIONS[5])
    h2(project.name)
    table(['Élément de charte', 'Contenu'], [
      ['Problème', project.charter.problem],
      ['Enjeu', project.charter.businessCase],
      ['Objectif', project.charter.goal],
      ['Périmètre', project.charter.scope],
      ['Équipe', `${project.charter.leader} — ${project.charter.team}`],
    ], { colWidths: [40] })
    if (project.voc.length) table(['Voix du client', 'CTQ', 'Cible'], project.voc.map((v) => [v.voice, v.ctq, v.target]))
    const likely = project.causes.filter((x) => x.likely)
    if (likely.length) {
      h2('Causes probables (Ishikawa)')
      bullets(likely.map((x) => `${x.category} : ${x.text}`))
    }
    project.whys.filter((w) => w.rootCause).forEach((w) => {
      h2(`5 Pourquoi — ${w.problem}`)
      bullets(w.whys.filter(Boolean).map((x, i) => `Pourquoi ${i + 1} : ${x}`))
      p(`Cause racine : ${w.rootCause}`)
    })
    table(['Phase', 'Revue validée'], (['define', 'measure', 'analyze', 'improve', 'control'] as const).map((ph) => [ph.toUpperCase(), project.gates[ph] ? 'Oui' : 'Non']))
  }
  if (on(6)) {
    h1(++n, SECTIONS[6])
    const acts = A.sc.actions.filter((a) => !B.sc.actions.some((b) => b.id === a.id))
    if (acts.length) table(['Action', 'Approche', 'Investissement'], acts.map((a) => [a.label, a.approach === 'lean' ? 'Lean' : 'Six Sigma', eur(a.investment)]))
    else p('Aucune action chiffrée n\'est associée au scénario amélioré.')
    p(A.sc.description)
    const kz = inp.tools.kaizen
    if (kz.length) table(['Kaizen', 'Statut', 'Indicateur', 'Avant', 'Après'], kz.map((k) => [k.title, k.status, k.kpi, `${k.before} ${k.unit}`, k.after !== null ? `${k.after} ${k.unit}` : '—']))
  }
  if (on(7)) {
    h1(++n, SECTIONS[7])
    table(['Indicateur', 'Valeur'], [
      ['Pièces bonnes / jour', `${A.k.good}`],
      ['Débit', `${fmt(A.k.throughputPerHour, 1)} pcs/h`],
      ['Lead Time', `${fmt(A.k.leadTime / 60, 1)} min`],
      ['Encours moyen', `${fmt(A.k.wipAvg, 1)} pcs`],
      ['TRS', pct(A.k.oee)],
      ['Taux de défauts', pct(1 - A.k.yield, 2)],
      ['Cpk / Ppk', `${fmtFixed(A.k.dimension?.cpk, 2)} / ${fmtFixed(A.k.dimension?.ppk, 2)}`],
      ['Marge journalière', eur(A.k.costs.margin)],
    ], { colWidths: [80] })
  }
  if (on(8)) {
    h1(++n, SECTIONS[8])
    table(['Indicateur', 'Avant', 'Après', 'Variation'], METRICS.map((m) => {
      const a = m.get(B.k, B.sc)
      const b = m.get(A.k, A.sc)
      const ch = Number.isFinite(a) && a !== 0 ? (b - a) / Math.abs(a) : NaN
      return [m.label, m.format(a), m.format(b), Number.isFinite(ch) ? `${ch > 0 ? '+' : ''}${fmt(ch * 100, 1)} %` : '—']
    }))
    bars('Lead Time (min) et encours (pcs)', ['Lead Time', 'WIP moyen'], [B.k.leadTime / 60, B.k.wipAvg], [A.k.leadTime / 60, A.k.wipAvg], '')
    bars('Performance', ['Débit (pcs/h)', 'TRS (%)', 'Défauts (x0,1 %)', 'Cpk (x10)'], [B.k.throughputPerHour, B.k.oee * 100, (1 - B.k.yield) * 1000, (B.k.dimension?.cpk ?? 0) * 10], [A.k.throughputPerHour, A.k.oee * 100, (1 - A.k.yield) * 1000, (A.k.dimension?.cpk ?? 0) * 10], '')
  }
  if (on(9)) {
    h1(++n, SECTIONS[9])
    table(['Poste de coût (par jour)', 'Avant', 'Après'], [
      ['Chiffre d\'affaires', eur(B.k.costs.revenue), eur(A.k.costs.revenue)],
      ['Matière', eur(B.k.costs.material), eur(A.k.costs.material)],
      ['Main-d\'œuvre', eur(B.k.costs.labor), eur(A.k.costs.labor)],
      ['Possession des stocks', eur(B.k.costs.holding), eur(A.k.costs.holding)],
      ['Pénalités de retard', eur(B.k.costs.latePenalty), eur(A.k.costs.latePenalty)],
      ['Coût de non-qualité (rebuts)', eur(B.k.costs.copq), eur(A.k.costs.copq)],
      ['Marge', eur(B.k.costs.margin), eur(A.k.costs.margin)],
    ])
    table(['Rentabilité', 'Valeur'], [
      ['Gain de marge journalier', eur(prof.dailyGain)],
      ['Gain annuel', eur(prof.annualGain)],
      ['Investissement', eur(prof.investment)],
      ['ROI annuel', Number.isFinite(prof.roi) ? `${fmt(prof.roi * 100, 0)} %` : '—'],
      ['Délai de retour', Number.isFinite(prof.paybackMonths) ? `${fmt(prof.paybackMonths, 1)} mois` : '—'],
      ['Trésorerie libérée (stocks)', eur((B.k.wipAvg + B.k.fgStock - A.k.wipAvg - A.k.fgStock) * B.sc.costs.wipUnitValue)],
    ], { colWidths: [80] })
    p('Hypothèses : les gains sont calculés sur une journée simulée représentative multipliée par le nombre de jours ouvrés ; le chiffre d\'affaires est plafonné par la demande client.')
  }
  if (on(10)) {
    h1(++n, SECTIONS[10])
    const rec: string[] = []
    const ka = A.k
    if (ka.dimension?.cpk !== undefined && ka.dimension.cpk < 1.33) rec.push('Poursuivre le projet Six Sigma : le Cpk reste inférieur à 1,33.')
    else rec.push('Maintenir la capabilité par le plan de contrôle (cartes X-barre/R au poste, réaction documentée).')
    if (ka.good < A.sc.demand) rec.push(`Augmenter la capacité du goulot (${A.r.stations[A.r.bottleneckIndex].name}) : TPM, SMED, réduction des micro-arrêts.`)
    if (ka.pce < 0.05) rec.push('Réduire encore les encours pour améliorer le Process Cycle Efficiency (flux tiré, FIFO, lots plus petits).')
    analyzeMuda(A.sc, A.r, A.k).filter((m) => m.severity === 'élevé').forEach((m) => rec.push(`Traiter le gaspillage « ${m.name} » : ${m.improvements[0]}.`))
    rec.push('Standardiser les nouvelles pratiques (standards de travail, audits 5S) et animer la performance au quotidien (management visuel).')
    rec.push('Élargir la démarche aux autres familles de produits et capitaliser les retours d\'expérience (Kaizen).')
    bullets(rec)
  }

  // Pieds de page
  const pages = doc.getNumberOfPages()
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(t(`${B.sc.company.name} — ${inp.title}`), M, 290)
    doc.text(`${i - 1} / ${pages - 1}`, W - M, 290, { align: 'right' })
  }
  if (save) doc.save(`rapport-lean-six-sigma-${new Date().toISOString().slice(0, 10)}.pdf`)
  return doc
}

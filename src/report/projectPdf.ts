/**
 * Livrables PDF d'un projet : rapport de projet (ou d'une phase), A3 sur une page, rapport 8D.
 * Chargé à la demande (jsPDF).
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { saveFile } from '../lib/download'
import type { DmaicProject, ProjectWorkspace } from '../store/types'
import { PHASES, type PhaseId } from '../workflow/phases'
import { METHOD_LABEL, projectProgress } from '../workflow/project'
import { a3Blocks, chosenSolutions, d8Blocks, phaseSummary, rootCauses, type Block } from './projectContent'

const t = (s: string) =>
  s
    .replace(/[  ]/g, ' ')
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
    .replace(/X̄/g, 'Xbarre')
    .replace(/[^\x20-\x7E -ÿ€\n]/g, '')

const BRAND: [number, number, number] = [21, 122, 111]
const today = () => new Date().toLocaleDateString('fr-FR')
const safeName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').slice(0, 50)

async function out(doc: jsPDF, name: string, save: boolean) {
  if (!save) return doc
  await saveFile(name, doc.output('blob'))
  return doc
}

/** Page portrait avec titre, sous-titres et blocs de texte. */
function writer(doc: jsPDF) {
  const M = 16
  const W = doc.internal.pageSize.getWidth()
  let y = 20
  const ensure = (h: number) => {
    if (y + h > 280) {
      doc.addPage()
      y = 20
    }
  }
  return {
    get y() {
      return y
    },
    set y(v: number) {
      y = v
    },
    title(s: string, sub?: string) {
      doc.setFillColor(...BRAND)
      doc.rect(0, 0, W, 30, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(17)
      doc.text(doc.splitTextToSize(t(s), W - 2 * M)[0], M, 14)
      if (sub) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text(t(sub), M, 23)
      }
      y = 40
    },
    h2(s: string) {
      y += 3
      ensure(16)
      doc.setFillColor(...BRAND)
      doc.rect(M, y - 4.5, 2.5, 6.5, 'F')
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text(t(s), M + 5, y)
      y += 7
    },
    h3(s: string) {
      ensure(10)
      doc.setTextColor(40, 40, 40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.text(t(s), M, y)
      y += 5
    },
    p(s: string, muted = false) {
      if (!s.trim()) return
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...((muted ? [110, 110, 110] : [40, 40, 40]) as [number, number, number]))
      const ls = doc.splitTextToSize(t(s), W - 2 * M)
      for (const l of ls) {
        ensure(5)
        doc.text(l, M, y)
        y += 4.4
      }
      y += 2
    },
    table(head: string[], body: string[][]) {
      if (!body.length) return
      autoTable(doc, {
        startY: y,
        head: [head.map(t)],
        body: body.map((r) => r.map(t)),
        margin: { left: M, right: M },
        styles: { fontSize: 8.5, cellPadding: 1.8, overflow: 'linebreak' },
        headStyles: { fillColor: BRAND },
        theme: 'grid',
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    },
  }
}

/** Rapport de projet complet, ou d'une seule phase (rapport de revue de phase). */
export async function projectReport(p: DmaicProject, ws: ProjectWorkspace, opts: { phase?: PhaseId; save?: boolean } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = writer(doc)
  const ph = opts.phase ? PHASES.find((x) => x.id === opts.phase)! : undefined
  const prog = projectProgress(p)
  w.title(ph ? `Revue de phase ${ph.n} · ${ph.label} — ${p.name}` : `Rapport de projet — ${p.name}`, `${METHOD_LABEL[p.method ?? 'dmaic']} · avancement ${Math.round(prog.ratio * 100)} % · édité le ${today()}`)

  const ch = p.charter
  w.h2('Charte du projet')
  w.table(
    ['Rubrique', 'Contenu'],
    (
      [
        ['Problème', ch.problem],
        ['Enjeu', ch.businessCase],
        ['Objectif', ch.goal],
        ['Périmètre', ch.scope],
        ['Indicateur de départ', ch.baselineMetric],
        ['Cible', ch.targetMetric],
        ['Sponsor / pilote', [ch.sponsor, ch.leader].filter(Boolean).join(' / ')],
        ['Équipe', ch.team],
        ['Dates', [ch.startDate, ch.endDate].filter(Boolean).join(' -> ')],
      ] as string[][]
    ).filter((r) => r[1]?.trim()),
  )

  w.h2('Avancement par phase')
  w.table(
    ['Phase', 'Outils', 'Revue'],
    PHASES.map((x) => {
      const s = phaseSummary(p, x.id)
      return [s.title, s.progress, s.gate ? 'Validée' : x.id === p.phase ? 'En cours' : 'Non validée']
    }),
  )

  for (const x of ph ? [ph] : PHASES) {
    const s = phaseSummary(p, x.id)
    w.h2(s.title)
    w.p(`${s.progress} · revue de fin de phase : ${s.gate ? 'validée' : 'non validée'}`, true)
    if (s.done.length) w.table(['Étape', 'Outil', 'Résultat retenu'], s.done.map((d) => [d.step, d.tool, d.result || '-']))
    if (s.todo.length) w.p(`Reste à faire : ${s.todo.join(' ; ')}`, true)
    if (s.notes.trim()) {
      w.h3('Notes de phase')
      w.p(s.notes)
    }
    if (x.id === 'define') {
      if (p.voc.length) {
        w.h3('Voix du client -> CTQ')
        w.table(['Verbatim', 'Besoin', 'CTQ', 'Mesure', 'Cible'], p.voc.map((v) => [v.voice, v.need, v.ctq, v.measure, v.target]))
      }
      if (p.sipoc.length) {
        w.h3('SIPOC')
        w.table(['Fournisseurs', 'Entrées', 'Processus', 'Sorties', 'Clients'], p.sipoc.map((r) => [r.supplier, r.input, r.process, r.output, r.customer]))
      }
    }
    if (x.id === 'analyze') {
      const rc = rootCauses(p)
      if (rc.length) {
        w.h3('Causes racines retenues')
        w.p(rc.map((c) => `- ${c}`).join('\n'))
      }
      const top = [...ws.fmea].sort((a, b) => b.s * b.o * b.d - a.s * a.o * a.d).slice(0, 5)
      if (top.length) {
        w.h3('AMDEC — risques les plus élevés')
        w.table(['Mode de défaillance', 'Cause', 'NPR', 'Action'], top.map((f) => [f.failureMode, f.cause, String(f.s * f.o * f.d), f.action]))
      }
    }
    if (x.id === 'improve' && p.solutions.length) {
      w.h3('Solutions évaluées')
      w.table(['Solution', 'Impact', 'Effort', 'Coût', 'Risque', 'Retenue'], p.solutions.map((s2) => [s2.label, String(s2.impact), String(s2.effort), String(s2.cost), String(s2.risk), s2.selected ? 'Oui' : '']))
    }
    if (x.id === 'control' && p.controlPlan.length) {
      w.h3('Plan de contrôle')
      w.table(['Caractéristique', 'Spéc.', 'Méthode', 'Fréquence', 'Carte', 'Réaction', 'Resp.'], p.controlPlan.map((c) => [c.characteristic, c.spec, c.method, c.frequency, c.chart, c.reaction, c.owner]))
    }
  }
  const name = ph ? `revue-phase-${ph.n}-${safeName(p.name)}.pdf` : `rapport-projet-${safeName(p.name)}.pdf`
  return out(doc, name, opts.save ?? true)
}

/** A3 : le projet sur une page (format A3 paysage), deux colonnes de quatre cadres. */
export async function a3Report(p: DmaicProject, ws: ProjectWorkspace, save = true) {
  const doc = new jsPDF({ unit: 'mm', format: 'a3', orientation: 'landscape' })
  const W = 420
  const H = 297
  const M = 12
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, W, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(t(`A3 — ${p.name}`), M, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(t(`${p.charter.leader ? `Pilote : ${p.charter.leader} · ` : ''}${today()}`), W - M, 13, { align: 'right' })
  const blocks = a3Blocks(p, ws)
  const colW = (W - 3 * M) / 2
  const top = 28
  const boxH = (H - top - M - 3 * 5) / 4
  const draw = (b: Block, x: number, y: number) => {
    doc.setDrawColor(200, 200, 200)
    doc.setFillColor(250, 250, 249)
    doc.roundedRect(x, y, colW, boxH, 2, 2, 'FD')
    doc.setTextColor(...BRAND)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.text(t(b.title), x + 4, y + 7)
    doc.setTextColor(40, 40, 40)
    doc.setFont('helvetica', 'normal')
    let fs = 9.5
    let ls: string[] = []
    // réduit la police si le texte déborde du cadre
    for (; fs >= 6.5; fs -= 0.5) {
      doc.setFontSize(fs)
      ls = doc.splitTextToSize(t(b.text), colW - 8)
      if (ls.length * fs * 0.42 <= boxH - 13) break
    }
    const max = Math.floor((boxH - 13) / (fs * 0.42))
    if (ls.length > max) ls = [...ls.slice(0, max - 1), '[...]']
    doc.text(ls, x + 4, y + 13)
  }
  blocks.forEach((b, i) => draw(b, i < 4 ? M : 2 * M + colW, top + (i % 4) * (boxH + 5)))
  return out(doc, `A3-${safeName(p.name)}.pdf`, save)
}

/** Rapport 8D (D0 à D8). */
export async function eightDReport(p: DmaicProject, ws: ProjectWorkspace, save = true) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = writer(doc)
  w.title(`Rapport 8D — ${p.name}`, `Édité le ${today()}`)
  for (const b of d8Blocks(p, ws)) {
    w.h2(b.title)
    w.p(b.text, b.text === 'À compléter.')
  }
  const sol = chosenSolutions(p)
  if (!sol.length) w.p('Aucune solution n\'est encore marquée « retenue » dans l\'espace projet (phase Innover).', true)
  return out(doc, `8D-${safeName(p.name)}.pdf`, save)
}

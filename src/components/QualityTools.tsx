import { useState } from 'react'
import clsx from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import type { FmeaRow, IshikawaCause, WhyChain } from '../store/types'
import { uid } from '../store/useStore'
import { Badge, Button, Field, Input, NumberInput, Select, Table, TextArea } from './ui'

export const CATEGORIES: IshikawaCause['category'][] = ['Main-d\'œuvre', 'Méthode', 'Matière', 'Machine', 'Milieu', 'Mesure']

/** Diagramme d'Ishikawa (arête de poisson) en SVG. */
export function IshikawaDiagram({ effect, causes }: { effect: string; causes: IshikawaCause[] }) {
  const W = 980
  const H = 420
  const spineY = H / 2
  const headX = W - 190
  const top = CATEGORIES.slice(0, 3)
  const bottom = CATEGORIES.slice(3)
  const boneX = (i: number) => 90 + i * ((headX - 140) / 3) + 80
  const wrap = (t: string, n = 30) => {
    const words = t.split(' ')
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > n) {
        lines.push(cur.trim())
        cur = w
      } else cur += ' ' + w
    }
    if (cur.trim()) lines.push(cur.trim())
    return lines.slice(0, 3)
  }
  const bone = (cat: IshikawaCause['category'], i: number, up: boolean) => {
    const x = boneX(i)
    const yEnd = up ? 50 : H - 50
    const list = causes.filter((c) => c.category === cat)
    return (
      <g key={cat}>
        <line x1={x} y1={yEnd} x2={x + 110} y2={spineY} stroke="var(--text-secondary)" strokeWidth={2} />
        <rect x={x - 62} y={up ? yEnd - 30 : yEnd + 4} width={124} height={26} rx={5} fill="var(--series-1)" fillOpacity={0.15} stroke="var(--series-1)" />
        <text x={x} y={up ? yEnd - 12 : yEnd + 22} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-primary)">
          {cat}
        </text>
        {list.slice(0, 5).map((c, k) => {
          const t = (k + 1) / (Math.min(list.length, 5) + 1)
          const bx = x + 110 * t
          const by = yEnd + (spineY - yEnd) * t
          return (
            <g key={c.id}>
              <line x1={bx - 70} y1={by} x2={bx} y2={by} stroke="var(--axis)" />
              <text x={bx - 72} y={by + 3} textAnchor="end" fontSize={10} fill={c.likely ? 'var(--critical)' : 'var(--text-secondary)'} fontWeight={c.likely ? 600 : 400}>
                {c.text.length > 34 ? c.text.slice(0, 33) + '…' : c.text}
              </text>
            </g>
          )
        })}
      </g>
    )
  }
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" style={{ minWidth: 760 }} role="img" aria-label="Diagramme d'Ishikawa">
        <line x1={40} y1={spineY} x2={headX} y2={spineY} stroke="var(--text-primary)" strokeWidth={3} />
        <polygon points={`${headX},${spineY - 10} ${headX + 14},${spineY} ${headX},${spineY + 10}`} fill="var(--text-primary)" />
        <rect x={headX + 18} y={spineY - 46} width={165} height={92} rx={8} fill="var(--critical)" fillOpacity={0.1} stroke="var(--critical)" />
        {wrap(effect, 22).map((l, i) => (
          <text key={i} x={headX + 100} y={spineY - 14 + i * 15} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-primary)">
            {l}
          </text>
        ))}
        {top.map((c, i) => bone(c, i, true))}
        {bottom.map((c, i) => bone(c, i, false))}
      </svg>
      <p className="mt-1 text-[11px] text-[var(--muted)]">En rouge : causes jugées les plus probables (à vérifier par les données).</p>
    </div>
  )
}

export function IshikawaEditor({ causes, onChange }: { causes: IshikawaCause[]; onChange: (c: IshikawaCause[]) => void }) {
  const [cat, setCat] = useState<IshikawaCause['category']>('Machine')
  const [text, setText] = useState('')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Catégorie (6M)">
          <Select value={cat} onChange={(e) => setCat(e.target.value as IshikawaCause['category'])} className="w-40">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Cause" className="min-w-48 flex-1">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { onChange([...causes, { id: uid('c'), category: cat, text: text.trim(), likely: false }]); setText('') } }} />
        </Field>
        <Button onClick={() => { if (text.trim()) { onChange([...causes, { id: uid('c'), category: cat, text: text.trim(), likely: false }]); setText('') } }}>
          <Plus size={14} /> Ajouter
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <div key={c} className="rounded-lg border border-black/[.06] p-2 dark:border-white/10">
            <div className="mb-1 text-xs font-semibold">{c}</div>
            {causes.filter((x) => x.category === c).map((x) => (
              <div key={x.id} className="flex items-center gap-1.5 py-0.5 text-xs">
                <input type="checkbox" checked={x.likely} title="Cause probable" className="accent-[var(--critical)]" onChange={(e) => onChange(causes.map((y) => (y.id === x.id ? { ...y, likely: e.target.checked } : y)))} />
                <span className={clsx('flex-1', x.likely && 'font-semibold text-[var(--critical)]')}>{x.text}</span>
                <button onClick={() => onChange(causes.filter((y) => y.id !== x.id))} className="text-[var(--muted)] hover:text-[var(--critical)]" aria-label="Supprimer">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {!causes.some((x) => x.category === c) && <div className="text-[11px] text-[var(--muted)]">—</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FiveWhyEditor({ chains, onChange }: { chains: WhyChain[]; onChange: (c: WhyChain[]) => void }) {
  const upd = (id: string, fn: (w: WhyChain) => WhyChain) => onChange(chains.map((c) => (c.id === id ? fn(c) : c)))
  return (
    <div className="space-y-4">
      {chains.map((ch) => (
        <div key={ch.id} className="rounded-lg border border-black/[.08] p-3 dark:border-white/10">
          <div className="flex items-end gap-2">
            <Field label="Problème" className="flex-1">
              <Input value={ch.problem} onChange={(e) => upd(ch.id, (w) => ({ ...w, problem: e.target.value }))} />
            </Field>
            <Button size="sm" variant="danger" onClick={() => onChange(chains.filter((c) => c.id !== ch.id))} aria-label="Supprimer">
              <Trash2 size={13} />
            </Button>
          </div>
          <div className="mt-2 space-y-1.5 border-l-2 border-brand-500/40 pl-3">
            {ch.whys.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs font-semibold text-brand-700 dark:text-brand-300">Pourquoi {i + 1} ?</span>
                <Input value={w} onChange={(e) => upd(ch.id, (x) => ({ ...x, whys: x.whys.map((y, j) => (j === i ? e.target.value : y)) }))} />
              </div>
            ))}
            {ch.whys.length < 7 && (
              <Button size="sm" variant="ghost" onClick={() => upd(ch.id, (x) => ({ ...x, whys: [...x.whys, ''] }))}>
                <Plus size={12} /> Pourquoi
              </Button>
            )}
          </div>
          <Field label="Cause racine identifiée" className="mt-2">
            <Input value={ch.rootCause} onChange={(e) => upd(ch.id, (x) => ({ ...x, rootCause: e.target.value }))} className="border-[var(--critical)]/40" />
          </Field>
        </div>
      ))}
      <Button onClick={() => onChange([...chains, { id: uid('w'), problem: 'Nouveau problème', whys: ['', '', ''], rootCause: '' }])}>
        <Plus size={14} /> Nouvelle analyse 5 Pourquoi
      </Button>
    </div>
  )
}

export const rpn = (r: { s: number; o: number; d: number }) => r.s * r.o * r.d

export function FmeaTable({ rows, onChange, threshold }: { rows: FmeaRow[]; onChange: (r: FmeaRow[]) => void; threshold: number }) {
  const [edit, setEdit] = useState<string | null>(null)
  const sorted = [...rows].sort((a, b) => rpn(b) - rpn(a))
  const up = (id: string, patch: Partial<FmeaRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const cur = rows.find((r) => r.id === edit)
  const tone = (v: number) => (v >= threshold ? 'critical' : v >= threshold / 2 ? 'warning' : 'good')
  return (
    <div className="space-y-3">
      <Table
        dense
        head={['Processus / mode de défaillance', 'Effet', 'Cause', 'S', 'O', 'D', 'NPR', 'Action', 'NPR après', '']}
        rows={sorted.map((r) => {
          const after = r.s2 !== null && r.o2 !== null && r.d2 !== null ? r.s2 * r.o2 * r.d2 : null
          return [
            <div key="m" className="max-w-56">
              <div className="text-[11px] text-[var(--muted)]">{r.process}</div>
              <div className="font-medium">{r.failureMode}</div>
            </div>,
            <span key="e" className="text-xs">{r.effect}</span>,
            <span key="c" className="text-xs">{r.cause}</span>,
            r.s,
            r.o,
            r.d,
            <Badge key="r" tone={tone(rpn(r))}>{rpn(r)}</Badge>,
            <span key="a" className="text-xs">{r.action}</span>,
            after !== null ? <Badge key="a2" tone={tone(after)}>{after}</Badge> : '—',
            <Button key="b" size="sm" variant="ghost" onClick={() => setEdit(edit === r.id ? null : r.id)}>
              {edit === r.id ? 'Fermer' : 'Modifier'}
            </Button>,
          ]
        })}
      />
      <Button
        size="sm"
        onClick={() => {
          const id = uid('f')
          onChange([...rows, { id, process: '', failureMode: 'Nouveau mode de défaillance', effect: '', cause: '', currentControl: '', s: 5, o: 5, d: 5, action: '', owner: '', s2: null, o2: null, d2: null }])
          setEdit(id)
        }}
      >
        <Plus size={13} /> Ligne AMDEC
      </Button>
      {cur && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-brand-500/30 bg-brand-500/[.03] p-3 md:grid-cols-4">
          <Field label="Processus"><Input value={cur.process} onChange={(e) => up(cur.id, { process: e.target.value })} /></Field>
          <Field label="Mode de défaillance"><Input value={cur.failureMode} onChange={(e) => up(cur.id, { failureMode: e.target.value })} /></Field>
          <Field label="Effet"><Input value={cur.effect} onChange={(e) => up(cur.id, { effect: e.target.value })} /></Field>
          <Field label="Cause"><Input value={cur.cause} onChange={(e) => up(cur.id, { cause: e.target.value })} /></Field>
          <Field label="Contrôle actuel"><Input value={cur.currentControl} onChange={(e) => up(cur.id, { currentControl: e.target.value })} /></Field>
          <Field label="Gravité S (1-10)"><NumberInput value={cur.s} min={1} max={10} step={1} onChange={(v) => up(cur.id, { s: Math.round(v) })} /></Field>
          <Field label="Occurrence O (1-10)"><NumberInput value={cur.o} min={1} max={10} step={1} onChange={(v) => up(cur.id, { o: Math.round(v) })} /></Field>
          <Field label="Détection D (1-10)"><NumberInput value={cur.d} min={1} max={10} step={1} onChange={(v) => up(cur.id, { d: Math.round(v) })} /></Field>
          <Field label="Action recommandée" className="col-span-2"><TextArea rows={2} value={cur.action} onChange={(e) => up(cur.id, { action: e.target.value })} /></Field>
          <Field label="Responsable"><Input value={cur.owner} onChange={(e) => up(cur.id, { owner: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-1.5">
            <Field label="S'"><NumberInput value={cur.s2 ?? 0} min={0} max={10} step={1} onChange={(v) => up(cur.id, { s2: v ? Math.round(v) : null })} /></Field>
            <Field label="O'"><NumberInput value={cur.o2 ?? 0} min={0} max={10} step={1} onChange={(v) => up(cur.id, { o2: v ? Math.round(v) : null })} /></Field>
            <Field label="D'"><NumberInput value={cur.d2 ?? 0} min={0} max={10} step={1} onChange={(v) => up(cur.id, { d2: v ? Math.round(v) : null })} /></Field>
          </div>
          <div className="col-span-2 flex justify-end md:col-span-4">
            <Button size="sm" variant="danger" onClick={() => { onChange(rows.filter((r) => r.id !== cur.id)); setEdit(null) }}>
              <Trash2 size={13} /> Supprimer la ligne
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

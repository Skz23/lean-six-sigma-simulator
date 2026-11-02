import { useState } from 'react'
import clsx from 'clsx'
import { Lightbulb, Plus, Trash2 } from 'lucide-react'
import { useStore, uid } from '../../store/useStore'
import type { KaizenItem } from '../../store/types'
import { Badge, Button, Card, Field, Input, Kpi, NumberInput, PageHeader, Select, TextArea } from '../../components/ui'
import { fmt } from '../../lib/format'

const COLUMNS: KaizenItem['status'][] = ['idée', 'planifié', 'en cours', 'terminé']

export default function KaizenPage() {
  const items = useStore((s) => s.tools.kaizen)
  const setTools = useStore((s) => s.setTools)
  const [sel, setSel] = useState<string | null>(items[0]?.id ?? null)
  const [dragId, setDragId] = useState<string | null>(null)
  const item = items.find((x) => x.id === sel)
  const set = (id: string, fn: (k: KaizenItem) => void) =>
    setTools((t) => {
      const k = t.kaizen.find((x) => x.id === id)
      if (k) fn(k)
    })
  const add = () => {
    const id = uid('k')
    setTools((t) =>
      t.kaizen.push({ id, title: 'Nouvelle amélioration', area: '', problem: '', proposal: '', owner: '', status: 'idée', kpi: '', before: 0, after: null, unit: '', createdAt: new Date().toISOString().slice(0, 10) }),
    )
    setSel(id)
  }
  const done = items.filter((x) => x.status === 'terminé' && x.after !== null)
  const avgGain = done.length ? done.reduce((s, x) => s + (x.before !== 0 ? Math.abs((x.after! - x.before) / x.before) : 0), 0) / done.length : NaN

  return (
    <div>
      <PageHeader icon={<Lightbulb size={20} />} title="Kaizen — amélioration continue" subtitle="Identifier les problèmes, proposer, suivre les actions et mesurer les résultats" actions={<Button variant="primary" onClick={add}><Plus size={15} /> Nouveau Kaizen</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {COLUMNS.map((c) => (
          <Kpi key={c} label={c[0].toUpperCase() + c.slice(1)} value={items.filter((x) => x.status === c).length} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="grid gap-3 md:grid-cols-2 xl:col-span-7 xl:grid-cols-4">
          {COLUMNS.map((c) => (
            <div
              key={c}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) set(dragId, (k) => (k.status = c))
                setDragId(null)
              }}
              className="min-h-40 rounded-xl bg-black/[.03] p-2 dark:bg-white/[.04]"
            >
              <div className="mb-2 px-1 text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">{c}</div>
              <div className="space-y-2">
                {items
                  .filter((x) => x.status === c)
                  .map((k) => (
                    <div
                      key={k.id}
                      draggable
                      onDragStart={() => setDragId(k.id)}
                      onClick={() => setSel(k.id)}
                      className={clsx('cursor-pointer rounded-lg border bg-[var(--surface-1)] p-2.5 text-sm shadow-sm transition', sel === k.id ? 'border-brand-500' : 'border-black/[.06] dark:border-white/10')}
                    >
                      <div className="font-medium">{k.title}</div>
                      <div className="mt-1 text-[11px] text-[var(--muted)]">
                        {k.area} · {k.owner || 'non affecté'}
                      </div>
                      {k.after !== null && k.before !== 0 && <Badge tone="good" className="mt-1.5">{fmt(((k.after - k.before) / k.before) * 100, 0)} % {k.kpi}</Badge>}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <Card title="Fiche Kaizen" className="xl:col-span-5" actions={item && <Button size="sm" variant="danger" onClick={() => { setTools((t) => { t.kaizen = t.kaizen.filter((x) => x.id !== item.id) }); setSel(null) }}><Trash2 size={13} /> Supprimer</Button>}>
          {item ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Titre" className="col-span-2"><Input value={item.title} onChange={(e) => set(item.id, (k) => (k.title = e.target.value))} /></Field>
              <Field label="Zone"><Input value={item.area} onChange={(e) => set(item.id, (k) => (k.area = e.target.value))} /></Field>
              <Field label="Pilote"><Input value={item.owner} onChange={(e) => set(item.id, (k) => (k.owner = e.target.value))} /></Field>
              <Field label="Problème constaté" className="col-span-2"><TextArea value={item.problem} onChange={(e) => set(item.id, (k) => (k.problem = e.target.value))} /></Field>
              <Field label="Proposition d'amélioration" className="col-span-2"><TextArea value={item.proposal} onChange={(e) => set(item.id, (k) => (k.proposal = e.target.value))} /></Field>
              <Field label="Statut"><Select value={item.status} onChange={(e) => set(item.id, (k) => (k.status = e.target.value as KaizenItem['status']))}>{COLUMNS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Indicateur suivi"><Input value={item.kpi} onChange={(e) => set(item.id, (k) => (k.kpi = e.target.value))} /></Field>
              <Field label="Avant"><NumberInput value={item.before} onChange={(v) => set(item.id, (k) => (k.before = v))} suffix={item.unit} /></Field>
              <Field label="Après (mesuré)"><NumberInput value={item.after ?? 0} onChange={(v) => set(item.id, (k) => (k.after = v))} suffix={item.unit} /></Field>
              <Field label="Unité"><Input value={item.unit} onChange={(e) => set(item.id, (k) => (k.unit = e.target.value))} /></Field>
              <div className="flex items-end">
                {item.after !== null && item.before !== 0 ? <Badge tone="good">Résultat : {fmt(((item.after - item.before) / item.before) * 100, 1)} %</Badge> : <span className="text-xs text-[var(--muted)]">Résultat non mesuré</span>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Sélectionnez une carte. Glissez-déposez les cartes entre colonnes pour suivre l'avancement.</p>
          )}
          {Number.isFinite(avgGain) && <p className="mt-3 text-xs text-[var(--muted)]">Amélioration moyenne mesurée des Kaizen terminés : {fmt(avgGain * 100, 0)} %.</p>}
        </Card>
      </div>
    </div>
  )
}

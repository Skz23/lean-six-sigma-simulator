import { useMemo, useState } from 'react'
import { Wrench } from 'lucide-react'
import { Input, PageHeader, Select, Tabs } from '../components/ui'
import { ToolCard } from '../components/PhaseNav'
import { PHASES, TOOLS, type Family } from '../workflow/phases'

const FAMILIES: Family[] = ['Projet', 'Lean', 'Six Sigma', 'Qualité', 'Statistiques', 'Simulation']
type View = 'phase' | 'family' | 'az'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function ToolboxPage() {
  const [q, setQ] = useState('')
  const [fam, setFam] = useState<Family | ''>('')
  const [view, setView] = useState<View>('phase')
  const list = useMemo(
    () => TOOLS.filter((t) => (!fam || t.family === fam) && (!q || norm(t.name + ' ' + t.desc).includes(norm(q)))),
    [q, fam],
  )
  const groups: { title: string; items: typeof TOOLS }[] =
    view === 'phase'
      ? PHASES.map((p) => ({ title: `${p.n} · ${p.label} — ${p.marp}`, items: list.filter((t) => t.phases[0] === p.id) }))
      : view === 'family'
        ? FAMILIES.map((f) => ({ title: f, items: list.filter((t) => t.family === f) }))
        : [{ title: '', items: [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr')) }]

  return (
    <div>
      <PageHeader icon={<Wrench size={20} />} title="Boîte à outils" subtitle={`Les ${TOOLS.length} outils de l'appli, avec la phase DMAIC où ils servent`} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input placeholder="Rechercher un outil (ex. Pareto, capabilité, SMED)…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-80" />
        <Select value={fam} onChange={(e) => setFam(e.target.value as Family | '')} className="w-full sm:w-48">
          <option value="">Toutes les familles</option>
          {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </Select>
      </div>
      <Tabs<View> value={view} onChange={setView} tabs={[{ id: 'phase', label: 'Par phase' }, { id: 'family', label: 'Par famille' }, { id: 'az', label: 'De A à Z' }]} />
      {list.length === 0 && <p className="py-10 text-center text-sm text-[var(--muted)]">Aucun outil ne correspond.</p>}
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.title} className="mb-6">
            {g.title && <h2 className="mb-2 text-sm font-semibold">{g.title}</h2>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((t) => <ToolCard key={t.id} t={t} phase={view === 'phase' ? t.phases[0] : undefined} />)}
            </div>
          </section>
        ))}
    </div>
  )
}

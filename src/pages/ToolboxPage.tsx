import { useMemo, useState } from 'react'
import { Wrench } from 'lucide-react'
import { Input, PageHeader, Select, Tabs } from '../components/ui'
import { ToolCard } from '../components/PhaseNav'
import { PHASES, TOOLS, toolById, type Family, type Tool } from '../workflow/phases'

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
  const ok = new Set(list.map((t) => t.id))
  type Item = { t: Tool; role?: string; phase?: string }
  const groups: { title: string; sub?: string; items: Item[] }[] =
    view === 'phase'
      ? PHASES.flatMap((p) =>
          p.steps.map((st, i) => ({
            title: i === 0 && p.steps.some((y) => y.tools.some((x) => ok.has(x.id))) ? `${p.n} · ${p.label} — ${p.marp}` : '',
            sub: `${st.n} ${st.title}`,
            items: st.tools.filter((x) => ok.has(x.id)).map((x) => ({ t: toolById(x.id)!, role: x.role, phase: p.id })),
          })),
        )
      : view === 'family'
        ? FAMILIES.map((f) => ({ title: f, items: list.filter((t) => t.family === f).map((t) => ({ t })) }))
        : [{ title: '', items: [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((t) => ({ t })) }]

  return (
    <div>
      <PageHeader icon={<Wrench size={20} />} title="Boîte à outils" subtitle={`Les ${TOOLS.length} outils de l'appli, rangés selon la démarche DMAIC`} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input placeholder="Rechercher un outil (ex. Pareto, capabilité, SMED)…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-80" />
        <Select value={fam} onChange={(e) => setFam(e.target.value as Family | '')} className="w-full sm:w-48">
          <option value="">Toutes les familles</option>
          {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </Select>
      </div>
      <Tabs<View> value={view} onChange={setView} tabs={[{ id: 'phase', label: 'Par phase' }, { id: 'family', label: 'Par famille' }, { id: 'az', label: 'De A à Z' }]} />
      {list.length === 0 && <p className="py-10 text-center text-sm text-[var(--muted)]">Aucun outil ne correspond.</p>}
      {groups.map((g, gi) => (
        <section key={gi} className={g.items.length ? 'mb-5' : ''}>
          {g.title && <h2 className="mt-2 mb-2 text-base font-semibold">{g.title}</h2>}
          {g.items.length > 0 && (
            <>
              {g.sub && <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">{g.sub}</h3>}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((x) => <ToolCard key={x.t.id} t={x.t} role={x.role} phase={x.phase} />)}
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  )
}

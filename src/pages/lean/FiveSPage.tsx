import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Tooltip } from 'recharts'
import clsx from 'clsx'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { useActiveScenario, useStore, uid } from '../../store/useStore'
import { FIVE_S, fiveSScores } from '../../lean/tools'
import type { FiveSAudit } from '../../store/types'
import { Badge, Button, Card, Field, Input, Kpi, PageHeader, Select } from '../../components/ui'
import { ChartBox, S, tooltipStyle } from '../../components/charts'
import { fmt } from '../../lib/format'

const LEVELS = ['0 — inexistant', '1 — initié', '2 — partiel', '3 — en place', '4 — exemplaire']

export default function FiveSPage() {
  const sc = useActiveScenario()
  const audit = useStore((s) => s.tools.fiveS[sc.id])
  const setTools = useStore((s) => s.setTools)
  const a: FiveSAudit = audit ?? { scores: {}, actions: [], date: new Date().toISOString().slice(0, 10), area: 'Atelier' }
  const set = (fn: (x: FiveSAudit) => void) =>
    setTools((t) => {
      const x = t.fiveS[sc.id] ?? { scores: {}, actions: [], date: new Date().toISOString().slice(0, 10), area: 'Atelier' }
      fn(x)
      t.fiveS[sc.id] = x
    })
  const r = fiveSScores(a.scores)

  return (
    <div>
      <PageHeader icon={<Sparkles size={20} />} title="Audit 5S" subtitle={`Évaluation des cinq dimensions — scénario « ${sc.name} »`} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Score global" value={fmt(r.global, 0)} unit="%" tone={r.global < 40 ? 'critical' : r.global < 60 ? 'warning' : 'good'} />
        <Kpi label="Niveau" value={r.level} />
        <Kpi label="Point le plus faible" value={r.weakest[0].name.split(' — ')[1]} hint={`${fmt(r.weakest[0].score, 0)} %`} />
        <Kpi label="Actions ouvertes" value={a.actions.filter((x) => x.status !== 'fait').length} />
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Grille d'audit" className="xl:col-span-7" actions={
          <div className="flex gap-2">
            <Input value={a.area} onChange={(e) => set((x) => (x.area = e.target.value))} className="w-48" aria-label="Zone" />
            <Input type="date" value={a.date} onChange={(e) => set((x) => (x.date = e.target.value))} className="w-36" aria-label="Date" />
          </div>
        }>
          <div className="space-y-4">
            {FIVE_S.map((d) => {
              const dim = r.dims.find((x) => x.key === d.key)!
              return (
                <div key={d.key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{d.name}</h4>
                    <Badge tone={dim.score < 40 ? 'critical' : dim.score < 60 ? 'warning' : 'good'}>{fmt(dim.score, 0)} %</Badge>
                  </div>
                  <div className="space-y-1">
                    {d.questions.map((q, i) => {
                      const v = a.scores[d.key]?.[i] ?? 0
                      return (
                        <div key={q} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-[var(--text-secondary)]">{q}</span>
                          <div className="flex gap-1">
                            {[0, 1, 2, 3, 4].map((n) => (
                              <button
                                key={n}
                                title={LEVELS[n]}
                                onClick={() =>
                                  set((x) => {
                                    const arr = x.scores[d.key] ?? [0, 0, 0, 0]
                                    arr[i] = n
                                    x.scores[d.key] = arr
                                  })
                                }
                                className={clsx('h-7 w-7 rounded-md text-xs font-semibold transition-colors', v === n ? 'bg-brand-600 text-white' : 'bg-black/5 text-[var(--text-secondary)] hover:bg-black/10 dark:bg-white/10')}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
        <div className="space-y-4 xl:col-span-5">
          <Card title="Radar 5S">
            <ChartBox height={280}>
              <RadarChart data={r.dims.map((d) => ({ s: d.name.split(' — ')[1], score: d.score }))} outerRadius="72%">
                <PolarGrid stroke="var(--grid)" />
                <PolarAngleAxis dataKey="s" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: 'var(--muted)', fontSize: 9 }} angle={90} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${fmt(Number(v), 0)} %`, 'Score']} />
                <Radar dataKey="score" stroke={S(0)} fill={S(0)} fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} />
              </RadarChart>
            </ChartBox>
            <p className="text-xs text-[var(--muted)]">Points faibles : {r.weakest.map((w) => `${w.name} (${fmt(w.score, 0)} %)`).join(', ')}.</p>
          </Card>
          <Card title="Plan d'action" actions={<Button size="sm" onClick={() => set((x) => x.actions.push({ id: uid('a'), what: 'Nouvelle action', who: '', when: new Date().toISOString().slice(0, 10), status: 'à faire' }))}><Plus size={13} /> Action</Button>}>
            <div className="space-y-2">
              {a.actions.map((act, i) => (
                <div key={act.id} className="grid grid-cols-[1fr_32px] gap-2 rounded-lg border border-black/[.06] p-2 dark:border-white/10">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Action" className="sm:col-span-2">
                      <Input value={act.what} onChange={(e) => set((x) => (x.actions[i].what = e.target.value))} />
                    </Field>
                    <Field label="Responsable">
                      <Input value={act.who} onChange={(e) => set((x) => (x.actions[i].who = e.target.value))} />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Échéance">
                        <Input type="date" value={act.when} onChange={(e) => set((x) => (x.actions[i].when = e.target.value))} />
                      </Field>
                      <Field label="Statut">
                        <Select value={act.status} onChange={(e) => set((x) => (x.actions[i].status = e.target.value as 'à faire'))}>
                          <option>à faire</option>
                          <option>en cours</option>
                          <option>fait</option>
                        </Select>
                      </Field>
                    </div>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => set((x) => x.actions.splice(i, 1))} aria-label="Supprimer">
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
              {!a.actions.length && <p className="text-sm text-[var(--muted)]">Aucune action.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

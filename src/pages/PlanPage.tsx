import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Play, Plus, Sparkles } from 'lucide-react'
import { useActiveScenario, useStore, uid } from '../store/useStore'
import { runScenario } from '../store/useSimulation'
import { applyAll, candidates, evaluate, runDays, summarize, type Evaluated, type Summary } from '../engine/recommend'
import { diagnoseDefects, diagnoseFmea, diagnoseMeasures, type Finding } from '../engine/realDiagnostics'
import { Badge, Button, Card, Empty, Kpi, Note, NumberInput, PageHeader, Select } from '../components/ui'
import { duration, eur, fmt, fmtFixed, pct } from '../lib/format'

const VERDICT_TONE = { recommandée: 'good', 'à étudier': 'warning', 'sans effet': 'neutral', défavorable: 'critical' } as const

export default function PlanPage() {
  const sc = useActiveScenario()
  const addScenario = useStore((s) => s.addScenario)
  const datasets = useStore((s) => s.datasets)
  const fmea = useStore((s) => s.tools.fmea)
  const [days, setDays] = useState(3)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [base, setBase] = useState<Summary | null>(null)
  const [items, setItems] = useState<Evaluated[]>([])
  const [invest, setInvest] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [combined, setCombined] = useState<Summary | null>(null)
  const [done, setDone] = useState('')
  const analyzedFor = useRef<string>('')

  const findings: Finding[] = useMemo(
    () => [
      ...datasets.filter((d) => d.kind === 'measures').flatMap(diagnoseMeasures),
      ...datasets.filter((d) => d.kind === 'defects').flatMap(diagnoseDefects),
      ...diagnoseFmea(fmea),
    ],
    [datasets, fmea],
  )

  const analyze = async () => {
    setBusy(true)
    setCombined(null)
    setDone('')
    setProgress(0)
    await new Promise((r) => setTimeout(r, 30))
    const run = runScenario(sc)
    const cands = candidates(sc, run.kpis, run.results.bottleneckIndex)
    const b = summarize(runDays(sc, days))
    setBase(b)
    const out: Evaluated[] = []
    for (let i = 0; i < cands.length; i++) {
      out.push(evaluate(sc, cands[i], b, days))
      setProgress((i + 1) / cands.length)
      await new Promise((r) => setTimeout(r, 0))
    }
    out.sort((x, y) => y.annualGain - x.annualGain)
    setItems(out)
    setInvest(Object.fromEntries(out.map((x) => [x.id, x.investment])))
    setSelected(out.filter((x) => x.verdict === 'recommandée').map((x) => x.id))
    analyzedFor.current = JSON.stringify(sc)
    setBusy(false)
  }
  const stale = items.length > 0 && analyzedFor.current !== JSON.stringify(sc)

  const simulatePlan = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 30))
    const plan = applyAll(sc, items.filter((x) => selected.includes(x.id)))
    setCombined(summarize(runDays(plan, days)))
    setBusy(false)
  }
  const createScenario = (list: Evaluated[], name: string) => {
    const s = applyAll(sc, list)
    s.id = uid('sc')
    s.name = name
    s.kind = 'custom'
    s.createdAt = s.updatedAt = new Date().toISOString()
    s.description = `Créé par le Plan d'amélioration à partir de « ${sc.name} » : ${list.map((x) => x.title).join(' ; ')}.`
    s.actions = [...s.actions, ...list.map((x) => ({ id: uid('a'), label: x.title, approach: x.approach, investment: invest[x.id] ?? x.investment }))]
    addScenario(s)
    setDone(`Scénario « ${name} » créé et activé. Comparez-le dans Lean Six Sigma ou Gestion des scénarios.`)
  }

  const sel = items.filter((x) => selected.includes(x.id))
  const totalInvest = sel.reduce((a, x) => a + (invest[x.id] ?? x.investment), 0)
  const planGain = combined && base ? (combined.margin - base.margin) * sc.costs.workingDaysPerYear : NaN

  return (
    <div>
      <PageHeader
        icon={<Sparkles size={20} />}
        title="Plan d'amélioration"
        subtitle={`Propositions générées et chiffrées par simulation à partir du scénario actif « ${sc.name} » et de vos données`}
        actions={
          <>
            <Select value={days} onChange={(e) => setDays(+e.target.value)} className="w-44" title="Nombre de journées simulées par action">
              {[2, 3, 5, 8].map((d) => <option key={d} value={d}>{d} journées / action</option>)}
            </Select>
            <Button variant="primary" onClick={analyze} disabled={busy}>
              <Play size={15} /> {items.length ? 'Relancer l\'analyse' : 'Analyser et proposer'}
            </Button>
          </>
        }
      />

      {busy && (
        <div className="mb-4">
          <div className="h-2 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/10">
            <div className="h-2 bg-brand-500 transition-all" style={{ width: `${Math.max(5, progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">Simulation des actions en cours…</p>
        </div>
      )}
      {stale && <div className="mb-4"><Note tone="warning">Le scénario a changé depuis la dernière analyse : relancez-la pour mettre les chiffres à jour.</Note></div>}
      {done && <div className="mb-4"><Note tone="tip">{done}</Note></div>}

      {findings.length > 0 && (
        <Card title="Diagnostic de vos données réelles" subtitle="Constats calculés directement sur vos mesures, défauts et AMDEC (sans simulation)" className="mb-4">
          <div className="space-y-2">
            {findings.map((fd, i) => (
              <div key={i} className={clsx('rounded-lg border p-3', fd.severity === 'critique' ? 'border-[var(--critical)]/40' : fd.severity === 'important' ? 'border-amber-500/40' : 'border-black/[.08] dark:border-white/10')}>
                <div className="flex flex-wrap items-center gap-2">
                  {fd.severity === 'critique' ? <AlertTriangle size={15} className="text-[var(--critical)]" /> : fd.severity === 'important' ? <AlertTriangle size={15} className="text-amber-500" /> : <Info size={15} className="text-[var(--muted)]" />}
                  <span className="font-semibold">{fd.title}</span>
                  <Badge tone={fd.severity === 'critique' ? 'critical' : fd.severity === 'important' ? 'warning' : 'neutral'}>{fd.severity}</Badge>
                  <Link to={fd.link} className="ml-auto text-xs text-brand-600 underline">{fd.tool} →</Link>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{fd.detail}</p>
                <p className="mt-1 text-sm"><Lightbulb size={13} className="mr-1 inline text-brand-600" />{fd.action}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      {!findings.length && (
        <div className="mb-4">
          <Note>Importez vos mesures et vos défauts dans <Link className="underline" to="/data">Mes données</Link> pour obtenir aussi un diagnostic de vos données réelles.</Note>
        </div>
      )}

      {!items.length && !busy && (
        <Card title="Actions sur la ligne">
          <Empty>
            Cliquez sur « Analyser et proposer » : l'outil détecte les leviers pertinents (goulot, changements de série, pannes, flux, qualité…), simule chaque action sur {days} journées avec les mêmes aléas que la situation actuelle, et les classe par gain.
          </Empty>
        </Card>
      )}

      {base && items.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
            <Kpi label="Situation actuelle — marge" value={eur(base.margin)} unit="/ j" />
            <Kpi label="Pièces bonnes" value={fmt(base.good, 0)} unit="/ j" />
            <Kpi label="Lead Time" value={duration(base.leadTime)} />
            <Kpi label="Taux de défauts" value={pct(base.scrapRate, 2)} />
            <Kpi label="TRS" value={pct(base.oee, 1)} />
            <Kpi label="Actions recommandées" value={items.filter((x) => x.verdict === 'recommandée').length} unit={`/ ${items.length}`} tone="good" />
          </div>
          <Card title="Actions proposées, classées par gain annuel" subtitle={`Gains = différence simulée sur ${days} journées (mêmes aléas). Ajustez l'investissement selon vos devis.`} className="mb-4">
            <div className="space-y-2.5">
              {items.map((x, rank) => (
                <div key={x.id} className={clsx('rounded-xl border p-3', selected.includes(x.id) ? 'border-brand-500/60 bg-brand-500/[.03]' : 'border-black/[.08] dark:border-white/10')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand-600)]" checked={selected.includes(x.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, x.id] : selected.filter((y) => y !== x.id))} aria-label="Inclure dans le plan" />
                    <span className="text-xs font-semibold text-[var(--muted)]">#{rank + 1}</span>
                    <span className="font-semibold">{x.title}</span>
                    <Badge tone={x.approach === 'lean' ? 'info' : 'warning'}>{x.approach === 'lean' ? 'Lean' : 'Six Sigma'} · {x.tool}</Badge>
                    <Badge tone={VERDICT_TONE[x.verdict]}>{x.verdict}</Badge>
                    <span className="ml-auto text-sm font-semibold tabular">{x.annualGain >= 0 ? '+' : ''}{eur(x.annualGain)} / an</span>
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">Constat :</b> {x.rationale}</p>
                  <p className="text-sm text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">Simulé :</b> {x.change}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                    <Effect label="Pièces bonnes / j" v={x.dGood} d={1} up />
                    <Effect label="Lead Time" v={x.dLeadTime / 60} d={1} unit="min" />
                    <Effect label="Défauts" v={x.dScrapRate * 100} d={2} unit="pts" />
                    <Effect label="Encours" v={x.dWip} d={0} unit="pcs" />
                    <Effect label="TRS" v={x.dOee * 100} d={1} unit="pts" up />
                    <span className="flex items-center gap-1.5">
                      Investissement
                      <NumberInput value={invest[x.id] ?? x.investment} min={0} step={500} suffix="€" onChange={(v) => setInvest({ ...invest, [x.id]: v })} className="w-32" />
                    </span>
                    <span>Retour : <b>{x.annualGain > 0 ? `${fmt(((invest[x.id] ?? x.investment) / x.annualGain) * 12, 1)} mois` : '—'}</b></span>
                    <Button size="sm" className="ml-auto" onClick={() => createScenario([x], `${sc.name} + ${x.tool}`)}><Plus size={12} /> Créer le scénario</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Plan combiné" subtitle="Les actions cochées sont appliquées ensemble : leurs effets ne s'additionnent pas toujours (le goulot peut se déplacer)">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">{sel.length} action(s) · investissement {eur(totalInvest)}</span>
              <Button onClick={simulatePlan} disabled={!sel.length || busy}><Play size={14} /> Simuler le plan</Button>
              <Button variant="primary" onClick={() => createScenario(sel, `${sc.name} — plan d'amélioration`)} disabled={!sel.length}><CheckCircle2 size={14} /> Créer le scénario du plan</Button>
            </div>
            {combined && (
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6">
                <Kpi label="Gain annuel du plan" value={eur(planGain)} tone={planGain > 0 ? 'good' : 'critical'} />
                <Kpi label="Retour sur investissement" value={planGain > 0 ? fmt((totalInvest / planGain) * 12, 1) : '—'} unit="mois" />
                <Kpi label="Pièces bonnes / j" value={fmt(combined.good, 0)} before={base.good} after={combined.good} higherIsBetter />
                <Kpi label="Lead Time" value={duration(combined.leadTime)} before={base.leadTime} after={combined.leadTime} higherIsBetter={false} />
                <Kpi label="Taux de défauts" value={pct(combined.scrapRate, 2)} before={base.scrapRate} after={combined.scrapRate} higherIsBetter={false} />
                <Kpi label="Cpk" value={fmtFixed(combined.cpk, 2)} before={base.cpk} after={combined.cpk} higherIsBetter />
              </div>
            )}
          </Card>
          <div className="mt-4">
            <Note title="Comment lire ces propositions">
              Chaque action est une hypothèse d'amélioration réaliste (ex. −50 % de changement de série pour un premier chantier SMED) appliquée à votre scénario, puis simulée. Les gains dépendent de la qualité des paramètres saisis (temps de cycle, disponibilités, coûts) : vérifiez-les dans « Ligne de production » et « Mes données ». Une action « sans effet » n'agit pas sur la contrainte actuelle de la ligne : c'est une information utile pour éviter d'investir au mauvais endroit.
            </Note>
          </div>
        </>
      )}
    </div>
  )
}

function Effect({ label, v, d, unit, up }: { label: string; v: number; d: number; unit?: string; up?: boolean }) {
  if (!Number.isFinite(v)) return null
  const eps = Math.pow(10, -d) / 2
  const good = up ? v > eps : v < -eps
  const bad = up ? v < -eps : v > eps
  return (
    <span className={clsx('tabular', good && 'text-[var(--good-text)]', bad && 'text-[var(--critical)]', !good && !bad && 'text-[var(--muted)]')}>
      {label} : <b>{v > 0 ? '+' : ''}{fmt(v, d)}{unit ? ` ${unit}` : ''}</b>
    </span>
  )
}

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { FlaskConical } from 'lucide-react'
import type { ParamKey, Scenario } from '../engine/types'
import { samplePart, setpointsOf, type Setpoints } from '../engine/processModel'
import { analyzeFactorial, fullFactorial, type DoeFactor } from '../stats/doe'
import { mean, stdDev } from '../stats/descriptive'
import { useStore } from '../store/useStore'
import { Badge, Button, Card, Field, Input, Note, NumberInput, Select, Table } from './ui'
import clsx from 'clsx'
import { Rng } from '../engine/random'
import { applyFit, fitFromDoe } from '../engine/fitProcess'
import type { DoeTrials } from '../store/types'
import { ChartBox, S, axisProps, tooltipStyle } from './charts'
import { fmt, fmtFixed } from '../lib/format'

/**
 * Plan d'expériences 2^k réalisé sur le modèle procédé : chaque essai produit
 * réellement `partsPerRun` pièces avec le modèle stochastique (pas de valeurs inventées).
 */
export function DoeTool({ sc }: { sc: Scenario }) {
  const update = useStore((s) => s.updateScenario)
  const setTools = useStore((s) => s.setTools)
  const saved = useStore((s) => s.tools.doe?.[sc.id])
  const m = sc.process
  const [mode, setMode] = useState<'sim' | 'real'>(saved ? 'real' : 'sim')
  const [levels, setLevelsState] = useState<Record<ParamKey, [number, number]>>(
    saved?.levels ?? {
      temperature: [30, 45],
      pressure: [50, 70],
      speed: [1000, 1400],
    },
  )
  const [replicates, setReplicatesState] = useState(saved?.replicates ?? 2)
  const [partsPerRun, setPartsPerRun] = useState(10)
  const [response, setResponse] = useState<'mean' | 'sd'>('mean')
  const [seed, setSeed] = useState(1)
  const factors: DoeFactor[] = m.params.map((p) => ({ name: p.name, low: levels[p.key][0], high: levels[p.key][1], unit: p.unit }))
  const runs = useMemo(() => fullFactorial(factors, replicates), [JSON.stringify(factors), replicates]) // eslint-disable-line react-hooks/exhaustive-deps
  // Ordre de réalisation tiré au hasard (randomisation) : protège contre les dérives pendant les essais
  const execOrder = useMemo(() => {
    const r = new Rng(97 + runs.length)
    const idx = runs.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    const rank = new Array<number>(idx.length)
    idx.forEach((runIdx, k) => (rank[runIdx] = k + 1))
    return rank
  }, [runs.length])

  const trials: DoeTrials = saved && saved.y.length === runs.length && JSON.stringify(saved.levels) === JSON.stringify(levels)
    ? saved
    : { levels, replicates, y: runs.map(() => null), responseName: saved?.responseName ?? m.characteristic.name, goal: saved?.goal ?? 'target', target: saved?.target ?? m.characteristic.nominal, isCtq: saved?.isCtq ?? true }
  const saveTrials = (patch: Partial<DoeTrials>) =>
    setTools((t) => {
      const d = (t.doe ??= {})
      d[sc.id] = { ...trials, levels, replicates, ...patch }
    })
  const setLevels = (l: Record<ParamKey, [number, number]>) => {
    setLevelsState(l)
    if (mode === 'real') setTools((t) => { const d = (t.doe ??= {}); d[sc.id] = { ...trials, levels: l, y: fullFactorial(m.params.map((p) => ({ name: p.name, low: l[p.key][0], high: l[p.key][1] })), replicates).map(() => null) } })
  }
  const setReplicates = (n: number) => {
    setReplicatesState(n)
    if (mode === 'real') setTools((t) => { const d = (t.doe ??= {}); d[sc.id] = { ...trials, replicates: n, y: Array.from({ length: 2 ** m.params.length * n }, () => null) } })
  }
  const filled = trials.y.filter((v) => v !== null && Number.isFinite(v)).length
  const complete = mode === 'sim' || filled === runs.length

  const data = useMemo(() => {
    if (mode === 'real') return runs.map((r, i) => ({ run: r, mean: trials.y[i] ?? NaN, sd: NaN }))
    // ordre d'exécution aléatoire (randomisation) — la graine change l'ordre et les aléas
    return runs.map((r, i) => {
      const sp = { ...setpointsOf(m) } as Setpoints
      m.params.forEach((p, j) => (sp[p.key] = r.actual[j]))
      const parts = samplePart(m, sp, partsPerRun, partsPerRun, seed * 1000 + i + 1)
      const ys = parts.map((x) => x.y)
      return { run: r, mean: mean(ys), sd: stdDev(ys) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, runs, JSON.stringify(trials.y), partsPerRun, seed, JSON.stringify(m)])

  const y = data.map((d) => (mode === 'real' || response === 'mean' ? d.mean : d.sd))
  const target = mode === 'real' ? trials.target : m.characteristic.nominal
  const goal = mode === 'real' ? trials.goal : response === 'mean' ? 'target' : 'min'
  const an = analyzeFactorial(
    data.map((d) => d.run),
    complete ? y : y.map(() => 0),
    factors.map((f) => f.name.split(' ')[0]),
    goal,
    target,
  )
  const best = an.bestSetting.coded.map((c, j) => (c < 0 ? factors[j].low : factors[j].high))
  const digits = 4

  // Graphe des effets principaux
  const mainPlot = factors.map((f, j) => {
    const lo = y.filter((_, i) => data[i].run.coded[j] < 0)
    const hi = y.filter((_, i) => data[i].run.coded[j] > 0)
    return { name: f.name.split(' ')[0], lo: mean(lo), hi: mean(hi) }
  })
  // Interaction température × vitesse
  const inter = [-1, 1].map((v) => {
    const row: Record<string, number | string> = { V: v < 0 ? `V = ${factors[2].low}` : `V = ${factors[2].high}` }
    for (const t of [-1, 1]) {
      const vals = y.filter((_, i) => data[i].run.coded[2] === v && data[i].run.coded[0] === t)
      row[t < 0 ? 'Tbas' : 'Thaut'] = mean(vals)
    }
    return row
  })

  return (
    <div className="space-y-4">
      <Card bodyClass="flex flex-wrap items-center gap-3 p-3">
        <span className="text-sm font-medium">Résultats des essais :</span>
        <div className="flex gap-1 rounded-lg border border-black/[.08] p-1 dark:border-white/10">
          {([['real', 'Mes essais en atelier'], ['sim', 'Simulés (démonstration)']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={clsx('rounded-md px-3 py-1.5 text-sm font-medium', mode === k ? 'bg-brand-600 text-white' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10')}>{l}</button>
          ))}
        </div>
        <span className="text-xs text-[var(--muted)]">
          {mode === 'real' ? 'Réalisez les essais dans l\'ordre indiqué, saisissez la réponse mesurée : l\'appli calcule effets, interactions et meilleur réglage.' : 'Les réponses sont produites par le modèle du procédé (hypothèses de l\'exemple) : pour apprendre la méthode, pas pour décider.'}
        </span>
      </Card>
      <Card title="Définition du plan factoriel complet 2³" subtitle="3 facteurs × 2 niveaux, essais répétés et randomisés">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {m.params.map((p) => (
            <div key={p.key} className="col-span-1 grid grid-cols-2 gap-2 md:col-span-1 xl:col-span-2">
              <Field label={`${p.name} — bas`}>
                <NumberInput value={levels[p.key][0]} min={p.min} max={p.max} step={1} suffix={p.unit} onChange={(v) => setLevels({ ...levels, [p.key]: [v, levels[p.key][1]] })} />
              </Field>
              <Field label="haut">
                <NumberInput value={levels[p.key][1]} min={p.min} max={p.max} step={1} suffix={p.unit} onChange={(v) => setLevels({ ...levels, [p.key]: [levels[p.key][0], v] })} />
              </Field>
            </div>
          ))}
          <Field label="Répétitions">
            <Select value={replicates} onChange={(e) => setReplicates(+e.target.value)}>
              {[1, 2, 3, 4].map((k) => <option key={k}>{k}</option>)}
            </Select>
          </Field>
          {mode === 'sim' && <Field label="Pièces par essai">
            <Select value={partsPerRun} onChange={(e) => setPartsPerRun(+e.target.value)}>
              {[5, 10, 20, 30].map((k) => <option key={k}>{k}</option>)}
            </Select>
          </Field>}
          {mode === 'sim' ? (
            <>
              <Field label="Réponse étudiée">
                <Select value={response} onChange={(e) => setResponse(e.target.value as 'mean' | 'sd')}>
                  <option value="mean">Moyenne du diamètre (cible {m.characteristic.nominal})</option>
                  <option value="sd">Écart-type du diamètre (minimiser)</option>
                </Select>
              </Field>
              <div className="flex items-end">
                <Button onClick={() => setSeed(seed + 1)}>
                  <FlaskConical size={14} /> Refaire les essais
                </Button>
              </div>
            </>
          ) : (
            <>
              <Field label="Réponse mesurée">
                <Input value={trials.responseName} onChange={(e) => saveTrials({ responseName: e.target.value })} />
              </Field>
              <Field label="Objectif">
                <Select value={trials.goal} onChange={(e) => saveTrials({ goal: e.target.value as DoeTrials['goal'] })}>
                  <option value="target">Viser une cible</option>
                  <option value="min">Minimiser</option>
                  <option value="max">Maximiser</option>
                </Select>
              </Field>
              {trials.goal === 'target' && (
                <Field label="Cible">
                  <NumberInput value={trials.target} step={0.001} onChange={(v) => saveTrials({ target: v })} />
                </Field>
              )}
            </>
          )}
        </div>
      </Card>
      {mode === 'real' && (
        <Card title={`Essais à réaliser — ${filled} / ${runs.length} saisis`} subtitle="Suivez l'ordre de réalisation (tiré au hasard). Saisissez pour chaque essai la réponse mesurée (ex. moyenne de 5 pièces), ou collez une colonne depuis Excel dans l'ordre des essais.">
          <div className="max-h-96 overflow-y-auto">
            <Table
              dense
              head={['Essai', 'Ordre de réalisation', ...factors.map((f) => f.name.split(' ')[0]), trials.responseName || 'Réponse']}
              rows={runs.map((r, i) => [
                r.order,
                <b key="o">{execOrder[i]}</b>,
                ...r.actual.map((v, j) => `${v} ${factors[j].unit}`),
                <input
                  key={`y-${i}-${trials.y[i] ?? ''}`}
                  className="h-7 w-28 rounded-md border border-black/10 bg-transparent px-2 text-sm dark:border-white/15"
                  inputMode="decimal"
                  defaultValue={trials.y[i] === null || trials.y[i] === undefined ? '' : String(trials.y[i]).replace('.', ',')}
                  onBlur={(e) => {
                    const v = e.target.value.trim().replace(',', '.')
                    const nv = v === '' || !Number.isFinite(+v) ? null : +v
                    if (nv === trials.y[i]) return
                    const y2 = [...trials.y]
                    y2[i] = nv
                    saveTrials({ y: y2 })
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  onPaste={(e) => {
                    const lines = e.clipboardData.getData('text').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
                    if (lines.length < 2) return
                    e.preventDefault()
                    const y2 = [...trials.y]
                    lines.forEach((l, k) => {
                      const v = +l.replace(',', '.')
                      if (i + k < y2.length && Number.isFinite(v)) y2[i + k] = v
                    })
                    saveTrials({ y: y2 })
                  }}
                />,
              ])}
            />
          </div>
        </Card>
      )}
      {!complete ? (
        <Note>L'analyse s'affichera quand les {runs.length} essais seront saisis.</Note>
      ) : (
      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Effets estimés" subtitle="Effet = moyenne(+) − moyenne(−) · en couleur : significatif (p < 0,05)" className="xl:col-span-6">
          <ChartBox height={260}>
            <BarChart data={[...an.effects].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).map((e) => ({ ...e, abs: Math.abs(e.effect) }))} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => fmt(v, 4)} />
              <YAxis type="category" dataKey="term" width={150} {...axisProps} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(_v, _n, p) => [`${fmtFixed((p.payload as { effect: number }).effect, 5)} (p = ${(p.payload as { pValue?: number }).pValue?.toFixed(4) ?? '—'})`, '|Effet|']} />
              <Bar dataKey="abs" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {[...an.effects].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).map((e) => (
                  <Cell key={e.term} fill={e.significant ? S(0) : 'var(--axis)'} />
                ))}
              </Bar>
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Effets principaux" subtitle="Réponse moyenne aux niveaux bas et haut" className="xl:col-span-3">
          <ChartBox height={260}>
            <LineChart data={[{ n: 'bas', ...Object.fromEntries(mainPlot.map((x) => [x.name, x.lo])) }, { n: 'haut', ...Object.fromEntries(mainPlot.map((x) => [x.name, x.hi])) }]} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="n" {...axisProps} />
              <YAxis {...axisProps} domain={['auto', 'auto']} tickFormatter={(v) => fmt(v, digits)} width={60} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [fmtFixed(Number(v), 5), n]} />
              <Legend verticalAlign="top" height={22} iconSize={10} />
              {mainPlot.map((x, i) => (
                <Line key={x.name} dataKey={x.name} stroke={S(i)} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ChartBox>
        </Card>
        <Card title="Interaction T × V" subtitle="Droites non parallèles = interaction" className="xl:col-span-3">
          <ChartBox height={260}>
            <LineChart data={inter} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="V" {...axisProps} />
              <YAxis {...axisProps} domain={['auto', 'auto']} tickFormatter={(v) => fmt(v, digits)} width={60} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [fmtFixed(Number(v), 5), n]} />
              <Legend verticalAlign="top" height={22} iconSize={10} />
              <Line dataKey="Tbas" name={`T = ${factors[0].low}`} stroke={S(0)} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              <Line dataKey="Thaut" name={`T = ${factors[0].high}`} stroke={S(1)} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ChartBox>
        </Card>
        <Card title="Matrice d'essais et résultats" className="xl:col-span-7">
          <div className="max-h-80 overflow-y-auto">
            <Table
              dense
              head={['Essai', ...factors.map((f) => f.name.split(' ')[0]), mode === 'real' ? trials.responseName || 'Réponse' : 'Moyenne Y', ...(mode === 'sim' ? ['σ Y'] : [])]}
              rows={data.map((d) => [d.run.order, ...d.run.actual.map((v, j) => `${v} ${factors[j].unit}`), fmtFixed(d.mean, 4), ...(mode === 'sim' ? [fmtFixed(d.sd * 1000, 1) + ' µm'] : [])])}
            />
          </div>
        </Card>
        <Card title="Modèle et meilleur réglage" className="xl:col-span-5">
          {an.model && (
            <div className="mb-3 space-y-1 text-xs">
              <div className="rounded bg-black/[.03] p-2 font-mono text-[11px] dark:bg-white/[.05]">{an.model.equation} (facteurs codés ±1)</div>
              <div className="text-[var(--muted)]">R² = {fmtFixed(an.model.rSquared, 3)} · R² ajusté = {fmtFixed(an.model.adjRSquared, 3)} · s = {an.model.s.toExponential(2)}</div>
            </div>
          )}
          <Table dense head={['Terme', 'Effet', 'p-valeur', '']} rows={an.effects.map((e) => [e.term, fmtFixed(e.effect, 5), e.pValue !== undefined ? e.pValue.toFixed(4) : '—', e.significant ? <Badge key="s" tone="good">significatif</Badge> : ''])} />
          <div className="mt-3 space-y-2">
            <Note tone="tip" title="Meilleur réglage parmi les sommets du domaine">
              {factors.map((f, j) => `${f.name} = ${best[j]} ${f.unit}`).join(' · ')} → réponse prédite {fmtFixed(an.bestSetting.predicted, 4)}
              {response === 'mean' ? ` (cible ${target})` : ''}. Un réglage intermédiaire peut être meilleur : utilisez « Paramètres procédé » pour l'affiner.
            </Note>
            <Button
              variant="primary"
              onClick={() =>
                update(
                  sc.id,
                  (s) => {
                    s.process.params.forEach((p, j) => (p.setpoint = best[j]))
                  },
                  'Avant application du réglage DOE',
                )
              }
            >
              Appliquer ce réglage au scénario « {sc.name} »
            </Button>
            {mode === 'real' && (
              <div className="rounded-lg border border-brand-500/30 p-2.5 text-xs">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-[var(--color-brand-600)]" checked={trials.isCtq} onChange={(e) => saveTrials({ isCtq: e.target.checked })} />
                  La réponse est la caractéristique critique « {m.characteristic.name} » ({m.characteristic.unit})
                </label>
                {trials.isCtq && (
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      update(
                        sc.id,
                        (s) => applyFit(s.process, fitFromDoe(s.process, levels, an.effects, mean(y))),
                        'Avant mise à jour du modèle par le DOE',
                      )
                    }
                  >
                    Mettre à jour le modèle procédé avec ces effets
                  </Button>
                )}
                <p className="mt-1.5 text-[var(--muted)]">Les effets mesurés remplacent les hypothèses dans « Paramètres procédé » (effets principaux et interaction T×V ; les autres interactions ne sont pas reprises).</p>
              </div>
            )}
          </div>
        </Card>
      </div>
      )}
    </div>
  )
}

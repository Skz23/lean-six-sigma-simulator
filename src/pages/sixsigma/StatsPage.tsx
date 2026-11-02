import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Bar, BarChart, ErrorBar } from 'recharts'
import { Calculator } from 'lucide-react'
import { useActiveScenario, useStore } from '../../store/useStore'
import { runScenario, useSimulation } from '../../store/useSimulation'
import { andersonDarling, anovaOneWay, fTestVariances, fmtP, linearRegression, pearson, simpleRegression, tTestOneSample, tTestPaired, tTestTwoSample, twoProportionTest, type Alternative, type TestResult } from '../../stats/inference'
import { mean, sorted, summarize } from '../../stats/descriptive'
import { normalInv } from '../../stats/distributions'
import { Badge, Card, Field, Note, NumberInput, PageHeader, Select, Stat, Table, Tabs, TextArea } from '../../components/ui'
import { CapabilityHistogram, ChartBox, S, axisProps, tooltipStyle } from '../../components/charts'
import { DoeTool } from '../../components/DoeTool'
import { fmt, fmtFixed, parseNumbers } from '../../lib/format'
import type { Product } from '../../engine/types'

type Tab = 'corr' | 'tests' | 'anova' | 'doe' | 'dist'

function measured(products: Product[], stationId: string) {
  return products
    .filter((p) => p.dimension !== undefined)
    .map((p) => {
      const h = p.history.find((x) => x.stationId === stationId)!
      return { t: h.start, y: p.dimension!, T: p.params!.temperature, P: p.params!.pressure, V: p.params!.speed, batch: p.batch }
    })
    .sort((a, b) => a.t - b.t)
}

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>('corr')
  const sc = useActiveScenario()
  return (
    <div>
      <PageHeader icon={<Calculator size={20} />} title="Statistiques avancées" subtitle="Corrélation, régression, tests d'hypothèses, ANOVA, plans d'expériences et analyse des distributions — avec interprétation" />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'corr', label: 'Corrélation & régression' },
          { id: 'tests', label: 'Tests d\'hypothèses' },
          { id: 'anova', label: 'ANOVA' },
          { id: 'doe', label: 'Plans d\'expériences (DOE)' },
          { id: 'dist', label: 'Distributions' },
        ]}
      />
      {tab === 'corr' && <Correlation />}
      {tab === 'tests' && <Tests />}
      {tab === 'anova' && <Anova />}
      {tab === 'doe' && <DoeTool sc={sc} />}
      {tab === 'dist' && <Distribution />}
    </div>
  )
}

const VARS = [
  { k: 'T', label: 'Température broche (°C)' },
  { k: 'P', label: 'Pression lubrification (bar)' },
  { k: 'V', label: 'Vitesse de coupe (tr/min)' },
  { k: 't', label: 'Heure de fabrication (s)' },
] as const

function Correlation() {
  const sc = useActiveScenario()
  const { results } = useSimulation(sc)
  const data = useMemo(() => measured(results.products, sc.process.stationId), [results, sc.process.stationId])
  const [xk, setXk] = useState<'T' | 'P' | 'V' | 't'>('T')
  if (data.length < 10) return <Card>Pas assez de données.</Card>
  const x = data.map((d) => d[xk])
  const y = data.map((d) => d.y)
  const c = pearson(x, y)
  const reg = simpleRegression(x, y, xk, 'Ø')
  const multi = linearRegression(data.map((d) => [d.T, d.P, d.V]), y, ['T', 'P', 'V'], 'Ø')
  const xs = sorted(x)
  const line = [xs[0], xs[xs.length - 1]].map((v) => ({ x: v, fit: reg.predict([v]) }))
  const label = VARS.find((v) => v.k === xk)!.label
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card title="Nuage de points" subtitle={`${label} → ${sc.process.characteristic.name} · ${data.length} pièces simulées`} className="xl:col-span-8" actions={
        <Select value={xk} onChange={(e) => setXk(e.target.value as 'T')} className="w-60">
          {VARS.map((v) => <option key={v.k} value={v.k}>{v.label}</option>)}
        </Select>
      }>
        <ChartBox height={340}>
          <ComposedChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid />
            <XAxis dataKey="x" type="number" domain={['auto', 'auto']} {...axisProps} tickFormatter={(v) => fmt(v, 1)} name={label} />
            <YAxis dataKey="y" type="number" domain={['auto', 'auto']} {...axisProps} tickFormatter={(v) => fmt(v, 3)} width={60} />
            <ZAxis range={[18, 18]} />
            <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v), 4)} />
            <Scatter data={x.map((v, i) => ({ x: v, y: y[i] }))} fill={S(0)} fillOpacity={0.55} isAnimationActive={false} name="Pièces" />
            <Line data={line} dataKey="fit" stroke={S(1)} strokeWidth={2} dot={false} isAnimationActive={false} name="Régression" />
          </ComposedChart>
        </ChartBox>
      </Card>
      <div className="space-y-4 xl:col-span-4">
        <Card title="Corrélation de Pearson">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="r" value={fmtFixed(c.r, 3)} />
            <Stat label="R²" value={fmtFixed(c.r2, 3)} />
            <Stat label="t" value={fmtFixed(c.t, 2)} />
            <Stat label="p-valeur" value={fmtP(c.pValue)} />
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Corrélation <b>{c.strength}</b> {c.r > 0 ? 'positive' : 'négative'}{c.pValue < 0.05 ? ', statistiquement significative.' : ', non significative au seuil de 5 %.'} {label} explique {fmt(c.r2 * 100, 1)} % de la variance du diamètre.
          </p>
        </Card>
        <Card title="Régression linéaire simple">
          <div className="rounded bg-black/[.03] p-2 font-mono text-xs dark:bg-white/[.05]">{reg.equation}</div>
          <Table dense className="mt-2" head={['Terme', 'Coef.', 'Err. std', 'p']} rows={reg.terms.map((t) => [t.name, t.coef.toPrecision(4), t.se.toPrecision(3), fmtP(t.pValue)])} />
          <p className="mt-2 text-xs text-[var(--muted)]">
            {xk === 'T' && `Pente estimée ${reg.terms[1].coef.toPrecision(3)} mm/°C — le modèle procédé utilise b_T = ${sc.process.coefficients.temperature} mm/°C (± interaction avec la vitesse) : la régression retrouve l'effet à partir des seules données.`}
          </p>
        </Card>
      </div>
      <Card title="Régression multiple : Ø = f(T, P, V)" className="xl:col-span-12">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Table dense head={['Terme', 'Coefficient', 'Erreur std', 't', 'p-valeur', '']} rows={multi.terms.map((t) => [t.name, t.coef.toPrecision(5), t.se.toPrecision(3), fmtFixed(t.t, 2), fmtP(t.pValue), t.pValue < 0.05 ? <Badge key="s" tone="good">significatif</Badge> : <Badge key="n">non significatif</Badge>])} />
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="R²" value={fmtFixed(multi.rSquared, 3)} />
              <Stat label="R² ajusté" value={fmtFixed(multi.adjRSquared, 3)} />
              <Stat label="F" value={fmtFixed(multi.F, 1)} />
              <Stat label="p (modèle)" value={fmtP(multi.pValue)} />
            </div>
            <p className="text-xs text-[var(--muted)]">La part non expliquée (1 − R²) provient de la répétabilité machine, des décalages entre lots et de l'usure outil — variations non portées par T, P, V.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function TestCard({ r }: { r: TestResult }) {
  return (
    <Card title={r.name} actions={<Badge tone={r.reject ? 'critical' : 'good'}>{r.reject ? 'H0 rejetée' : 'H0 non rejetée'}</Badge>}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={`Statistique ${r.statisticName}`} value={fmtFixed(r.statistic, 3)} />
        <Stat label="Degrés de liberté" value={r.df !== undefined ? fmt(r.df, 2) + (r.df2 !== undefined ? ` ; ${r.df2}` : '') : '—'} />
        <Stat label="p-valeur" value={fmtP(r.pValue)} />
        <Stat label="Estimation" value={r.estimate !== undefined ? r.estimate.toPrecision(4) : '—'} sub={r.ci ? `IC 95 % [${r.ci[0].toPrecision(4)} ; ${r.ci[1].toPrecision(4)}]` : undefined} />
      </div>
      <p className="mt-3 text-sm">{r.conclusion}</p>
    </Card>
  )
}

function Tests() {
  const scenarios = useStore((s) => s.scenarios)
  const sc = useActiveScenario()
  const [kind, setKind] = useState<'one' | 'two' | 'paired' | 'var' | 'prop'>('two')
  const [src, setSrc] = useState<'sim' | 'manual'>('sim')
  const [a, setA] = useState(scenarios[0].id)
  const [b, setB] = useState(scenarios[Math.min(2, scenarios.length - 1)].id)
  const [mu0, setMu0] = useState(sc.process.characteristic.nominal)
  const [alpha, setAlpha] = useState(0.05)
  const [alt, setAlt] = useState<Alternative>('two-sided')
  const [ta, setTa] = useState('')
  const [tb, setTb] = useState('')
  const scA = scenarios.find((s) => s.id === a)!
  const scB = scenarios.find((s) => s.id === b)!
  const ra = runScenario(scA)
  const rb = runScenario(scB)
  const da = src === 'sim' ? measured(ra.results.products, scA.process.stationId).map((d) => d.y) : parseNumbers(ta)
  const db = src === 'sim' ? measured(rb.results.products, scB.process.stationId).map((d) => d.y) : parseNumbers(tb)
  let r: TestResult | null = null
  let err = ''
  try {
    if (kind === 'one' && da.length > 2) r = tTestOneSample(da, mu0, alpha, alt)
    else if (kind === 'two' && da.length > 2 && db.length > 2) r = tTestTwoSample(da, db, alpha, alt)
    else if (kind === 'paired') {
      const n = Math.min(da.length, db.length)
      if (n > 2) r = tTestPaired(da.slice(0, n), db.slice(0, n), alpha, alt)
    } else if (kind === 'var' && da.length > 2 && db.length > 2) r = fTestVariances(da, db, alpha)
    else if (kind === 'prop') {
      const oa = ra.results.good + ra.results.scrap
      const ob = rb.results.good + rb.results.scrap
      r = twoProportionTest(ra.results.scrap, oa, rb.results.scrap, ob, alpha, alt)
    }
    if (!r) err = 'Données insuffisantes.'
  } catch (e) {
    err = (e as Error).message
  }
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card title="Configuration du test" className="xl:col-span-4">
        <div className="space-y-3">
          <Field label="Test">
            <Select value={kind} onChange={(e) => setKind(e.target.value as 'one')}>
              <option value="one">t à un échantillon (μ = μ₀)</option>
              <option value="two">t à deux échantillons (Welch)</option>
              <option value="paired">t apparié</option>
              <option value="var">F — égalité des variances</option>
              <option value="prop">Comparaison de deux taux de défauts</option>
            </Select>
          </Field>
          {kind !== 'prop' && (
            <Field label="Source">
              <Select value={src} onChange={(e) => setSrc(e.target.value as 'sim')}>
                <option value="sim">Diamètres simulés des scénarios</option>
                <option value="manual">Saisie manuelle</option>
              </Select>
            </Field>
          )}
          {(src === 'sim' || kind === 'prop') && (
            <>
              <Field label="Échantillon A">
                <Select value={a} onChange={(e) => setA(e.target.value)}>
                  {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              {kind !== 'one' && (
                <Field label="Échantillon B">
                  <Select value={b} onChange={(e) => setB(e.target.value)}>
                    {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </Field>
              )}
            </>
          )}
          {src === 'manual' && kind !== 'prop' && (
            <>
              <Field label="Échantillon A"><TextArea rows={3} value={ta} onChange={(e) => setTa(e.target.value)} /></Field>
              {kind !== 'one' && <Field label="Échantillon B"><TextArea rows={3} value={tb} onChange={(e) => setTb(e.target.value)} /></Field>}
            </>
          )}
          {kind === 'one' && <Field label="Valeur de référence μ₀"><NumberInput value={mu0} step={0.001} onChange={setMu0} /></Field>}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Risque α">
              <Select value={alpha} onChange={(e) => setAlpha(+e.target.value)}>
                {[0.01, 0.05, 0.1].map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
            {kind !== 'var' && (
              <Field label="Hypothèse H1">
                <Select value={alt} onChange={(e) => setAlt(e.target.value as Alternative)}>
                  <option value="two-sided">≠ (bilatéral)</option>
                  <option value="greater">A &gt; B</option>
                  <option value="less">A &lt; B</option>
                </Select>
              </Field>
            )}
          </div>
        </div>
      </Card>
      <div className="space-y-4 xl:col-span-8">
        {r ? <TestCard r={r} /> : <Card>{err}</Card>}
        {kind !== 'prop' && (
          <div className="grid gap-3 md:grid-cols-2">
            {[{ n: 'A', d: da }, ...(kind !== 'one' ? [{ n: 'B', d: db }] : [])].map(({ n, d }) => {
              const s = d.length > 1 ? summarize(d) : null
              return s ? (
                <Card key={n} title={`Échantillon ${n}`}>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="n" value={s.n} />
                    <Stat label="Moyenne" value={fmtFixed(s.mean, 4)} />
                    <Stat label="Écart-type" value={fmtFixed(s.stdDev, 5)} />
                  </div>
                </Card>
              ) : null
            })}
          </div>
        )}
        <Note title="Rappel">
          H0 est l'hypothèse d'absence d'effet. Une p-valeur inférieure à α conduit à rejeter H0 : la différence observée est peu compatible avec le seul hasard. Ne pas rejeter H0 ne prouve pas l'égalité (puissance limitée si n est faible).
        </Note>
      </div>
    </div>
  )
}

function Anova() {
  const sc = useActiveScenario()
  const scenarios = useStore((s) => s.scenarios)
  const { results } = useSimulation(sc)
  const [by, setBy] = useState<'batch' | 'scenario'>('batch')
  const data = useMemo(() => measured(results.products, sc.process.stationId), [results, sc.process.stationId])
  let groups: number[][] = []
  let names: string[] = []
  if (by === 'batch') {
    const m = new Map<number, number[]>()
    for (const d of data) m.set(d.batch, [...(m.get(d.batch) ?? []), d.y])
    const entries = [...m.entries()].filter(([, v]) => v.length >= 3).sort((a, b) => a[0] - b[0])
    groups = entries.map(([, v]) => v)
    names = entries.map(([k]) => `Lot ${k}`)
  } else {
    groups = scenarios.map((s) => measured(runScenario(s).results.products, s.process.stationId).map((d) => d.y))
    names = scenarios.map((s) => s.name)
  }
  const ok = groups.length >= 2
  const r = ok ? anovaOneWay(groups, names) : null
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card title="ANOVA à un facteur" subtitle="La moyenne du diamètre diffère-t-elle selon le facteur ?" className="xl:col-span-7" actions={
        <Select value={by} onChange={(e) => setBy(e.target.value as 'batch')} className="w-56">
          <option value="batch">Facteur : lot de fabrication</option>
          <option value="scenario">Facteur : scénario</option>
        </Select>
      }>
        {r ? (
          <>
            <Table
              dense
              head={['Source', 'SC', 'ddl', 'CM', 'F', 'p-valeur']}
              rows={[
                ['Inter-groupes (facteur)', r.ssBetween.toExponential(3), r.dfBetween, r.msBetween.toExponential(3), fmtFixed(r.F, 2), fmtP(r.pValue)],
                ['Intra-groupes (résidu)', r.ssWithin.toExponential(3), r.dfWithin, r.msWithin.toExponential(3), '', ''],
                ['Total', r.ssTotal.toExponential(3), r.dfBetween + r.dfWithin, '', '', ''],
              ]}
            />
            <p className="mt-3 text-sm">{r.conclusion}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">R² = {fmt(r.rSquared * 100, 1)} % de la variation totale expliquée par le facteur.{by === 'batch' && ' Un effet « lot » significatif traduit la variation entre réglages après changement de série : c\'est ce qui sépare Ppk de Cpk.'}</p>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Au moins deux groupes d'au moins 3 valeurs sont nécessaires.</p>
        )}
      </Card>
      <Card title="Moyennes par groupe (± 1 écart-type)" className="xl:col-span-5">
        {r && (
          <ChartBox height={300}>
            <BarChart data={r.groups.map((g) => ({ name: g.name, mean: g.mean, err: g.sd }))} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis {...axisProps} domain={['auto', 'auto']} tickFormatter={(v) => fmt(v, 3)} width={60} />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtFixed(Number(v), 4)} />
              <Bar dataKey="mean" fill={S(0)} radius={[4, 4, 0, 0]} isAnimationActive={false} name="Moyenne">
                <ErrorBar dataKey="err" stroke="var(--text-secondary)" width={6} />
              </Bar>
            </BarChart>
          </ChartBox>
        )}
      </Card>
    </div>
  )
}

function Distribution() {
  const { values: simVals, sc } = useSimValues()
  const [text, setText] = useState('')
  const [src, setSrc] = useState<'sim' | 'manual'>('sim')
  const values = src === 'sim' ? simVals : parseNumbers(text)
  if (values.length < 8)
    return (
      <Card title="Données">
        <Select value={src} onChange={(e) => setSrc(e.target.value as 'sim')} className="mb-2 w-60"><option value="sim">Simulation</option><option value="manual">Saisie</option></Select>
        <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder="Au moins 8 valeurs" />
      </Card>
    )
  const s = summarize(values)
  const ad = andersonDarling(values)
  const srt = sorted(values)
  const n = srt.length
  const qq = srt.map((v, i) => ({ x: normalInv((i + 1 - 0.375) / (n + 0.25)), y: v }))
  const qline = [qq[0].x, qq[n - 1].x].map((x) => ({ x, fit: s.mean + s.stdDev * x }))
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card title="Histogramme" className="xl:col-span-6" actions={
        <Select value={src} onChange={(e) => setSrc(e.target.value as 'sim')} className="w-44"><option value="sim">Simulation</option><option value="manual">Saisie</option></Select>
      }>
        {src === 'manual' && <TextArea className="mb-2" value={text} onChange={(e) => setText(e.target.value)} />}
        <CapabilityHistogram values={values} mean={s.mean} sigma={s.stdDev} showNormal={ad.normal} lsl={src === 'sim' ? sc.process.characteristic.lsl : undefined} usl={src === 'sim' ? sc.process.characteristic.usl : undefined} />
      </Card>
      <Card title="Droite de Henry (Q-Q plot normal)" subtitle="Points alignés = distribution normale" className="xl:col-span-6">
        <ChartBox height={300}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid />
            <XAxis dataKey="x" type="number" {...axisProps} name="Quantile théorique" tickFormatter={(v) => fmt(v, 1)} />
            <YAxis dataKey="y" type="number" domain={['auto', 'auto']} {...axisProps} tickFormatter={(v) => fmt(v, 3)} width={60} />
            <ZAxis range={[16, 16]} />
            <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v), 4)} />
            <Scatter data={qq} fill={S(0)} isAnimationActive={false} />
            <Scatter data={qline.map((p) => ({ x: p.x, y: p.fit }))} line={{ stroke: 'var(--series-2)', strokeWidth: 2 }} shape={() => <g />} isAnimationActive={false} />
          </ScatterChart>
        </ChartBox>
      </Card>
      <Card title="Analyse de la distribution" className="xl:col-span-12">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
          <Stat label="n" value={s.n} />
          <Stat label="Moyenne" value={fmtFixed(s.mean, 4)} />
          <Stat label="Médiane" value={fmtFixed(s.median, 4)} />
          <Stat label="Écart-type" value={fmtFixed(s.stdDev, 5)} />
          <Stat label="Q1 / Q3" value={`${fmtFixed(s.q1, 3)} / ${fmtFixed(s.q3, 3)}`} />
          <Stat label="Asymétrie" value={fmtFixed(s.skewness, 3)} />
          <Stat label="Kurtosis (excès)" value={fmtFixed(s.kurtosis, 3)} />
          <Stat label="AD p-valeur" value={fmtP(ad.pValue)} />
        </div>
        <p className="mt-3 text-sm">{ad.conclusion}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Asymétrie {Math.abs(s.skewness) < 0.5 ? 'faible' : 'marquée'} ; un aplatissement négatif traduit une distribution plus « plate » que la normale (typique d'un mélange de lots décalés ou d'une usure outil linéaire). Moyenne − médiane = {fmtFixed(s.mean - s.median, 5)}.
        </p>
      </Card>
    </div>
  )
}

function useSimValues() {
  const sc = useActiveScenario()
  const { results } = useSimulation(sc)
  const values = useMemo(() => measured(results.products, sc.process.stationId).map((d) => d.y), [results, sc.process.stationId])
  return { values, sc, mean: mean(values) }
}

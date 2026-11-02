import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { Ruler, Wand2 } from 'lucide-react'
import { useActiveScenario } from '../../store/useStore'
import { charbonneau, gageRR, type GageData } from '../../stats/msa'
import { Rng } from '../../engine/random'
import { Badge, Button, Card, Field, Note, NumberInput, PageHeader, Select, Stat, Table, Tabs, TextArea } from '../../components/ui'
import { ChartBox, S, axisProps, tooltipStyle } from '../../components/charts'
import { fmt, fmtFixed, pct } from '../../lib/format'
import { fmtP } from '../../stats/inference'
import { parseTable, toNumber } from '../../data/import'

type Tab = 'rr' | 'cmc'

/** Jeu d'essai : pièces réparties sur la dispersion du procédé, biais opérateur et répétabilité réalistes. */
function demoGage(p: number, o: number, r: number, nominal: number, processSd: number, seed: number): GageData {
  const rng = new Rng(seed)
  const parts = Array.from({ length: p }, () => rng.normal(nominal, processSd))
  const bias = Array.from({ length: o }, () => rng.normal(0, processSd * 0.12))
  return parts.map((x) => bias.map((b) => Array.from({ length: r }, () => Math.round((x + b + rng.normal(0, processSd * 0.15)) * 10000) / 10000)))
}

/** Lecture du format « Pièce ; Opérateur ; Mesure » (une ligne par mesure). */
function parseLong(text: string): GageData | string {
  const rows = parseTable(text)
  const body = rows.filter((r) => Number.isFinite(toNumber(r[2])))
  if (body.length < 8) return 'Collez au moins 8 lignes « Pièce ; Opérateur ; Mesure ».'
  const parts = [...new Set(body.map((r) => r[0]))]
  const ops = [...new Set(body.map((r) => r[1]))]
  const data: number[][][] = parts.map(() => ops.map(() => []))
  for (const r of body) data[parts.indexOf(r[0])][ops.indexOf(r[1])].push(toNumber(r[2]))
  const reps = data.flat().map((c) => c.length)
  const r = Math.min(...reps)
  if (r < 2) return 'Chaque opérateur doit mesurer chaque pièce au moins 2 fois (étude croisée).'
  return data.map((pp) => pp.map((c) => c.slice(0, r)))
}

export default function MsaPage() {
  const [tab, setTab] = useState<Tab>('rr')
  return (
    <div>
      <PageHeader icon={<Ruler size={20} />} title="Système de mesure (MSA)" subtitle="Peut-on faire confiance aux mesures ? À vérifier en phase Mesurer, avant toute capabilité ou carte de contrôle" />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'rr', label: 'Étude R&R croisée (ANOVA)' }, { id: 'cmc', label: 'Méthode de Charbonneau (Cmc)' }]} />
      {tab === 'rr' ? <GageRR /> : <Charbonneau />}
    </div>
  )
}

function GageRR() {
  const sc = useActiveScenario()
  const c = sc.process.characteristic
  const [p, setP] = useState(10)
  const [o, setO] = useState(3)
  const [r, setR] = useState(2)
  const [seed, setSeed] = useState(1)
  const [text, setText] = useState('')
  const [tol, setTol] = useState(Math.round((c.usl - c.lsl) * 1e6) / 1e6)
  const parsed = text.trim() ? parseLong(text) : null
  const data = useMemo(() => (parsed && typeof parsed !== 'string' ? parsed : demoGage(p, o, r, c.nominal, (c.usl - c.lsl) / 8, seed)), [parsed, p, o, r, c, seed])
  let res: ReturnType<typeof gageRR> | null = null
  let err = typeof parsed === 'string' ? parsed : ''
  try {
    res = gageRR(data, tol > 0 ? tol : undefined)
  } catch (e) {
    err = (e as Error).message
  }
  const tone = res ? (res.verdict === 'souhaitable' ? 'good' : res.verdict === 'acceptable' ? 'good' : res.verdict === 'conditionnel' ? 'warning' : 'critical') : 'neutral'
  const vRep = res?.components.find((x) => x.source.startsWith('Répétabilité'))?.sd ?? 0
  const vRepro = res?.components.find((x) => x.source.startsWith('Reproductibilité'))?.sd ?? 0

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-4">
        <Card title="Données de l'étude" subtitle="Chaque opérateur mesure chaque pièce plusieurs fois, dans un ordre aléatoire">
          <div className="space-y-3">
            <Field label="Collez vos mesures (Excel) : Pièce ; Opérateur ; Mesure" hint="Une ligne par mesure. Laissez vide pour utiliser le jeu d'essai.">
              <TextArea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Pièce\tOpérateur\tMesure\n1\tA\t25,012\n1\tA\t25,010\n1\tB\t25,015\n…'} className="font-mono text-xs" />
            </Field>
            {!text.trim() && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Pièces"><NumberInput value={p} min={2} max={30} step={1} onChange={(v) => setP(Math.round(v))} /></Field>
                  <Field label="Opérateurs"><NumberInput value={o} min={2} max={6} step={1} onChange={(v) => setO(Math.round(v))} /></Field>
                  <Field label="Répétitions"><NumberInput value={r} min={2} max={5} step={1} onChange={(v) => setR(Math.round(v))} /></Field>
                </div>
                <Button onClick={() => setSeed(seed + 1)}><Wand2 size={14} /> Nouveau jeu d'essai</Button>
              </>
            )}
            <Field label="Intervalle de tolérance IT (TS − TI)" hint={`Pour le %tolérance. Scénario : ${c.lsl} – ${c.usl} ${c.unit}`}>
              <NumberInput value={tol} min={0} step={0.01} suffix={c.unit} onChange={setTol} />
            </Field>
            {err && <p className="text-sm text-[var(--critical)]">{err}</p>}
          </div>
        </Card>
        <Note title="Règles d'interprétation (cours)">
          %R&R = σ système de mesure / σ total.<br />
          &lt; 10 % : souhaitable · 10–20 % : acceptable · 20–30 % : acceptable selon l'application et les coûts · &gt; 30 % : le système de mesure doit être amélioré.
        </Note>
      </div>
      {res && (
        <div className="space-y-4 xl:col-span-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-black/[.08] bg-[var(--surface-1)] p-3.5 dark:border-white/10">
              <div className="text-xs text-[var(--text-secondary)]">%R&R (σ)</div>
              <div className="mt-1 text-2xl font-semibold">{pct(res.pctRR, 1)}</div>
              <Badge tone={tone} className="mt-1">{res.verdict}</Badge>
            </div>
            <Stat label="% de la tolérance" value={res.pctTolerance !== undefined ? pct(res.pctTolerance, 1) : '—'} sub="6σ R&R / IT" />
            <Stat label="Catégories distinctes (ndc)" value={Number.isFinite(res.ndc) ? res.ndc : '∞'} sub="≥ 5 attendu" />
            <Stat label="Plan" value={`${res.parts} × ${res.operators} × ${res.replicates}`} sub="pièces × opérateurs × répétitions" />
          </div>
          <Card title="Décomposition de la variation">
            <ChartBox height={230}>
              <BarChart data={res.components.filter((x) => !x.source.startsWith('Variation totale')).map((x) => ({ name: x.source.split(' (')[0], contrib: x.contribution * 100, etude: x.studyVar * 100, tol: x.tolerance !== undefined ? x.tolerance * 100 : undefined }))} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <YAxis {...axisProps} unit=" %" />
                <Tooltip {...tooltipStyle} formatter={(v, n) => [`${fmt(Number(v), 1)} %`, n]} />
                <Legend verticalAlign="top" height={22} iconSize={10} />
                <Bar dataKey="contrib" name="% contribution (variance)" fill={S(0)} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="etude" name="% variation de l'étude (σ)" fill={S(1)} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                {tol > 0 && <Bar dataKey="tol" name="% tolérance" fill={S(2)} radius={[3, 3, 0, 0]} isAnimationActive={false} />}
              </BarChart>
            </ChartBox>
            <Table
              dense
              head={['Source', 'Variance', 'Écart-type', '% contribution', '% étude', '% tolérance']}
              rows={res.components.map((x) => [x.source, x.variance.toExponential(3), fmtFixed(x.sd, 5), pct(x.contribution, 1), pct(x.studyVar, 1), x.tolerance !== undefined ? pct(x.tolerance, 1) : '—'])}
            />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Interaction pièce × opérateur" subtitle="Courbes parallèles et confondues = pas d'effet opérateur">
              <ChartBox height={220}>
                <LineChart data={res.cellMeans.map((row, i) => ({ piece: i + 1, ...Object.fromEntries(row.map((v, j) => [`Op. ${String.fromCharCode(65 + j)}`, v])) }))} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="piece" {...axisProps} />
                  <YAxis {...axisProps} domain={['auto', 'auto']} tickFormatter={(v) => fmt(v, 3)} width={56} />
                  <Tooltip {...tooltipStyle} formatter={(v, n) => [fmtFixed(Number(v), 4), n]} labelFormatter={(l) => `Pièce ${l}`} />
                  <Legend verticalAlign="top" height={22} iconSize={10} />
                  {res.operatorMeans.map((_, j) => (
                    <Line key={j} dataKey={`Op. ${String.fromCharCode(65 + j)}`} stroke={S(j)} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ChartBox>
            </Card>
            <Card title="Tableau d'ANOVA" subtitle={res.interactionPooled ? 'Interaction non significative (p > 0,05) : regroupée avec la répétabilité' : 'Interaction significative : conservée'}>
              <Table dense head={['Source', 'ddl', 'SC', 'CM', 'F', 'p']} rows={res.anova.map((a) => [a.source, a.df, a.ss.toExponential(3), Number.isFinite(a.ms) ? a.ms.toExponential(3) : '', a.F !== undefined ? fmtFixed(a.F, 2) : '', a.p !== undefined ? fmtP(a.p) : ''])} />
            </Card>
          </div>
          <Card title="Que faire ?">
            <ul className="space-y-1.5 text-sm">
              {res.pctRR < 0.1 && <li>Le système de mesure est bon : vous pouvez exploiter les mesures (capabilité, cartes de contrôle).</li>}
              {res.pctRR >= 0.3 && <li className="text-[var(--critical)]">Le système de mesure masque la variation réelle : améliorez-le avant toute analyse du procédé.</li>}
              {res.pctRR >= 0.1 && (vRep > 1.2 * vRepro ? (
                <li>Répétabilité (r) &gt; reproductibilité (R) : l'instrument est en cause — maintenance, rigidité, fixation ou positionnement de la pièce.</li>
              ) : vRepro > 1.2 * vRep ? (
                <li>Reproductibilité (R) &gt; répétabilité (r) : les opérateurs mesurent différemment — former à l'utilisation et à la lecture, mode opératoire, gabarit d'aide, graduations plus lisibles.</li>
              ) : (
                <li>r ≈ R : améliorer à la fois l'instrument et la méthode de mesure.</li>
              ))}
              {Number.isFinite(res.ndc) && res.ndc < 5 && <li>Moins de 5 catégories distinctes : l'instrument ne distingue pas assez les pièces entre elles (résolution insuffisante).</li>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

function Charbonneau() {
  const sc = useActiveScenario()
  const c = sc.process.characteristic
  const [tol, setTol] = useState(Math.round((c.usl - c.lsl) * 1e6) / 1e6)
  const [text, setText] = useState('')
  const [n, setN] = useState(3)
  const [seed, setSeed] = useState(1)
  const rows = useMemo(() => {
    if (text.trim()) return parseTable(text).map((r) => r.map(toNumber).filter(Number.isFinite)).filter((r) => r.length >= 2)
    const g = demoGage(10, n, 1, c.nominal, (c.usl - c.lsl) / 8, seed)
    return g.map((pp) => pp.map((x) => x[0]))
  }, [text, n, c, seed])
  let res: ReturnType<typeof charbonneau> | null = null
  let err = ''
  try {
    const k = Math.min(...rows.map((r) => r.length))
    res = charbonneau(rows.map((r) => r.slice(0, k)), tol)
  } catch (e) {
    err = (e as Error).message
  }
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card title="Données" subtitle="10 pièces mesurées une fois par 2 ou 3 contrôleurs" className="xl:col-span-4">
        <div className="space-y-3">
          <Field label="Collez un tableau : une ligne par pièce, une colonne par contrôleur" hint="Laissez vide pour le jeu d'essai.">
            <TextArea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'10,023\t10,022\t10,025\n10,020\t10,020\t10,021\n…'} className="font-mono text-xs" />
          </Field>
          {!text.trim() && (
            <div className="flex items-end gap-2">
              <Field label="Contrôleurs"><Select value={n} onChange={(e) => setN(+e.target.value)} className="w-24">{[2, 3].map((k) => <option key={k}>{k}</option>)}</Select></Field>
              <Button onClick={() => setSeed(seed + 1)}><Wand2 size={14} /> Nouveau jeu</Button>
            </div>
          )}
          <Field label="Intervalle de tolérance IT"><NumberInput value={tol} min={0} step={0.01} suffix={c.unit} onChange={setTol} /></Field>
          {err && <p className="text-sm text-[var(--critical)]">{err}</p>}
        </div>
      </Card>
      {res && (
        <div className="space-y-4 xl:col-span-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-black/[.08] bg-[var(--surface-1)] p-3.5 dark:border-white/10">
              <div className="text-xs text-[var(--text-secondary)]">Cmc</div>
              <div className="mt-1 text-2xl font-semibold">{fmtFixed(res.cmc, 2)}</div>
              <Badge tone={res.verdict === 'capable' ? 'good' : res.verdict === 'à surveiller' ? 'warning' : 'critical'} className="mt-1">{res.verdict}</Badge>
            </div>
            <Stat label="R̄ (étendue moyenne)" value={fmtFixed(res.rbar, 5)} />
            <Stat label="σ mesure = R̄ / d₂" value={fmtFixed(res.sigma, 5)} />
            <Stat label="Dispersion = 6σ" value={fmtFixed(res.dispersion, 5)} />
          </div>
          <Card title="Étendue par pièce">
            <Table dense head={['Pièce', ...rows[0].map((_, j) => `Contrôleur ${j + 1}`), 'Moyenne', 'Étendue R']} rows={rows.map((r, i) => [i + 1, ...r.map((v) => fmtFixed(v, 4)), fmtFixed(r.reduce((a, b) => a + b, 0) / r.length, 4), fmtFixed(res!.ranges[i], 4)])} />
          </Card>
          <Note title="Méthode de Charbonneau (cours ENSGSI)">
            Cmc = IT / (6 σ mesure), avec σ mesure = R̄ / d₂. Le moyen de contrôle est capable si <b>Cmc &gt; 4</b> ; si <b>Cmc &lt; 3</b>, il faut l'améliorer. Méthode rapide ; l'étude R&R par ANOVA sépare en plus l'instrument et les opérateurs.
          </Note>
        </div>
      )}
    </div>
  )
}

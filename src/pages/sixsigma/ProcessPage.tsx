import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { normalCdf, normalPdf } from '../../stats/distributions'
import { SlidersHorizontal } from 'lucide-react'
import { useActiveScenario, useStore } from '../../store/useStore'
import { runScenario, useSimulation } from '../../store/useSimulation'
import { cycleTimeFactor, predict, setpointsOf, type Setpoints } from '../../engine/processModel'
import type { ParamKey, Scenario } from '../../engine/types'
import { Button, Card, Delta, Field, Kpi, Note, NumberInput, PageHeader, Select, Table } from '../../components/ui'
import { ChartBox, S, axisProps, tooltipStyle } from '../../components/charts'
import { fmt, fmtFixed } from '../../lib/format'

export default function ProcessPage() {
  const sc = useActiveScenario()
  const update = useStore((s) => s.updateScenario)
  const { kpis } = useSimulation(sc)
  const m = sc.process
  const [sp, setSp] = useState<Setpoints>(setpointsOf(m))
  const [noise, setNoise] = useState<Record<ParamKey, number>>(Object.fromEntries(m.params.map((p) => [p.key, p.noiseSd])) as Record<ParamKey, number>)
  const trialModel = { ...m, params: m.params.map((p) => ({ ...p, setpoint: sp[p.key], noiseSd: noise[p.key] })) }
  const before = predict(m, setpointsOf(m), sc.batchSize)
  const after = predict(trialModel, sp, sc.batchSize)
  const qIdx = sc.stations.findIndex((s) => s.id === m.stationId)
  const ctBefore = sc.stations[qIdx].cycleTime * cycleTimeFactor(m, setpointsOf(m).speed)
  const ctAfter = sc.stations[qIdx].cycleTime * cycleTimeFactor(m, sp.speed)

  const trial: Scenario = structuredClone(sc)
  trial.process = trialModel
  const tk = runScenario(trial).kpis
  const changed = JSON.stringify(trialModel.params) !== JSON.stringify(m.params)

  const set = (fn: (s: Scenario) => void, label?: string) => update(sc.id, fn, label)
  const c = m.characteristic

  return (
    <div>
      <PageHeader icon={<SlidersHorizontal size={20} />} title="Paramètres procédé" subtitle={`Modèle statistique de la caractéristique critique « ${c.name} » au poste ${sc.stations[qIdx]?.name}`} />
      <div className="mb-4">
        <Note tone="warning" title="Fiabilité de cet outil">
          Les effets des réglages (b_T, b_P, b_V, interaction) sont des <b>hypothèses du modèle</b> : réalistes pour l'exemple MécaPrécis, mais <b>pas estimés sur vos données</b>. Sur une ligne réelle calée sur vos mesures, ils valent 0 tant que vous ne les avez pas renseignés (par exemple à partir d'une régression ou d'un plan d'expériences réalisé en atelier). Les prédictions ne valent que ce que valent ces coefficients.
        </Note>
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Réglages machine (what-if)" subtitle="Consigne et qualité de régulation (écart-type autour de la consigne)" className="xl:col-span-5">
          <div className="space-y-4">
            {m.params.map((p) => (
              <div key={p.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="tabular text-[var(--text-secondary)]">
                    {fmt(sp[p.key], 1)} {p.unit} <span className="text-[var(--muted)]">(réf. {p.reference})</span>
                  </span>
                </div>
                <input type="range" className="w-full accent-[var(--color-brand-600)]" min={p.min} max={p.max} step={(p.max - p.min) / 100} value={sp[p.key]} onChange={(e) => setSp({ ...sp, [p.key]: +e.target.value })} />
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Field label="Consigne">
                    <NumberInput value={+sp[p.key].toFixed(2)} min={p.min} max={p.max} step={1} suffix={p.unit} onChange={(v) => setSp({ ...sp, [p.key]: v })} />
                  </Field>
                  <Field label="Régulation (σ)">
                    <NumberInput value={noise[p.key]} min={0} step={0.1} suffix={p.unit} onChange={(v) => setNoise({ ...noise, [p.key]: v })} />
                  </Field>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={!changed}
                onClick={() =>
                  set((s) => {
                    s.process.params.forEach((p) => {
                      p.setpoint = sp[p.key]
                      p.noiseSd = noise[p.key]
                    })
                  }, 'Avant modification des paramètres procédé')
                }
              >
                Appliquer au scénario
              </Button>
              <Button
                onClick={() => {
                  setSp(setpointsOf(m))
                  setNoise(Object.fromEntries(m.params.map((p) => [p.key, p.noiseSd])) as Record<ParamKey, number>)
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        </Card>
        <div className="space-y-4 xl:col-span-7">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Moyenne prédite" value={fmtFixed(after.mean, 4)} unit={c.unit} hint={`Actuel : ${fmtFixed(before.mean, 4)}`} />
            <Kpi label="σ global prédit" value={fmtFixed(after.sdOverall * 1000, 1)} unit="µm" before={before.sdOverall} after={after.sdOverall} higherIsBetter={false} />
            <Kpi label="Cpk prédit" value={fmtFixed(after.cpk, 2)} before={before.cpk} after={after.cpk} higherIsBetter tone={after.cpk >= 1.33 ? 'good' : after.cpk < 1 ? 'critical' : 'warning'} />
            <Kpi label="CT poste CTQ" value={fmt(ctAfter, 1)} unit="s" before={ctBefore} after={ctAfter} higherIsBetter={false} hint="Modulé par la vitesse" />
          </div>
          <NormalCurves before={{ mean: before.mean, sd: before.sdOverall }} after={{ mean: after.mean, sd: after.sdOverall }} lsl={c.lsl} usl={c.usl} target={c.nominal} unit={c.unit} />
          <Card title="Contributions à la variance (méthode delta)" subtitle="Quelle source de variation réduire en priorité ?">
            <ChartBox height={220}>
              <BarChart data={after.contributions.map((x) => ({ name: x.source, v: (x.variance / after.sdOverall ** 2) * 100 }))} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" {...axisProps} unit=" %" />
                <YAxis type="category" dataKey="name" width={220} {...axisProps} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${fmt(Number(v), 1)} % de la variance`, 'Part']} />
                <Bar dataKey="v" fill={S(0)} radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartBox>
          </Card>
          <Card title="Impact simulé sur la ligne" subtitle="Simulation complète d'une journée avec les réglages testés (même graine)">
            <Table
              dense
              head={['Indicateur', 'Actuel', 'Réglages testés', 'Écart']}
              rows={[
                ['Cpk observé', fmtFixed(kpis.dimension?.cpk, 2), fmtFixed(tk.dimension?.cpk, 2), <Delta key="1" a={kpis.dimension?.cpk ?? NaN} b={tk.dimension?.cpk ?? NaN} up />],
                ['Ppk observé', fmtFixed(kpis.dimension?.ppk, 2), fmtFixed(tk.dimension?.ppk, 2), <Delta key="2" a={kpis.dimension?.ppk ?? NaN} b={tk.dimension?.ppk ?? NaN} up />],
                ['Pièces hors tolérance', fmt(kpis.dimensionNc, 0), fmt(tk.dimensionNc, 0), <Delta key="3" a={kpis.dimensionNc} b={tk.dimensionNc} />],
                ['Rebuts totaux', fmt(kpis.scrap, 0), fmt(tk.scrap, 0), <Delta key="4" a={kpis.scrap} b={tk.scrap} />],
                ['Pièces bonnes / jour', fmt(kpis.good, 0), fmt(tk.good, 0), <Delta key="5" a={kpis.good} b={tk.good} up />],
                ['Débit', `${fmt(kpis.throughputPerHour, 1)} pcs/h`, `${fmt(tk.throughputPerHour, 1)} pcs/h`, <Delta key="6" a={kpis.throughputPerHour} b={tk.throughputPerHour} up />],
              ]}
            />
          </Card>
        </div>
        <Card title="Modèle statistique (paramètres avancés)" className="xl:col-span-12">
          <div className="mb-3 rounded-lg bg-black/[.03] p-3 font-mono text-[12px] leading-relaxed dark:bg-white/[.05]">
            Y = μ₀ + b_T·(T − T_ref) + b_P·(P − P_ref) + b_V·(V − V_ref) + b_TV·(T − T_ref)(V − V_ref)/1000 + δ_lot + u·k + ε<br />
            T, P, V ~ N(consigne, σ_régulation) · δ_lot ~ N(0, σ_lot) à chaque changement de série · ε ~ N(0, σ_e·(V/V_ref)^γ) · k = rang de la pièce dans le lot
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Field label="Poste CTQ">
              <Select value={m.stationId} onChange={(e) => set((s) => (s.process.stationId = e.target.value))}>
                {sc.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`LSL (${c.unit})`}>
              <NumberInput value={c.lsl} step={0.005} onChange={(v) => set((s) => (s.process.characteristic.lsl = v))} />
            </Field>
            <Field label={`Nominal (${c.unit})`}>
              <NumberInput value={c.nominal} step={0.005} onChange={(v) => set((s) => (s.process.characteristic.nominal = v))} />
            </Field>
            <Field label={`USL (${c.unit})`}>
              <NumberInput value={c.usl} step={0.005} onChange={(v) => set((s) => (s.process.characteristic.usl = v))} />
            </Field>
            <Field label="μ₀ (moyenne de référence)">
              <NumberInput value={m.baseMean} step={0.001} onChange={(v) => set((s) => (s.process.baseMean = v))} />
            </Field>
            <Field label="σ_e répétabilité">
              <NumberInput value={m.residualSd} min={0} step={0.0005} onChange={(v) => set((s) => (s.process.residualSd = v))} />
            </Field>
            <Field label="b_T (mm/°C)">
              <NumberInput value={m.coefficients.temperature} step={0.0005} onChange={(v) => set((s) => (s.process.coefficients.temperature = v))} />
            </Field>
            <Field label="b_P (mm/bar)">
              <NumberInput value={m.coefficients.pressure} step={0.0002} onChange={(v) => set((s) => (s.process.coefficients.pressure = v))} />
            </Field>
            <Field label="b_V (mm/(tr/min))">
              <NumberInput value={m.coefficients.speed} step={0.000002} onChange={(v) => set((s) => (s.process.coefficients.speed = v))} />
            </Field>
            <Field label="b_TV (interaction)">
              <NumberInput value={m.interactionTV} step={0.0005} onChange={(v) => set((s) => (s.process.interactionTV = v))} />
            </Field>
            <Field label="σ_lot (entre lots)">
              <NumberInput value={m.batchSd} min={0} step={0.0005} onChange={(v) => set((s) => (s.process.batchSd = v))} />
            </Field>
            <Field label="u usure / pièce">
              <NumberInput value={m.toolWearPerPart} min={0} step={0.00001} onChange={(v) => set((s) => (s.process.toolWearPerPart = v))} />
            </Field>
          </div>
          <div className="mt-3">
            <Note>
              Le modèle est volontairement explicite et documenté : les mêmes équations génèrent chaque pièce dans la simulation, alimentent le DOE et la prédiction analytique. Augmenter la vitesse raccourcit le temps de cycle du poste CTQ (gain Lean) mais dégrade la répétabilité (perte Six Sigma) : c'est l'arbitrage à optimiser.
            </Note>
          </div>
        </Card>
      </div>
    </div>
  )
}

/** Courbes de Gauss avant / après avec limites de tolérance, ±3σ et ±6σ du réglage testé. */
function NormalCurves({ before, after, lsl, usl, target, unit }: { before: { mean: number; sd: number }; after: { mean: number; sd: number }; lsl: number; usl: number; target: number; unit: string }) {
  const sdA = Math.max(after.sd, 1e-9)
  const sdB = Math.max(before.sd, 1e-9)
  const lo = Math.min(lsl, after.mean - 6.5 * sdA, before.mean - 4 * sdB)
  const hi = Math.max(usl, after.mean + 6.5 * sdA, before.mean + 4 * sdB)
  const N = 240
  const data = Array.from({ length: N + 1 }, (_, i) => {
    const x = lo + ((hi - lo) * i) / N
    return { x, avant: normalPdf(x, before.mean, sdB), apres: normalPdf(x, after.mean, sdA) }
  })
  const out = (m: number, sd: number) => (normalCdf((lsl - m) / sd) + 1 - normalCdf((usl - m) / sd)) * 1e6
  const z = Math.min(usl - after.mean, after.mean - lsl) / sdA
  const room = (usl - lsl) / 2 / sdA
  const f = (v: number) => fmtFixed(v, 3)
  return (
    <Card
      title="Courbe de normalité — où sont les limites en nombre de σ ?"
      subtitle={`Réglage testé : moyenne ${f(after.mean)} ${unit}, σ ${fmtFixed(sdA * 1000, 1)} µm · Z (limite la plus proche) = ${fmtFixed(z, 2)} σ · demi-tolérance = ${fmtFixed(room, 2)} σ`}
    >
      <ChartBox height={250}>
        <LineChart data={data} margin={{ top: 18, right: 16, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="x" type="number" domain={[lo, hi]} tickFormatter={(v) => f(Number(v))} {...axisProps} />
          <YAxis {...axisProps} tick={false} />
          <ReferenceArea x1={lo} x2={lsl} fill="var(--critical)" fillOpacity={0.06} />
          <ReferenceArea x1={usl} x2={hi} fill="var(--critical)" fillOpacity={0.06} />
          {[-6, -3, 3, 6].map((k) => (
            <ReferenceLine key={k} x={after.mean + k * sdA} stroke="var(--muted)" strokeDasharray={Math.abs(k) === 6 ? '2 4' : '5 4'} label={{ value: `${k > 0 ? '+' : ''}${k}σ`, position: 'top', fill: 'var(--muted)', fontSize: 10 }} />
          ))}
          <ReferenceLine x={lsl} stroke="var(--critical)" strokeWidth={2} label={{ value: 'LSL', position: 'insideTopLeft', fill: 'var(--critical)', fontSize: 11 }} />
          <ReferenceLine x={usl} stroke="var(--critical)" strokeWidth={2} label={{ value: 'USL', position: 'insideTopRight', fill: 'var(--critical)', fontSize: 11 }} />
          <ReferenceLine x={target} stroke="var(--good)" strokeDasharray="3 3" />
          <Tooltip {...tooltipStyle} labelFormatter={(v) => `${f(Number(v))} ${unit}`} formatter={(v, n) => [fmt(Number(v), 1), n === 'apres' ? 'Réglage testé' : 'Actuel']} />
          <Legend verticalAlign="bottom" height={22} formatter={(v) => (v === 'apres' ? 'Réglage testé' : 'Actuel')} />
          <Line dataKey="avant" stroke="var(--muted)" strokeDasharray="4 3" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line dataKey="apres" stroke={S(0)} dot={false} strokeWidth={2.5} isAnimationActive={false} />
        </LineChart>
      </ChartBox>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        Hors tolérance attendu : actuel <b>{fmt(out(before.mean, sdB), 0)} ppm</b> → réglage testé <b>{fmt(out(after.mean, sdA), 0)} ppm</b>. Un procédé « six sigma » a ±6σ à l'intérieur des limites (demi-tolérance ≥ 6σ) ; « trois sigma » si les limites tombent à ±3σ. Ici, les limites sont à {fmtFixed(room, 1)}σ de part et d'autre d'un procédé centré, et la plus proche est à {fmtFixed(z, 1)}σ de la moyenne réelle.
      </p>
    </Card>
  )
}

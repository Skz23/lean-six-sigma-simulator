import { useEffect, useState } from 'react'
import { Target } from 'lucide-react'
import { useMeasurements } from '../../components/DataSource'
import { capability, interpretCapability, verdict } from '../../stats/capability'
import { andersonDarling } from '../../stats/inference'
import { summarize } from '../../stats/descriptive'
import { Badge, Card, Empty, Field, Note, NumberInput, PageHeader, Select, Stat, Table, Toggle } from '../../components/ui'
import { CapabilityHistogram } from '../../components/charts'
import { fmt, fmtFixed } from '../../lib/format'
import { boxCox, cpm, findBoxCoxLambda, taguchiLoss, transformSpec } from '../../stats/advanced'
import { eur } from '../../lib/format'

export default function CapabilityPage() {
  const { values, ui, sc, kind, spec: srcSpec, subgroupSize } = useMeasurements()
  const c0 = sc.process.characteristic
  const c = { ...c0, name: srcSpec?.name || c0.name, unit: srcSpec?.unit || c0.unit }
  const [spec, setSpec] = useState<{ lsl?: number; usl?: number; target?: number }>({ lsl: c0.lsl, usl: c0.usl, target: c0.nominal })
    const [useLsl, setUseLsl] = useState(true)
  const [useUsl, setUseUsl] = useState(true)
  const [n, setN] = useState(5)
  // Spécification et taille de sous-groupe reprises de la source choisie
  useEffect(() => {
    if (srcSpec) {
      setSpec({ lsl: srcSpec.lsl, usl: srcSpec.usl, target: srcSpec.target ?? (srcSpec.lsl !== undefined && srcSpec.usl !== undefined ? (srcSpec.lsl + srcSpec.usl) / 2 : undefined) })
      setUseLsl(srcSpec.lsl !== undefined)
      setUseUsl(srcSpec.usl !== undefined)
    }
    if (subgroupSize) setN(subgroupSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])
  const [forceNormal, setForceNormal] = useState(false)
  // Convention : internationale (ISO 22514 / Minitab) ou française (cours ENSGSI / AFNOR : Cm-Cmk machine, Cp-Cpk processus)
  const [conv, setConvState] = useState<'intl' | 'fr'>(() => {
    try {
      return (localStorage.getItem('lss-cap-convention') as 'intl' | 'fr') || 'fr'
    } catch {
      return 'fr'
    }
  })
  const setConv = (v: 'intl' | 'fr') => {
    setConvState(v)
    try {
      localStorage.setItem('lss-cap-convention', v)
    } catch {
      /* ignoré */
    }
  }
  const [lossCost, setLossCost] = useState(sc.costs.materialCost)
  const s = { lsl: useLsl ? spec.lsl : undefined, usl: useUsl ? spec.usl : undefined, target: spec.target }

  const enough = values.length >= Math.max(10, n * 3)
  const r = enough ? capability(values, s, n) : null
  const ad = enough ? andersonDarling(values) : null
  const sum = enough ? summarize(values) : null
  const showNormal = !!ad && (ad.normal || forceNormal)
  const digits = 4

  const frTone = (v: number | undefined, machine: boolean) => {
    if (v === undefined) return undefined
    const [ok, mid] = machine ? [2, 1.33] : [1.33, 1]
    return v >= ok ? 'good' : v >= mid ? 'warning' : 'critical'
  }
  const frLabel = (v: number | undefined, machine: boolean) => {
    if (v === undefined) return ''
    const [ok, mid] = machine ? [2, 1.33] : [1.33, 1]
    return v >= ok ? 'capable' : v >= mid ? 'juste capable' : 'non capable'
  }
  const vTone = (v?: number) => {
    const x = verdict(v)
    return x === 'excellent' || x === 'capable' ? 'good' : x === 'limite' ? 'warning' : 'critical'
  }

  return (
    <div>
      <PageHeader icon={<Target size={20} />} title="Capabilité des processus" subtitle="Capabilité court terme (machine) et long terme (processus) — limites de spécification = voix du client" />
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <Card title="Données et spécifications">
            <div className="space-y-3">
              {ui}
              <div className="grid grid-cols-3 gap-2">
                <Field label={<Toggle checked={useLsl} onChange={setUseLsl} label="LSL" />}>
                  <NumberInput value={spec.lsl ?? 0} step={0.005} onChange={(v) => setSpec({ ...spec, lsl: v })} />
                </Field>
                <Field label="Cible">
                  <NumberInput value={spec.target ?? 0} step={0.005} onChange={(v) => setSpec({ ...spec, target: v })} />
                </Field>
                <Field label={<Toggle checked={useUsl} onChange={setUseUsl} label="USL" />}>
                  <NumberInput value={spec.usl ?? 0} step={0.005} onChange={(v) => setSpec({ ...spec, usl: v })} />
                </Field>
              </div>
              <Field label="Taille des sous-groupes rationnels" hint="Sert à estimer σ intra (court terme) : R̄/d₂, ou MR̄/1,128 si n = 1">
                <Select value={n} onChange={(e) => setN(+e.target.value)}>
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((k) => (
                    <option key={k} value={k}>
                      n = {k}
                    </option>
                  ))}
                </Select>
              </Field>
              {kind === 'sim' && <p className="text-[11px] text-[var(--muted)]">Spécification du scénario : {c0.lsl} – {c0.usl} {c0.unit}</p>}
            </div>
          </Card>
          {sum && (
            <Card title="Statistiques descriptives">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="n" value={sum.n} />
                <Stat label="Moyenne" value={fmtFixed(sum.mean, digits)} />
                <Stat label="Écart-type (n−1)" value={fmtFixed(sum.stdDev, digits + 1)} />
                <Stat label="Variance" value={sum.variance.toExponential(3)} />
                <Stat label="Min / Max" value={`${fmtFixed(sum.min, 3)} / ${fmtFixed(sum.max, 3)}`} />
                <Stat label="Médiane" value={fmtFixed(sum.median, digits)} />
                <Stat label="Asymétrie" value={fmtFixed(sum.skewness, 3)} />
                <Stat label="Aplatissement" value={fmtFixed(sum.kurtosis, 3)} />
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-4 xl:col-span-8">
          {!r || !ad || !sum ? (
            <Card>
              <Empty>Au moins {Math.max(10, n * 3)} valeurs sont nécessaires.</Empty>
            </Card>
          ) : (
            <>
              <Card
                title="Histogramme et distribution"
                subtitle={showNormal ? 'Courbes normales ajustées : σ global (long terme) et σ intra (court terme)' : 'Courbe normale masquée : normalité rejetée (Anderson-Darling)'}
                actions={!ad.normal && <Toggle checked={forceNormal} onChange={setForceNormal} label={<span className="text-xs">Forcer la courbe</span>} />}
              >
                <CapabilityHistogram values={values} lsl={s.lsl} usl={s.usl} target={s.target} mean={r.mean} sigma={r.sigmaOverall} sigmaWithin={r.sigmaWithin} showNormal={showNormal} unit={c.unit} />
                <div className="mt-2">
                  <Note tone={ad.normal ? 'info' : 'warning'} title={`Test de normalité d'Anderson-Darling : A² = ${fmtFixed(ad.ad, 3)}`}>
                    {ad.conclusion}
                  </Note>
                </div>
              </Card>
              <Card bodyClass="flex flex-wrap items-center gap-3 p-3">
                <span className="text-sm text-[var(--text-secondary)]">Convention</span>
                <Select value={conv} onChange={(e) => setConv(e.target.value as 'intl' | 'fr')} className="w-96">
                  <option value="fr">Française (cours ENSGSI / AFNOR) : Cm, Cmk machine · Cp, Cpk processus</option>
                  <option value="intl">Internationale (ISO 22514 / Minitab) : Cp, Cpk · Pp, Ppk</option>
                </Select>
                <span className="text-xs text-[var(--muted)]">Mêmes calculs, noms et seuils différents.</span>
              </Card>
              {conv === 'fr' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card title="Capabilité machine — dispersion instantanée" subtitle={`σ instantané = ${fmtFixed(r.sigmaWithin, 5)} (${n > 1 ? `R̄/d₂, n = ${n}` : 'MR̄/1,128'}) · contexte 4M figé, court terme`}>
                    <div className="grid grid-cols-2 gap-2">
                      <IndexTile name="Cm" v={r.cp} tone={frTone(r.cp, true)} label={frLabel(r.cp, true)} desc="IT / 6σ instantané" />
                      <IndexTile name="Cmk" v={r.cpk} tone={frTone(r.cpk, true)} label={frLabel(r.cpk, true)} desc="Centrage machine" />
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">Objectif du cours : Cm et Cmk &gt; 2.</p>
                  </Card>
                  <Card title="Capabilité processus — dispersion globale" subtitle={`σ global = ${fmtFixed(r.sigmaOverall, 5)} · production « normale », moyen terme (5M)`}>
                    <div className="grid grid-cols-2 gap-2">
                      <IndexTile name="Cp" v={r.pp} tone={frTone(r.pp, false)} label={frLabel(r.pp, false)} desc="IT / 6σ global" />
                      <IndexTile name="Cpk" v={r.ppk} tone={frTone(r.ppk, false)} label={frLabel(r.ppk, false)} desc="Centrage processus" />
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">Cpk &lt; 1 : non capable · = 1 : juste capable · &gt; 1,33 : capable (objectif amélioration : &gt; 1,66). PPM attendus : {fmt(r.ppmOverall, 0)}.</p>
                  </Card>
                </div>
              ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Card title="Capabilité — court terme (within)" subtitle={`σ intra = ${fmtFixed(r.sigmaWithin, 5)} (${n > 1 ? `R̄/d₂, n = ${n}` : 'MR̄/1,128'})`}>
                  <div className="grid grid-cols-2 gap-2">
                    <IndexTile name="Cp" v={r.cp} tone={vTone(r.cp)} desc="Potentiel si centré" />
                    <IndexTile name="Cpk" v={r.cpk} tone={vTone(r.cpk)} desc="Capabilité réelle" />
                    <IndexTile name="CPL" v={r.cpl} desc="(μ − LSL) / 3σ" />
                    <IndexTile name="CPU" v={r.cpu} desc="(USL − μ) / 3σ" />
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">PPM attendus (court terme) : {fmt(r.ppmWithin, 0)} · Z.bench : {fmtFixed(r.zBenchWithin, 2)}</p>
                </Card>
                <Card title="Performance — long terme (overall)" subtitle={`σ global = ${fmtFixed(r.sigmaOverall, 5)} (écart-type de toutes les valeurs)`}>
                  <div className="grid grid-cols-2 gap-2">
                    <IndexTile name="Pp" v={r.pp} tone={vTone(r.pp)} desc="Potentiel long terme" />
                    <IndexTile name="Ppk" v={r.ppk} tone={vTone(r.ppk)} desc="Performance réelle" />
                    <IndexTile name="PPL" v={r.ppl} desc="(μ − LSL) / 3σ" />
                    <IndexTile name="PPU" v={r.ppu} desc="(USL − μ) / 3σ" />
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">PPM attendus (long terme) : {fmt(r.ppmOverall, 0)} · Z.bench : {fmtFixed(r.zBenchOverall, 2)}</p>
                </Card>
              </div>
              )}
              {s.lsl !== undefined && s.usl !== undefined && s.target !== undefined && (
                <Card title="Centrage sur la cible (Taguchi)" subtitle="Toute pièce éloignée de la cible coûte, même dans la tolérance">
                  <div className="grid gap-3 md:grid-cols-4">
                    <Stat label="Cpm" value={fmtFixed(cpm(values, s.lsl, s.usl, s.target), 2)} sub="IT / 6√(σ² + (x̄ − cible)²)" />
                    <Stat label="Écart moyenne − cible" value={`${fmtFixed(r.mean - s.target, 4)} ${c.unit}`} />
                    <Field label="Coût d'une pièce à la limite"><NumberInput value={lossCost} min={0} step={1} suffix="€" onChange={setLossCost} /></Field>
                    <Stat label="Perte moyenne par pièce" value={eur(taguchiLoss(values, s.target, (s.usl - s.lsl) / 2, lossCost), 2)} sub="k·(σ² + écart²), k = coût / (IT/2)²" />
                  </div>
                </Card>
              )}
              {!ad.normal && <BoxCoxCard values={values} lsl={s.lsl} usl={s.usl} />}
              <Card title="Interprétation automatique">
                <ul className="space-y-2 text-sm">
                  {interpretCapability(r, s)
                    .map((m) => (conv === 'fr' ? m.replace(/\bPpk\b/g, '§PPK').replace(/\bPp\b/g, '§PP').replace(/\bCpk\b/g, 'Cmk').replace(/\bCp\b/g, 'Cm').replace(/§PPK/g, 'Cpk').replace(/§PP/g, 'Cp') : m))
                    .map((m) => (
                    <li key={m} className="flex gap-2">
                      <span className="text-brand-600">•</span>
                      {m}
                    </li>
                  ))}
                </ul>
                <Table
                  className="mt-3"
                  dense
                  head={['Non-conformes', 'Observés', 'Attendus court terme', 'Attendus long terme']}
                  rows={[['PPM', fmt(r.ppmObserved, 0), fmt(r.ppmWithin, 0), fmt(r.ppmOverall, 0)]]}
                />
                <p className="mt-2 text-[11px] text-[var(--muted)]">
                  Niveau sigma = Z.bench long terme + 1,5 (convention Motorola) = <b>{fmtFixed(r.sigmaLevel, 2)}</b>. Repères : Cpk ≥ 1,33 capable · ≥ 1,67 excellent · Six Sigma ≈ Cpk 2,0.
                </p>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function IndexTile({ name, v, tone, desc, label }: { name: string; v?: number; tone?: 'good' | 'warning' | 'critical'; desc: string; label?: string }) {
  return (
    <div className="rounded-lg bg-black/[.03] px-3 py-2 dark:bg-white/[.05]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{name}</span>
        {tone && v !== undefined && <Badge tone={tone}>{label ?? verdict(v)}</Badge>}
      </div>
      <div className="text-xl font-semibold tabular">{v === undefined ? '—' : fmtFixed(v, 2)}</div>
      <div className="text-[10px] text-[var(--muted)]">{desc}</div>
    </div>
  )
}

/** Données non normales : transformation de Box-Cox puis capabilité sur données transformées. */
function BoxCoxCard({ values, lsl, usl }: { values: number[]; lsl?: number; usl?: number }) {
  if (values.some((v) => !(v > 0)))
    return <Note tone="warning" title="Données non normales">Box-Cox impossible (valeurs nulles ou négatives) : se fier aux PPM observés, ou rechercher un mélange de populations (deux machines, deux lots…).</Note>
  const bc = findBoxCoxLambda(values)
  const t = values.map((v) => boxCox(v, bc.rounded))
  const ts = transformSpec(lsl, usl, bc.rounded)
  const r = capability(t, ts, 1)
  const ad = andersonDarling(t)
  return (
    <Card title="Données non normales : transformation de Box-Cox" subtitle="Cours MMI2 : transformer les données (et les tolérances) pour retrouver une loi normale">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="λ optimal" value={fmtFixed(bc.lambda, 3)} sub={`retenu : ${bc.rounded} (${bc.label})`} />
        <Stat label="Normalité après transformation" value={ad.normal ? 'acceptée' : 'toujours rejetée'} sub={`p = ${fmtFixed(ad.pValue, 3)}`} />
        <Stat label="Ppk (données transformées)" value={fmtFixed(r.ppk, 2)} />
        <Stat label="PPM attendus (transformées)" value={fmt(r.ppmOverall, 0)} />
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">{ad.normal ? 'La transformation rend les données compatibles avec la loi normale : les indices ci-dessus sont plus fiables que ceux calculés sur les données brutes.' : 'Même transformées, les données ne sont pas normales : utiliser les PPM observés et chercher la cause (mélange de populations, troncature par un tri…).'}</p>
    </Card>
  )
}

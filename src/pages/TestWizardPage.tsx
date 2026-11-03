import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, CircleHelp, FlaskConical, Info, Sparkles } from 'lucide-react'
import { useActiveScenario, useStore } from '../store/useStore'
import { runScenario } from '../store/useSimulation'
import { Badge, Button, Card, Field, Note, NumberInput, PageHeader, TextArea, Toggle } from '../components/ui'
import { BoxPlot } from '../components/BoxPlot'
import { pEq, type TestResult } from '../stats/inference'
import { parseColumns, parseTable, runWizard, type Goal } from '../stats/wizard'

const GOALS: { id: Goal; title: string; ex: string; data: string }[] = [
  { id: 'means', title: 'Comparer des groupes', ex: 'La moyenne diffère-t-elle entre machines, équipes, lots, avant / après ?', data: 'Une colonne par groupe.' },
  { id: 'target', title: 'Comparer à une valeur cible', ex: 'Le procédé est-il centré sur le nominal ?', data: 'Une colonne de mesures + la cible.' },
  { id: 'variances', title: 'Comparer des dispersions', ex: 'Une machine est-elle plus dispersée que les autres ?', data: 'Une colonne par groupe.' },
  { id: 'relation', title: 'Lien entre deux mesures', ex: 'La température influence-t-elle le diamètre ?', data: 'Deux colonnes : X (facteur) puis Y (résultat).' },
  { id: 'categorical', title: 'Lien entre deux catégories', ex: 'Le type de défaut dépend-il de l\'équipe ?', data: 'Un tableau d\'effectifs (lignes × colonnes).' },
]

const ALGO: Record<Goal, string[]> = {
  means: ['Normalité de chaque groupe (Anderson-Darling)', 'Égalité des variances (Fisher / Bartlett, ou Levene si non normal)', '2 groupes : test t (ou Welch) — sinon Mann-Whitney', '3 groupes et plus : ANOVA — sinon Kruskal-Wallis', 'Appariées : test t apparié — sinon Wilcoxon', 'Conclure en termes pratiques'],
  target: ['Normalité (Anderson-Darling)', 'Normal : test t à un échantillon — sinon Wilcoxon', 'Conclure : centré ou décentré ?'],
  variances: ['Normalité de chaque groupe', 'Normal : Fisher (2 groupes) ou Bartlett (3+)', 'Non normal : Levene', 'Conclure : quel groupe est le plus dispersé ?'],
  relation: ['Nuage de points et droite de régression', 'Normalité des résidus', 'Test de la corrélation (Pearson) — confirmé par Spearman si résidus non normaux', 'Conclure (corrélation ≠ causalité)'],
  categorical: ['Tableau de contingence', 'Effectifs attendus ≥ 5', 'Test du khi² d\'indépendance', 'Conclure'],
}

function TestCard({ t }: { t: TestResult }) {
  return (
    <div className="rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{t.name}</b>
        <Badge tone={t.reject ? 'critical' : 'good'}>{t.reject ? 'H0 rejetée' : 'H0 non rejetée'}</Badge>
      </div>
      <div className="mt-1 text-xs text-[var(--text-secondary)]">
        {t.statisticName} = {Number.isFinite(t.statistic) ? t.statistic.toFixed(4).replace('.', ',') : '—'}
        {t.df !== undefined && ` · ddl ${Math.round(t.df * 10) / 10}${t.df2 !== undefined ? ` ; ${t.df2}` : ''}`} · {pEq(t.pValue)}
      </div>
      <p className="mt-1">{t.conclusion}</p>
    </div>
  )
}

export default function TestWizardPage() {
  const sc = useActiveScenario()
  const scenarios = useStore((s) => s.scenarios)
  const [goal, setGoal] = useState<Goal>('means')
  const [text, setText] = useState('')
  const [paired, setPaired] = useState(false)
  const [target, setTarget] = useState(sc.process.characteristic.nominal)
  const [alpha, setAlpha] = useState(0.05)

  const example = () => {
    const prods = runScenario(sc).results.products.filter((p) => p.dimension !== undefined)
    const r = (x: number) => x.toFixed(4)
    if (goal === 'means' || goal === 'variances') {
      if (paired) {
        const other = scenarios.find((s) => s.kind === 'sixsigma') ?? sc
        const b = runScenario(other).results.products.filter((p) => p.dimension !== undefined)
        const n = Math.min(25, prods.length, b.length)
        setText(['Avant\tAprès', ...Array.from({ length: n }, (_, i) => `${r(prods[i].dimension!)}\t${r(b[i].dimension!)}`)].join('\n'))
        return
      }
      const lots = [...new Set(prods.map((p) => p.batch))].sort((a, b) => a - b).slice(0, 4)
      const cols = lots.map((l) => prods.filter((p) => p.batch === l).slice(0, 25).map((p) => p.dimension!))
      const n = Math.max(...cols.map((c) => c.length))
      setText([lots.map((l) => `Lot ${l + 1}`).join('\t'), ...Array.from({ length: n }, (_, i) => cols.map((c) => (c[i] !== undefined ? r(c[i]) : '')).join('\t'))].join('\n'))
    } else if (goal === 'target') {
      setTarget(sc.process.characteristic.nominal)
      setText(['Diamètre', ...prods.slice(0, 40).map((p) => r(p.dimension!))].join('\n'))
    } else if (goal === 'relation') {
      setText(['Température\tDiamètre', ...prods.filter((p) => p.params).slice(0, 80).map((p) => `${p.params!.temperature.toFixed(2)}\t${r(p.dimension!)}`)].join('\n'))
    } else {
      setText(['\tDiamètre\tRayure\tBavure', 'Équipe matin\t32\t14\t9', 'Équipe après-midi\t21\t12\t10', 'Équipe nuit\t45\t9\t6'].join('\n'))
    }
  }

  const groups = useMemo(() => parseColumns(text), [text])
  const result = useMemo(() => {
    if (!text.trim()) return null
    return runWizard({ goal, groups, paired, target, alpha, table: goal === 'categorical' ? parseTable(text).table : undefined })
  }, [goal, groups, paired, target, alpha, text])

  return (
    <div>
      <PageHeader icon={<FlaskConical size={20} />} title="Quel test ? — assistant statistique" subtitle="Vous dites ce que vous voulez savoir et collez vos données : l'appli vérifie les conditions, choisit le test et conclut" />
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <Card title="1. Que voulez-vous savoir ?">
            <div className="space-y-2">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setGoal(g.id)
                    setText('')
                  }}
                  className={clsx('w-full rounded-lg border-2 p-2.5 text-left transition-colors', goal === g.id ? 'border-brand-500 bg-brand-500/10' : 'border-transparent ring-1 ring-black/[.08] hover:ring-black/20 dark:ring-white/10')}
                >
                  <div className="text-sm font-semibold">{g.title}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{g.ex}</div>
                </button>
              ))}
            </div>
          </Card>
          <Card title="2. Vos données" subtitle={GOALS.find((g) => g.id === goal)!.data} actions={<Button size="sm" onClick={example}><Sparkles size={13} /> Exemple</Button>}>
            <div className="space-y-3">
              <TextArea
                rows={9}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={goal === 'categorical' ? '\tDéfaut A\tDéfaut B\nÉquipe 1\t12\t5\nÉquipe 2\t8\t9' : goal === 'relation' ? 'Température\tDiamètre\n35,2\t25,012\n…' : 'Machine 1\tMachine 2\n25,012\t25,031\n…'}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-[var(--muted)]">Copiez les colonnes depuis Excel et collez-les ici. La première ligne peut contenir les noms des groupes.</p>
              {goal === 'means' && (
                <Toggle checked={paired} onChange={setPaired} label={<span className="text-sm">Données appariées (mêmes pièces mesurées deux fois, avant / après sur les mêmes éléments)</span>} />
              )}
              <div className="flex flex-wrap gap-3">
                {goal === 'target' && (
                  <Field label="Valeur cible" className="w-40">
                    <NumberInput value={target} step={0.001} onChange={setTarget} />
                  </Field>
                )}
                <Field label="Risque α" className="w-32">
                  <NumberInput value={alpha} min={0.001} max={0.2} step={0.01} onChange={setAlpha} />
                </Field>
              </div>
              {groups.length > 0 && goal !== 'categorical' && (
                <div className="flex flex-wrap gap-1">
                  {groups.map((g) => <Badge key={g.name}>{g.name} : {g.values.length} valeurs</Badge>)}
                </div>
              )}
            </div>
          </Card>
          <Card title="L'algorithme suivi">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
              {ALGO[goal].map((a) => <li key={a}>{a}</li>)}
            </ol>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-7">
          {!result ? (
            <Card title="3. Résultat">
              <p className="text-sm text-[var(--muted)]">Collez vos données (ou cliquez sur « Exemple ») : le raisonnement s'affiche ici, étape par étape.</p>
            </Card>
          ) : result.error ? (
            <Note tone="warning" title="Données insuffisantes">{result.error}</Note>
          ) : (
            <>
              <Card title="3. Le raisonnement, étape par étape">
                <ol className="space-y-2.5">
                  {result.steps.map((s, i) => (
                    <li key={i} className={clsx('flex gap-2.5 rounded-lg p-2.5', s.status === 'key' ? 'bg-brand-500/10' : 'bg-black/[.025] dark:bg-white/[.04]')}>
                      <span className="mt-0.5 shrink-0">
                        {s.status === 'ok' && <CheckCircle2 size={17} className="text-[var(--good)]" />}
                        {s.status === 'warn' && <AlertTriangle size={17} className="text-amber-500" />}
                        {s.status === 'info' && <Info size={17} className="text-blue-500" />}
                        {s.status === 'key' && <CircleHelp size={17} className="text-brand-600" />}
                      </span>
                      <div className="min-w-0 text-sm">
                        <div className="font-semibold">{i + 1}. {s.title}</div>
                        <div className="text-[var(--text-secondary)]">{s.question} → <b className="text-[var(--text-primary)]">{s.answer}</b></div>
                        {s.detail && <div className="mt-0.5 text-xs text-[var(--muted)]">{s.detail}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
              <Card title="4. Conclusion">
                <p className={clsx('text-base font-semibold', result.main?.reject ? 'text-[var(--critical)]' : 'text-[var(--good-text)]')}>{result.verdict}</p>
                <p className="mt-1 text-sm">{result.practical}</p>
                <div className="mt-3 space-y-2">
                  {result.main && <TestCard t={result.main} />}
                  {result.extra?.map((t) => <TestCard key={t.name} t={t} />)}
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Pensez à noter ce résultat dans la page de la phase (« Résultat à retenir ») et, s'il confirme une cause, à la cocher « vérifiée » en 3.4 avec cette preuve.
                </p>
              </Card>
              {(goal === 'means' || goal === 'variances') && !paired && groups.length >= 2 && (
                <Card title="Boîtes à moustaches">
                  <BoxPlot groups={groups.map((g) => ({ name: g.name, values: g.values }))} />
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useUrlTab } from '../lib/useUrlTab'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { CartesianGrid, LabelList, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { Compass, Plus, Trash2, Trophy } from 'lucide-react'
import { useStore, uid } from '../store/useStore'
import type { KanoItem, MrpMethod, MrpState, ProblemSheet } from '../store/types'
import { KANO_LABEL, kanoClassify, kanoSummary, type KanoAnswer } from '../stats/advanced'
import { Badge, Button, Card, Field, Input, Note, NumberInput, PageHeader, Select, Table, Tabs, TextArea } from '../components/ui'
import { ChartBox, S, axisProps, tooltipStyle } from '../components/charts'
import { ask } from '../lib/dialog'
import { fmt, pct } from '../lib/format'

const TABS = ['choose', 'qqoqcpc', '8d', 'a3', 'ideas', 'vote', 'kano'] as const
type Tab = (typeof TABS)[number]

const METHODS: Record<MrpMethod, { name: string; when: string; duration: string; steps: string }> = {
  kaizen: { name: 'Kaizen / PDCA', when: 'Solution connue a priori, problème simple et local.', duration: 'Une journée', steps: 'Plan · Do · Check · Act' },
  a3: { name: 'A3 (Toyota, PSA)', when: 'Solution trouvable par le groupe de travail ; besoin de synthèse sur une page.', duration: 'Quelques jours à semaines', steps: 'Contexte → situation actuelle → objectif → causes → contre-mesures → plan → suivi → standard' },
  '8d': { name: '8D (Ford)', when: 'Problème qualité, souvent réclamation client : il faut d\'abord protéger le client (confinement).', duration: 'Quelques semaines', steps: 'D0 à D8' },
  dmaic: { name: 'DMAIC (Six Sigma)', when: 'Solution inconnue a priori, problème de variabilité, données disponibles : il faut relier les causes X à l\'effet Y par les statistiques.', duration: 'Quelques mois', steps: 'Define · Measure · Analyze · Improve · Control' },
  projet: { name: 'Management de projet', when: 'Problème stratégique ou transverse (ex. mise en place d\'un ERP).', duration: 'Une année', steps: 'Cadrage, jalons, comité de pilotage' },
}

const QQ: { key: keyof ProblemSheet['qqoqcpc']; label: string; hint: string }[] = [
  { key: 'quoi', label: 'Quoi ?', hint: 'De quoi s\'agit-il ? Quel est le problème, l\'objet, l\'action ?' },
  { key: 'qui', label: 'Qui ?', hint: 'Qui est concerné, impliqué, responsable ?' },
  { key: 'ou', label: 'Où ?', hint: 'Lieu, poste, étape du processus' },
  { key: 'quand', label: 'Quand ?', hint: 'Moment, durée, fréquence, depuis quand ?' },
  { key: 'comment', label: 'Comment ?', hint: 'Sous quelle forme, avec quels moyens, comment est-il détecté ?' },
  { key: 'pourquoi', label: 'Pourquoi ?', hint: 'Pourquoi est-ce un problème ? Quel impact ?' },
  { key: 'combien', label: 'Combien ?', hint: 'Nombre, coût, fréquence chiffrée' },
]

const D8 = [
  ['D0', 'Préparer et réagir', 'Symptômes, urgence : faut-il lancer un 8D ? Actions d\'urgence immédiates.'],
  ['D1', 'Constituer l\'équipe', 'Pilote, membres pluridisciplinaires, sponsor.'],
  ['D2', 'Décrire le problème', 'QQOQCPC, données, indicateur.'],
  ['D3', 'Actions de confinement', 'Protéger le client : tri, blocage des stocks, contrôle renforcé.'],
  ['D4', 'Identifier les causes racines', 'Cause d\'apparition ET cause de non-détection (Ishikawa, 5 Pourquoi, vérification par les données).'],
  ['D5', 'Choisir les actions correctives permanentes', 'Vérifier qu\'elles éliminent la cause sans effet secondaire.'],
  ['D6', 'Mettre en œuvre et valider', 'Déployer, retirer le confinement, mesurer l\'indicateur avant / après.'],
  ['D7', 'Prévenir la récurrence', 'Standardiser, mettre à jour AMDEC et plans de contrôle, généraliser aux produits similaires.'],
  ['D8', 'Féliciter l\'équipe', 'Reconnaître le travail, capitaliser le retour d\'expérience.'],
]

const A3 = [
  ['contexte', '1. Contexte', 'Pourquoi traiter ce sujet ? Enjeu pour l\'entreprise.'],
  ['actuel', '2. Situation actuelle', 'Faits, chiffres, schéma du processus, indicateur.'],
  ['objectif', '3. Objectif', 'Cible mesurable et échéance.'],
  ['causes', '4. Analyse des causes', 'Ishikawa, 5 Pourquoi, Pareto.'],
  ['contremesures', '5. Contre-mesures', 'Solutions retenues face à chaque cause racine.'],
  ['plan', '6. Plan d\'action', 'Qui, quoi, quand.'],
  ['suivi', '7. Suivi des résultats', 'Indicateur avant / après.'],
  ['standard', '8. Standardisation', 'Ce qui change durablement, partage des bonnes pratiques.'],
]

const KANO_Q: { v: KanoAnswer; label: string }[] = [
  { v: 1, label: 'Cela me fait plaisir' },
  { v: 2, label: 'C\'est normal' },
  { v: 3, label: 'Cela m\'est égal' },
  { v: 4, label: 'Je peux m\'en accommoder' },
  { v: 5, label: 'Cela me dérange beaucoup' },
]

function newSheet(title: string): ProblemSheet {
  return {
    id: uid('mrp'),
    title,
    createdAt: new Date().toISOString(),
    method: 'a3',
    qqoqcpc: { quoi: '', qui: '', ou: '', quand: '', comment: '', pourquoi: '', combien: '' },
    indicator: '',
    d8: D8.map(() => ''),
    a3: {},
    ideas: [],
    criteria: [
      { id: uid('c'), name: 'Efficacité sur le problème', weight: 3 },
      { id: uid('c'), name: 'Coût (faible = bien)', weight: 2 },
      { id: uid('c'), name: 'Rapidité de mise en œuvre', weight: 1 },
    ],
    scores: {},
  }
}

function demoMrp(): MrpState {
  const s = newSheet('Retards de livraison des arbres AT-25')
  s.qqoqcpc = {
    quoi: 'Les livraisons d\'arbres AT-25 arrivent en retard chez le client pompes',
    qui: 'Client principal ; production, logistique, qualité',
    ou: 'Ligne d\'usinage AT-25, du débit à l\'expédition',
    quand: 'Depuis 3 mois, surtout en fin de semaine',
    comment: 'Constaté par les réclamations client et le taux de service',
    pourquoi: 'Pénalités de retard, risque de perte du client',
    combien: '≈ 5 % des pièces livrées en retard, 6 € de pénalité par pièce',
  }
  s.indicator = 'Taux de service (pièces livrées à l\'heure / pièces demandées)'
  const ideas = ['SMED sur le tour CNC', 'Kanban entre postes', 'Maintenance préventive du tour', 'Heures supplémentaires le vendredi', 'Recentrer le réglage du diamètre', 'Stock de sécurité produits finis']
  s.ideas = ideas.map((text, i) => ({ id: uid('i'), text, group: i < 2 ? 'Flux' : i < 4 ? 'Capacité' : i === 4 ? 'Qualité' : 'Stocks', votes: [5, 3, 4, 1, 4, 2][i] }))
  const notes = [[9, 3, 3], [3, 9, 3], [3, 3, 3], [3, 1, 9], [9, 9, 9], [3, 1, 9]]
  s.ideas.forEach((idea, i) => (s.scores[idea.id] = Object.fromEntries(s.criteria.map((c, j) => [c.id, notes[i][j]]))))
  const kano: KanoItem[] = [
    { id: uid('k'), need: 'Diamètre dans la tolérance', answers: [{ f: 2, d: 5 }, { f: 2, d: 5 }, { f: 1, d: 5 }, { f: 2, d: 5 }] },
    { id: uid('k'), need: 'Livraison à l\'heure', answers: [{ f: 1, d: 5 }, { f: 1, d: 5 }, { f: 2, d: 5 }, { f: 1, d: 4 }] },
    { id: uid('k'), need: 'Certificat de mesure avec chaque lot', answers: [{ f: 1, d: 3 }, { f: 1, d: 3 }, { f: 1, d: 4 }, { f: 3, d: 3 }] },
    { id: uid('k'), need: 'Couleur de l\'emballage', answers: [{ f: 3, d: 3 }, { f: 3, d: 3 }, { f: 3, d: 4 }, { f: 2, d: 3 }] },
  ]
  return { sheets: [s], kano }
}

export default function MethodPage() {
  const stored = useStore((s) => s.tools.mrp)
  const setTools = useStore((s) => s.setTools)
  const mrp = stored ?? demoMrp()
  const setMrp = (fn: (m: MrpState) => void) =>
    setTools((t) => {
      if (!t.mrp) t.mrp = JSON.parse(JSON.stringify(mrp))
      fn(t.mrp!)
    })
  const [tab, setTab] = useUrlTab<Tab>('choose', TABS)
  const [sel, setSel] = useState(mrp.sheets[0]?.id)
  const sheet = mrp.sheets.find((x) => x.id === sel) ?? mrp.sheets[0]
  const setSheet = (fn: (s: ProblemSheet) => void) =>
    setMrp((m) => {
      const s = m.sheets.find((x) => x.id === sheet.id)
      if (s) fn(s)
    })

  const sheetBar = (
    <Card className="mb-4" bodyClass="flex flex-wrap items-center gap-2 p-3">
      <span className="text-sm text-[var(--text-secondary)]">Fiche problème</span>
      <Select value={sheet?.id} onChange={(e) => setSel(e.target.value)} className="w-80">
        {mrp.sheets.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </Select>
      {sheet && <Input value={sheet.title} onChange={(e) => setSheet((s) => (s.title = e.target.value))} className="w-72" aria-label="Titre" />}
      <Button size="sm" onClick={() => { const s = newSheet('Nouveau problème'); setMrp((m) => m.sheets.push(s)); setSel(s.id) }}><Plus size={13} /> Nouvelle fiche</Button>
      {mrp.sheets.length > 1 && <Button size="sm" variant="danger" onClick={() => ask('Supprimer cette fiche ?') && setMrp((m) => { m.sheets = m.sheets.filter((x) => x.id !== sheet.id) })}><Trash2 size={13} /></Button>}
    </Card>
  )

  return (
    <div>
      <PageHeader icon={<Compass size={20} />} title="Résolution de problèmes" subtitle="Méthode d'Analyse et de Résolution de Problèmes (MARP) : choisir la démarche, définir le problème, trouver et choisir les solutions" />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'choose', label: 'Choisir la démarche' },
          { id: 'qqoqcpc', label: 'QQOQCPC' },
          { id: '8d', label: '8D' },
          { id: 'a3', label: 'A3' },
          { id: 'ideas', label: 'Brainstorming & KJ' },
          { id: 'vote', label: 'Vote pondéré' },
          { id: 'kano', label: 'Kano' },
        ]}
      />
      {tab !== 'choose' && tab !== 'kano' && sheet && sheetBar}
      {tab === 'choose' && <Choose sheet={sheet} setSheet={setSheet} />}
      {tab === 'qqoqcpc' && sheet && <Qqoqcpc sheet={sheet} setSheet={setSheet} />}
      {tab === '8d' && sheet && <EightD sheet={sheet} setSheet={setSheet} />}
      {tab === 'a3' && sheet && <A3Sheet sheet={sheet} setSheet={setSheet} />}
      {tab === 'ideas' && sheet && <Ideas sheet={sheet} setSheet={setSheet} />}
      {tab === 'vote' && sheet && <Vote sheet={sheet} setSheet={setSheet} />}
      {tab === 'kano' && <Kano items={mrp.kano} setMrp={setMrp} />}
    </div>
  )
}

type SP = { sheet: ProblemSheet; setSheet: (fn: (s: ProblemSheet) => void) => void }

function Choose({ sheet, setSheet }: Partial<SP>) {
  const [solution, setSolution] = useState<'connue' | 'groupe' | 'inconnue' | 'strategique'>('groupe')
  const [client, setClient] = useState(false)
  const [data, setData] = useState(true)
  const reco: MrpMethod = solution === 'connue' ? 'kaizen' : solution === 'strategique' ? 'projet' : solution === 'inconnue' && data ? 'dmaic' : client ? '8d' : 'a3'
  const steps = [
    { n: 1, t: 'Définir le problème', g: 'Consensus de départ', tools: [['QQOQCPC + indicateur', '/methode'], ['SIPOC, VOC → CTQ', '/sixsigma/dmaic'], ['Kano', '/methode']] },
    { n: 2, t: 'Chercher les causes', g: 'Observer, analyser', tools: [['Pareto', '/sixsigma/defects'], ['Ishikawa 5M, 5 Pourquoi', '/sixsigma/defects'], ['Système de mesure (R&R)', '/sixsigma/msa'], ['Multi-vari, boîtes à moustaches', '/sixsigma/stats'], ['Corrélation, ANOVA', '/sixsigma/stats']] },
    { n: 3, t: 'Chercher des solutions', g: 'Imaginer, décider', tools: [['Brainstorming, KJ', '/methode'], ['Vote pondéré', '/methode'], ['Plans d\'expériences', '/sixsigma/stats'], ['Plan d\'amélioration simulé', '/plan']] },
    { n: 4, t: 'Valider les résultats', g: 'Évaluer, confirmer', tools: [['Indicateur avant / après', '/lss'], ['Tests d\'hypothèses', '/sixsigma/stats'], ['Capabilité', '/sixsigma/capability']] },
    { n: 5, t: 'Pérenniser', g: 'Ajuster, maintenir', tools: [['Cartes de contrôle', '/sixsigma/spc'], ['Plan de contrôle', '/sixsigma/dmaic'], ['AMDEC, poka-yoke', '/sixsigma/defects'], ['5S, standard', '/lean/5s']] },
  ]
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card title="Quelle démarche pour mon problème ?" subtitle="D'après le positionnement des démarches d'amélioration (cours DDQ1)" className="xl:col-span-5">
        <div className="space-y-3">
          <Field label="La solution est-elle connue ?">
            <Select value={solution} onChange={(e) => setSolution(e.target.value as typeof solution)}>
              <option value="connue">Oui, connue a priori</option>
              <option value="groupe">Non, mais le groupe de travail peut la trouver</option>
              <option value="inconnue">Non, inconnue a priori (causes multiples, variabilité)</option>
              <option value="strategique">C'est un sujet stratégique / transverse</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={client} onChange={(e) => setClient(e.target.checked)} className="accent-[var(--color-brand-600)]" /> Le client est touché (réclamation, pièces livrées non conformes)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={data} onChange={(e) => setData(e.target.checked)} className="accent-[var(--color-brand-600)]" /> Des données mesurables existent ou peuvent être collectées</label>
          <div className="rounded-xl border-2 border-brand-500 bg-brand-500/5 p-3">
            <div className="text-xs text-[var(--text-secondary)]">Démarche conseillée</div>
            <div className="text-lg font-semibold">{METHODS[reco].name}</div>
            <p className="text-sm text-[var(--text-secondary)]">{METHODS[reco].when}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Durée typique : {METHODS[reco].duration} · {METHODS[reco].steps}</p>
            {sheet && setSheet && <Button size="sm" className="mt-2" onClick={() => setSheet((s) => (s.method = reco))}>Retenir pour « {sheet.title} »</Button>}
            {reco === 'dmaic' && <Link to="/sixsigma/dmaic" className="mt-2 ml-2 inline-block text-sm text-brand-600 underline">Ouvrir un projet DMAIC</Link>}
          </div>
        </div>
      </Card>
      <Card title="Les démarches, de la plus légère à la plus lourde" className="xl:col-span-7">
        <Table dense head={['Démarche', 'Quand', 'Durée']} rows={(Object.keys(METHODS) as MrpMethod[]).map((k) => [<b key="n" className={clsx(k === reco && 'text-brand-600')}>{METHODS[k].name}</b>, <span key="w" className="text-xs">{METHODS[k].when}</span>, METHODS[k].duration])} />
        <p className="mt-2 text-xs text-[var(--muted)]">Conseil du cours : préférer une solution satisfaisante et appliquée à une solution optimale mais difficile à mettre en place.</p>
      </Card>
      <Card title="La démarche générique en 5 étapes et ses outils" subtitle="Valable quelle que soit la démarche choisie" className="xl:col-span-12">
        <div className="grid gap-3 md:grid-cols-5">
          {steps.map((s) => (
            <div key={s.n} className="rounded-lg bg-black/[.03] p-3 dark:bg-white/[.05]">
              <div className="font-semibold">{s.n}. {s.t}</div>
              <div className="text-xs text-[var(--muted)]">{s.g}</div>
              <ul className="mt-2 space-y-1 text-sm">
                {s.tools.map(([t, to]) => <li key={t}><Link to={to} className="text-brand-600 hover:underline">{t}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Qqoqcpc({ sheet, setSheet }: SP) {
  const q = sheet.qqoqcpc
  const statement = [q.quoi, q.ou && `sur ${q.ou}`, q.quand && `(${q.quand})`, q.combien && `— ${q.combien}`].filter(Boolean).join(' ')
  const filled = QQ.filter((x) => q[x.key].trim()).length
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card title="QQOQCPC — se poser les bonnes questions avant d'aborder le problème" className="xl:col-span-8">
        <div className="grid gap-3 md:grid-cols-2">
          {QQ.map((x) => (
            <Field key={x.key} label={x.label} hint={x.hint}>
              <TextArea rows={2} value={q[x.key]} onChange={(e) => setSheet((s) => (s.qqoqcpc[x.key] = e.target.value))} />
            </Field>
          ))}
          <Field label="Indicateur du problème" hint="Un seul (deux au maximum) : il mesure tout le périmètre du problème… et seulement ce périmètre." className="md:col-span-2">
            <Input value={sheet.indicator} onChange={(e) => setSheet((s) => (s.indicator = e.target.value))} />
          </Field>
        </div>
      </Card>
      <div className="space-y-4 xl:col-span-4">
        <Card title="Énoncé du problème">
          <p className="text-sm">{statement || <span className="text-[var(--muted)]">Remplissez le QQOQCPC.</span>}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">{filled} / 7 questions renseignées · démarche retenue : <b>{METHODS[sheet.method].name}</b></p>
        </Card>
        <Note tone="tip">Ne pas mettre de cause ni de solution dans l'énoncé : il décrit des faits. Ensuite, collectez l'indicateur sur une période représentative.</Note>
      </div>
    </div>
  )
}

function EightD({ sheet, setSheet }: SP) {
  return (
    <div className="space-y-2">
      {D8.map(([code, title, hint], i) => (
        <Card key={code} bodyClass="p-3">
          <div className="grid gap-2 md:grid-cols-[220px_1fr]">
            <div>
              <div className="flex items-center gap-2"><Badge tone={sheet.d8[i]?.trim() ? 'good' : 'neutral'}>{code}</Badge><b>{title}</b></div>
              <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
            </div>
            <TextArea rows={2} value={sheet.d8[i] ?? ''} onChange={(e) => setSheet((s) => (s.d8[i] = e.target.value))} />
          </div>
        </Card>
      ))}
      <p className="text-xs text-[var(--muted)]">Astuce : la description D2 peut reprendre le QQOQCPC ; l'analyse D4 s'appuie sur Ishikawa et 5 Pourquoi (Analyse des défauts).</p>
    </div>
  )
}

function A3Sheet({ sheet, setSheet }: SP) {
  return (
    <Card title={`A3 — ${sheet.title}`} subtitle="Une seule page, lue de haut en bas à gauche puis à droite">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          {A3.slice(0, 4).map(([k, t, h]) => (
            <Field key={k} label={t} hint={h}><TextArea rows={4} value={sheet.a3[k] ?? (k === 'actuel' && sheet.qqoqcpc.quoi ? '' : '')} onChange={(e) => setSheet((s) => (s.a3[k] = e.target.value))} /></Field>
          ))}
        </div>
        <div className="space-y-3">
          {A3.slice(4).map(([k, t, h]) => (
            <Field key={k} label={t} hint={h}><TextArea rows={4} value={sheet.a3[k] ?? ''} onChange={(e) => setSheet((s) => (s.a3[k] = e.target.value))} /></Field>
          ))}
        </div>
      </div>
    </Card>
  )
}

function Ideas({ sheet, setSheet }: SP) {
  const [text, setText] = useState('')
  const groups = [...new Set(sheet.ideas.map((i) => i.group || 'Non classé'))]
  const add = () => {
    if (!text.trim()) return
    setSheet((s) => s.ideas.push({ id: uid('i'), text: text.trim(), group: '', votes: 0 }))
    setText('')
  }
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card title="Brainstorming" subtitle="Toutes les idées, sans critique ; puis regroupement par affinités (méthode KJ)" className="xl:col-span-5">
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Une idée par post-it…" />
          <Button onClick={add}><Plus size={14} /></Button>
        </div>
        <div className="mt-3 space-y-1.5">
          {sheet.ideas.map((i, k) => (
            <div key={i.id} className="grid grid-cols-[1fr_130px_70px_28px] items-center gap-1.5">
              <Input value={i.text} onChange={(e) => setSheet((s) => (s.ideas[k].text = e.target.value))} />
              <Input value={i.group} placeholder="Famille (KJ)" onChange={(e) => setSheet((s) => (s.ideas[k].group = e.target.value))} />
              <NumberInput value={i.votes} min={0} step={1} onChange={(v) => setSheet((s) => (s.ideas[k].votes = Math.round(v)))} />
              <button onClick={() => setSheet((s) => s.ideas.splice(k, 1))} className="text-[var(--muted)] hover:text-[var(--critical)]" aria-label="Supprimer"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">Colonne de droite : nombre de participants ayant retenu l'idée (vote rapide, 3 à 5 idées par personne).</p>
      </Card>
      <Card title="Regroupement par affinités (KJ)" subtitle="Chaque famille reçoit un intitulé générique" className="xl:col-span-7">
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g} className="rounded-lg bg-black/[.03] p-3 dark:bg-white/[.05]">
              <div className="mb-2 text-sm font-semibold">{g}</div>
              <div className="flex flex-wrap gap-1.5">
                {sheet.ideas.filter((i) => (i.group || 'Non classé') === g).sort((a, b) => b.votes - a.votes).map((i) => (
                  <span key={i.id} className="rounded-md px-2 py-1 text-xs shadow-sm" style={{ background: 'color-mix(in srgb, var(--warning) 25%, var(--surface-1))' }}>
                    {i.text} {i.votes > 0 && <b>· {i.votes}</b>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!sheet.ideas.length && <p className="text-sm text-[var(--muted)]">Ajoutez des idées à gauche.</p>}
      </Card>
    </div>
  )
}

function Vote({ sheet, setSheet }: SP) {
  const scoreOf = (id: string) => sheet.criteria.reduce((a, c) => a + (sheet.scores[id]?.[c.id] ?? 0) * c.weight, 0)
  const ranked = [...sheet.ideas].sort((a, b) => scoreOf(b.id) - scoreOf(a.id))
  const max = Math.max(1, ...ranked.map((i) => scoreOf(i.id)))
  return (
    <div className="space-y-4">
      <Card title="Vote pondéré par critères" subtitle="Notes 1, 3 ou 9 par critère ; un poids multiplicateur peut être donné aux critères les plus importants" actions={
        <Button size="sm" onClick={() => setSheet((s) => s.criteria.push({ id: uid('c'), name: 'Nouveau critère', weight: 1 }))}><Plus size={13} /> Critère</Button>
      }>
        {sheet.ideas.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs text-[var(--text-secondary)] dark:border-white/10">
                  <th className="px-2 py-1.5 text-left">Solution / idée</th>
                  {sheet.criteria.map((c, k) => (
                    <th key={c.id} className="min-w-36 px-2 py-1.5">
                      <Input value={c.name} onChange={(e) => setSheet((s) => (s.criteria[k].name = e.target.value))} className="mb-1 text-xs" />
                      <div className="flex items-center gap-1">
                        <span>poids</span>
                        <NumberInput value={c.weight} min={0} step={1} onChange={(v) => setSheet((s) => (s.criteria[k].weight = v))} className="w-16" />
                        <button onClick={() => setSheet((s) => s.criteria.splice(k, 1))} className="text-[var(--muted)] hover:text-[var(--critical)]" aria-label="Supprimer le critère"><Trash2 size={12} /></button>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((i, rank) => (
                  <tr key={i.id} className="border-b border-black/[.05] dark:border-white/[.06]">
                    <td className="px-2 py-1.5">{rank === 0 && <Trophy size={13} className="mr-1 inline text-amber-500" />}{i.text}</td>
                    {sheet.criteria.map((c) => (
                      <td key={c.id} className="px-2 py-1.5 text-center">
                        <div className="inline-flex gap-0.5">
                          {[1, 3, 9].map((v) => (
                            <button key={v} onClick={() => setSheet((s) => { s.scores[i.id] = { ...(s.scores[i.id] ?? {}), [c.id]: v } })} className={clsx('h-7 w-7 rounded text-xs font-semibold', sheet.scores[i.id]?.[c.id] === v ? 'bg-brand-600 text-white' : 'bg-black/5 text-[var(--text-secondary)] dark:bg-white/10')}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-24 rounded-full bg-black/[.06] dark:bg-white/10"><div className="h-2 rounded-full" style={{ width: `${(scoreOf(i.id) / max) * 100}%`, background: S(0) }} /></div>
                        <b className="tabular">{scoreOf(i.id)}</b>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Ajoutez d'abord des idées dans l'onglet Brainstorming.</p>
        )}
      </Card>
      {ranked.length > 0 && <Note tone="tip">Choix du groupe : <b>{ranked[0].text}</b>. Soignez la définition des critères ; si les scores sont proches, rediscutez avant de décider.</Note>}
    </div>
  )
}

function Kano({ items, setMrp }: { items: KanoItem[]; setMrp: (fn: (m: MrpState) => void) => void }) {
  const [need, setNeed] = useState('')
  const rows = items.map((it) => {
    const cats = it.answers.map((a) => kanoClassify(a.f, a.d))
    return { it, ...kanoSummary(cats) }
  })
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card title="Questionnaire de Kano" subtitle="Pour chaque attente : question fonctionnelle (si l'attente est satisfaite…) et dysfonctionnelle (si elle ne l'est pas…)" className="xl:col-span-7">
        <div className="mb-3 flex gap-2">
          <Input value={need} onChange={(e) => setNeed(e.target.value)} placeholder="Attente du client (ex. livraison à l'heure)" />
          <Button onClick={() => { if (need.trim()) { setMrp((m) => m.kano.push({ id: uid('k'), need: need.trim(), answers: [] })); setNeed('') } }}><Plus size={14} /></Button>
        </div>
        <div className="space-y-3">
          {items.map((it, k) => (
            <div key={it.id} className="rounded-lg border border-black/[.08] p-2.5 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Input value={it.need} onChange={(e) => setMrp((m) => (m.kano[k].need = e.target.value))} className="font-medium" />
                <Badge tone="brand">{KANO_LABEL[rows[k].major]}</Badge>
                <button onClick={() => setMrp((m) => m.kano.splice(k, 1))} className="text-[var(--muted)] hover:text-[var(--critical)]" aria-label="Supprimer"><Trash2 size={13} /></button>
              </div>
              <div className="mt-2 space-y-1">
                {it.answers.map((a, j) => (
                  <div key={j} className="grid grid-cols-[1fr_1fr_110px_24px] items-center gap-1.5 text-xs">
                    <Select value={a.f} onChange={(e) => setMrp((m) => (m.kano[k].answers[j].f = +e.target.value as KanoAnswer))} aria-label="Fonctionnel">
                      {KANO_Q.map((q) => <option key={q.v} value={q.v}>Si oui : {q.label}</option>)}
                    </Select>
                    <Select value={a.d} onChange={(e) => setMrp((m) => (m.kano[k].answers[j].d = +e.target.value as KanoAnswer))} aria-label="Dysfonctionnel">
                      {KANO_Q.map((q) => <option key={q.v} value={q.v}>Si non : {q.label}</option>)}
                    </Select>
                    <span className="text-[var(--text-secondary)]">→ {KANO_LABEL[kanoClassify(a.f, a.d)]}</span>
                    <button onClick={() => setMrp((m) => m.kano[k].answers.splice(j, 1))} className="text-[var(--muted)] hover:text-[var(--critical)]" aria-label="Supprimer la réponse"><Trash2 size={12} /></button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setMrp((m) => m.kano[k].answers.push({ f: 1, d: 3 }))}><Plus size={12} /> Réponse d'un client</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-4 xl:col-span-5">
        <Card title="Diagramme de Kano" subtitle="Coefficients de satisfaction (CS+) et d'insatisfaction (|CS−|)">
          <ChartBox height={280}>
            <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid />
              <XAxis dataKey="x" type="number" domain={[0, 1]} {...axisProps} name="|CS−| insatisfaction" tickFormatter={(v) => pct(v, 0)} label={{ value: 'Insatisfaction si absent →', position: 'insideBottomRight', offset: -2, fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis dataKey="y" type="number" domain={[0, 1]} {...axisProps} name="CS+ satisfaction" tickFormatter={(v) => pct(v, 0)} />
              <ZAxis range={[90, 90]} />
              <ReferenceLine x={0.5} stroke="var(--axis)" />
              <ReferenceLine y={0.5} stroke="var(--axis)" />
              <Tooltip {...tooltipStyle} formatter={(v) => pct(Number(v), 0)} />
              <Scatter data={rows.filter((r) => Number.isFinite(r.satisfaction)).map((r) => ({ x: Math.abs(r.dissatisfaction), y: r.satisfaction, name: r.it.need }))} fill={S(0)} isAnimationActive={false}>
                <LabelList dataKey="name" position="top" fill="var(--text-secondary)" fontSize={10} formatter={(v) => { const t = String(v); return t.length > 22 ? t.slice(0, 21) + '…' : t }} />
              </Scatter>
            </ScatterChart>
          </ChartBox>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-[var(--muted)]">
            <span>↖ Attractives</span><span className="text-right">↗ Proportionnelles</span>
            <span>↙ Indifférentes</span><span className="text-right">↘ Obligatoires</span>
          </div>
        </Card>
        <Card title="Synthèse">
          <Table dense head={['Attente', 'Catégorie', 'A', 'O', 'M', 'I', 'CS+', 'CS−']} rows={rows.map((r) => [r.it.need, KANO_LABEL[r.major], r.counts.A, r.counts.O, r.counts.M, r.counts.I, fmt(r.satisfaction, 2), fmt(Math.abs(r.dissatisfaction) < 1e-12 ? 0 : r.dissatisfaction, 2)])} />
          <p className="mt-2 text-xs text-[var(--muted)]">Priorité : satisfaire d'abord toutes les attentes obligatoires, puis améliorer les proportionnelles ; les attractives différencient.</p>
        </Card>
      </div>
    </div>
  )
}

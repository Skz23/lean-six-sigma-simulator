import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, BookMarked, CheckCircle2, Circle, Download, Factory, Monitor, RotateCcw, Share2, Sigma, Smartphone } from 'lucide-react'
import { Badge, Button, Card, Note, PageHeader, Tabs } from '../components/ui'

type Tab = 'start' | 'tour' | 'modules' | 'install' | 'faq' | 'glossary'

interface Step {
  id: string
  title: string
  to: string
  what: string
  look: string
}

const TOUR: Step[] = [
  { id: 't1', title: 'Constater le problème', to: '/', what: 'Sur le Dashboard, scénario « Situation initiale ».', look: 'Le bandeau orange : la ligne ne couvre pas la demande de 420 pièces. Lead Time ≈ 3,7 h, ≈ 7 % de défauts.' },
  { id: 't2', title: 'Voir l\'usine tourner', to: '/lean/simulation', what: 'Cliquez sur « Démarrer », puis changez la vitesse (× 60, × 180…).', look: 'Les pièces (points) qui s\'accumulent devant les postes, et le poste encadré en rouge : le goulot.' },
  { id: 't3', title: 'Lire les indicateurs Lean', to: '/lean/kpi', what: 'Parcourez le tableau des indicateurs et le graphique Yamazumi.', look: 'Le temps de cycle du goulot comparé au Takt Time, et le PCE (part du temps à valeur ajoutée) inférieur à 1 %.' },
  { id: 't4', title: 'Repérer les gaspillages', to: '/lean/muda', what: 'Cliquez sur chacune des 8 cartes.', look: 'Les gaspillages « élevés », leurs causes probables et les améliorations proposées.' },
  { id: 't5', title: 'Cartographier le flux', to: '/lean/vsm', what: 'Lisez la VSM de gauche à droite.', look: 'Les triangles de stock et la ligne de temps : presque tout le Lead Time est de l\'attente.' },
  { id: 't6', title: 'Mesurer la capabilité', to: '/sixsigma/capability', what: 'Regardez l\'histogramme et les indices.', look: 'Cp ≈ 1,5 mais Cpk ≈ 0,7 : le procédé est précis mais décentré vers la limite haute.' },
  { id: 't7', title: 'Trouver la cause', to: '/sixsigma/stats', what: 'Onglet « Corrélation & régression », variable « Température broche ».', look: 'Une corrélation forte et significative : la température fait grossir le diamètre.' },
  { id: 't8', title: 'Corriger le réglage', to: '/sixsigma/process', what: 'Déplacez la température de 43 °C vers 35 °C, puis « Appliquer au scénario ».', look: 'Le Cpk prédit qui dépasse 1,33 et les rebuts simulés qui baissent.' },
  { id: 't9', title: 'Réduire les changements de série', to: '/lean/smed', what: 'Sur le tour CNC, étudiez la décomposition puis « Appliquer au scénario ».', look: 'Le changement de série divisé par 3 à 4 et le débit qui augmente.' },
  { id: 't10', title: 'Comparer avant / après', to: '/lss', what: 'Avant : Situation initiale · Après : Lean Six Sigma.', look: 'Les gains Lean, Six Sigma et combinés, le ROI et le délai de retour sur investissement.' },
  { id: 't11', title: 'Produire le rapport', to: '/reports', what: 'Choisissez les sections puis « Générer le rapport PDF ».', look: 'Un rapport de 11 sections prêt à présenter.' },
]

const MODULES: { icon: React.ReactNode; title: string; intro: string; items: { to: string; name: string; desc: string }[] }[] = [
  {
    icon: <Factory size={18} />,
    title: 'Lean Manufacturing',
    intro: 'Optimiser les flux et réduire les gaspillages.',
    items: [
      { to: '/lean/line', name: 'Ligne de production', desc: 'Ajouter, modifier, supprimer et déplacer les postes (glisser-déposer). Régler la journée, la demande, la taille de lot et le pilotage poussé / tiré.' },
      { to: '/lean/simulation', name: 'Simulation', desc: 'Animation de la journée, détection du goulot en direct, historique complet d\'une pièce (recherche par identifiant, ex. P-00123).' },
      { to: '/lean/kpi', name: 'Indicateurs Lean', desc: 'Takt, Cycle Time, Lead Time, Throughput, WIP, TRS, productivité, VA / NVA, équilibrage.' },
      { to: '/lean/muda', name: '8 gaspillages', desc: 'Détection automatique, impact en €/jour, causes et pistes d\'amélioration.' },
      { to: '/lean/vsm', name: 'VSM', desc: 'Cartographie générée automatiquement à partir de la simulation.' },
      { to: '/lean/smed', name: 'SMED', desc: 'Décomposer un changement de série (interne / externe), simuler le gain, l\'appliquer.' },
      { to: '/lean/kanban', name: 'Kanban', desc: 'Calcul du nombre de cartes et passage en flux tiré simulé.' },
      { to: '/lean/5s', name: '5S', desc: 'Audit noté sur 5 dimensions, radar et plan d\'action.' },
      { to: '/lean/spaghetti', name: 'Spaghetti', desc: 'Faites glisser les postes pour tester une implantation et mesurer les déplacements.' },
      { to: '/lean/kaizen', name: 'Kaizen', desc: 'Tableau d\'amélioration continue (glisser les cartes entre colonnes), mesure avant / après.' },
    ],
  },
  {
    icon: <Sigma size={18} />,
    title: 'Six Sigma',
    intro: 'Réduire la variabilité et les défauts.',
    items: [
      { to: '/sixsigma/dmaic', name: 'Projets DMAIC', desc: 'Conduire un projet de Define à Control : charte, VOC, SIPOC, causes, solutions, plan de contrôle.' },
      { to: '/sixsigma/process', name: 'Paramètres procédé', desc: 'Tester des réglages (température, pression, vitesse) et voir leur effet prédit puis simulé.' },
      { to: '/sixsigma/capability', name: 'Capabilité', desc: 'Cp, Cpk (court terme) et Pp, Ppk (long terme) sur données simulées ou collées.' },
      { to: '/sixsigma/spc', name: 'SPC', desc: 'Cartes X̄-R, I-MR, p, np, c, u avec règles de détection au choix.' },
      { to: '/sixsigma/defects', name: 'Analyse des défauts', desc: 'Registre, Pareto, Ishikawa, 5 Pourquoi, AMDEC avec NPR.' },
      { to: '/sixsigma/stats', name: 'Statistiques avancées', desc: 'Corrélation, régression, tests d\'hypothèses, ANOVA, plans d\'expériences, distributions.' },
    ],
  },
]

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: 'Où sont enregistrées mes données ?', a: 'Sur votre appareil uniquement, dans le navigateur ou l\'application installée. Elles ne sont envoyées nulle part. Un autre appareil ou un autre navigateur ne les voit pas.' },
  { q: 'Comment partager mon travail avec quelqu\'un ?', a: <>Dans <Link className="text-brand-600 underline" to="/scenarios">Gestion des scénarios</Link>, cliquez sur <b>Exporter</b> : un fichier .json est créé. Envoyez-le ; l'autre personne clique sur <b>Importer</b>. Attention, l'import remplace ses propres données.</> },
  { q: 'J\'ai fait une erreur, comment revenir en arrière ?', a: <>Chaque modification appliquée depuis un outil crée une version. Dans <Link className="text-brand-600 underline" to="/scenarios">Gestion des scénarios</Link> → <b>Historique des versions</b> → <b>Restaurer</b>. Pensez aussi au bouton « Enregistrer une version » avant une grosse modification.</> },
  { q: 'Comment repartir de zéro ?', a: <>Dans Gestion des scénarios, bouton <b>Données de démo</b>. Toutes vos données sont alors remplacées par le jeu de démonstration.</> },
  { q: 'Pourquoi les résultats ne changent pas quand je relance ?', a: 'La simulation est reproductible : avec la même « graine aléatoire », la journée est identique. Changez la graine dans Ligne de production pour obtenir une autre journée, ou activez le mode « Robustesse » dans Lean Six Sigma pour moyenner 8 journées.' },
  { q: 'Les chiffres sont-ils réalistes ?', a: <>Ils découlent d'un modèle explicite (pannes, temps de cycle variables, modèle statistique du diamètre…) et ne sont jamais ajustés pour « faire joli ». Tout est documenté dans <Link className="text-brand-600 underline" to="/docs">Hypothèses & formules</Link>.</> },
  { q: 'Puis-je utiliser mes propres mesures ?', a: 'Oui : dans Capabilité, SPC, Statistiques et Tests, choisissez « Saisie manuelle » et collez vos valeurs depuis Excel (une valeur par ligne ou séparées par des espaces).' },
  { q: 'L\'appli fonctionne-t-elle sans internet ?', a: 'Oui, une fois installée et ouverte une première fois. Elle se met à jour automatiquement quand vous êtes connecté.' },
  { q: 'Le mode sombre ?', a: 'Icône lune / soleil en haut à droite.' },
]

const GLOSSARY: [string, string][] = [
  ['Takt Time', 'Rythme imposé par le client : temps disponible ÷ demande. Une pièce doit sortir toutes les X secondes.'],
  ['Cycle Time', 'Temps pour réaliser une pièce sur un poste.'],
  ['Lead Time', 'Temps total de traversée d\'une pièce, de l\'entrée à la sortie (attentes comprises).'],
  ['WIP', 'Work In Progress : pièces en cours dans la ligne.'],
  ['Goulot', 'Poste le plus chargé, qui limite le débit de toute la ligne.'],
  ['TRS / OEE', 'Taux de Rendement Synthétique = Disponibilité × Performance × Qualité.'],
  ['VA / NVA', 'Temps à valeur ajoutée (ce que le client paie) / sans valeur ajoutée (attente, transport, contrôle…).'],
  ['Muda', 'Gaspillage, en japonais. Le Lean en distingue 8.'],
  ['SMED', 'Méthode de réduction du temps de changement de série.'],
  ['Kanban', 'Carte de pilotage du flux tiré : on produit seulement ce qui a été consommé.'],
  ['VSM', 'Value Stream Mapping : cartographie de la chaîne de valeur.'],
  ['DMAIC', 'Define, Measure, Analyze, Improve, Control : la démarche de projet Six Sigma.'],
  ['CTQ', 'Critical To Quality : caractéristique critique pour le client (ici le diamètre).'],
  ['LSL / USL', 'Limites de spécification inférieure / supérieure, fixées par le client.'],
  ['Cp / Cpk', 'Capabilité court terme : Cp = précision potentielle, Cpk = précision réelle en tenant compte du centrage. Visez ≥ 1,33.'],
  ['Pp / Ppk', 'Performance long terme, incluant les dérives entre lots.'],
  ['DPMO', 'Défauts par million d\'opportunités.'],
  ['Niveau sigma', 'Traduction du DPMO sur une échelle de 1 à 6 (6σ ≈ 3,4 DPMO).'],
  ['SPC', 'Maîtrise statistique des procédés : cartes de contrôle pour détecter les dérives.'],
  ['UCL / LCL', 'Limites de contrôle calculées à partir des données (à ne pas confondre avec LSL/USL).'],
  ['AMDEC / NPR', 'Analyse des modes de défaillance ; NPR = Gravité × Occurrence × Détection.'],
  ['DOE', 'Plan d\'expériences : tester plusieurs facteurs à la fois pour mesurer leurs effets.'],
]

const KEY = 'lss-guide-progress'
function loadDone(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export default function GuidePage() {
  const [tab, setTab] = useState<Tab>('start')
  const [done, setDone] = useState<string[]>(loadDone)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(done))
    } catch {
      /* stockage indisponible */
    }
  }, [done])
  const toggle = (id: string) => setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))
  const progress = done.filter((d) => TOUR.some((t) => t.id === d)).length

  return (
    <div>
      <PageHeader icon={<BookMarked size={20} />} title="Guide d'utilisation" subtitle="Tout pour prendre en main le simulateur, l'installer et le partager" />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'start', label: 'Bienvenue' },
          { id: 'tour', label: `Parcours guidé (${progress}/${TOUR.length})` },
          { id: 'modules', label: 'Les modules' },
          { id: 'install', label: 'Installer & partager' },
          { id: 'faq', label: 'Questions fréquentes' },
          { id: 'glossary', label: 'Glossaire' },
        ]}
      />

      {tab === 'start' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="À quoi sert ce simulateur ?" className="lg:col-span-2">
            <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              <p>
                C'est un <b className="text-[var(--text-primary)]">laboratoire virtuel d'usine</b>. Vous y construisez une ligne de production, vous la faites tourner une journée, vous analysez ses problèmes avec les outils <b className="text-[var(--text-primary)]">Lean</b> (flux, attentes, stocks) et <b className="text-[var(--text-primary)]">Six Sigma</b> (variabilité, défauts), puis vous testez des améliorations et mesurez leurs gains.
              </p>
              <p>
                Un cas complet est déjà chargé : <b className="text-[var(--text-primary)]">MécaPrécis SAS</b>, qui usine des arbres de Ø25 mm (± 0,05 mm). Le client demande 420 pièces par jour, mais l'usine livre en retard et produit trop de rebuts. À vous de trouver pourquoi.
              </p>
              <p>Tous les modules partagent le même moteur : modifier un poste dans le module Lean change aussi les résultats qualité, et inversement.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setTab('tour')}>
                Commencer le parcours guidé <ArrowRight size={15} />
              </Button>
              <Button onClick={() => setTab('install')}>Installer l'appli</Button>
            </div>
          </Card>
          <Card title="Les 4 scénarios fournis">
            <ul className="space-y-2.5 text-sm">
              <li><Badge>Situation initiale</Badge><div className="mt-1 text-xs text-[var(--muted)]">L'usine telle qu'elle est : flux poussé, gros lots, réglage décentré.</div></li>
              <li><Badge tone="info">Amélioration Lean</Badge><div className="mt-1 text-xs text-[var(--muted)]">SMED, kanban, implantation en U, maintenance.</div></li>
              <li><Badge tone="warning">Amélioration Six Sigma</Badge><div className="mt-1 text-xs text-[var(--muted)]">Recentrage du procédé, régulation thermique.</div></li>
              <li><Badge tone="good">Lean Six Sigma</Badge><div className="mt-1 text-xs text-[var(--muted)]">Les deux combinés.</div></li>
            </ul>
            <p className="mt-3 text-xs text-[var(--muted)]">Changez de scénario avec la liste « Scénario actif » en haut de l'écran.</p>
          </Card>
          <Card title="Comment lire l'écran" className="lg:col-span-3">
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><b>Menu de gauche</b><p className="text-xs text-[var(--muted)]">Les modules. Sur téléphone : icône ☰ en haut à gauche.</p></div>
              <div><b>Scénario actif</b><p className="text-xs text-[var(--muted)]">En haut : toutes les pages affichent les résultats de ce scénario.</p></div>
              <div><b>Couleurs</b><p className="text-xs text-[var(--muted)]">Vert = bon, orange = à surveiller, rouge = problème. Les pourcentages comparent avant / après.</p></div>
              <div><b>Encadrés bleus et verts</b><p className="text-xs text-[var(--muted)]">Explications et conseils pédagogiques pour interpréter les résultats.</p></div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'tour' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="h-2 w-48 rounded-full bg-black/[.06] dark:bg-white/10">
                <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(progress / TOUR.length) * 100}%` }} />
              </div>
              <span className="text-sm text-[var(--text-secondary)]">{progress} / {TOUR.length} étapes</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDone([])}>
              <RotateCcw size={13} /> Recommencer
            </Button>
          </div>
          <Note tone="tip">Commencez avec le scénario « Situation initiale » sélectionné en haut. Ouvrez chaque étape, observez, puis revenez ici cocher l'étape. Comptez environ 20 minutes.</Note>
          {TOUR.map((s, i) => {
            const ok = done.includes(s.id)
            return (
              <div key={s.id} className={clsx('flex gap-3 rounded-xl border bg-[var(--surface-1)] p-3.5 transition-colors', ok ? 'border-[var(--good)]/40' : 'border-black/[.08] dark:border-white/10')}>
                <button onClick={() => toggle(s.id)} className="mt-0.5 shrink-0" aria-label={ok ? 'Marquer comme non fait' : 'Marquer comme fait'}>
                  {ok ? <CheckCircle2 size={22} className="text-[var(--good)]" /> : <Circle size={22} className="text-[var(--muted)]" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className={clsx('font-semibold', ok && 'text-[var(--muted)] line-through')}>
                      Étape {i + 1} · {s.title}
                    </h3>
                    <Link to={s.to} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                      Ouvrir <ArrowRight size={13} />
                    </Link>
                  </div>
                  <p className="mt-1 text-sm"><span className="font-medium">À faire :</span> {s.what}</p>
                  <p className="mt-0.5 text-sm text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-primary)]">À observer :</span> {s.look}</p>
                </div>
              </div>
            )
          })}
          {progress === TOUR.length && (
            <Note title="Bravo, parcours terminé !">Vous avez mené un projet Lean Six Sigma complet. Essayez maintenant de créer votre propre scénario (Gestion des scénarios → dupliquer) et de battre les résultats du scénario « Lean Six Sigma ».</Note>
          )}
        </div>
      )}

      {tab === 'modules' && (
        <div className="space-y-4">
          {MODULES.map((m) => (
            <Card key={m.title} title={<span className="inline-flex items-center gap-2">{m.icon} {m.title}</span>} subtitle={m.intro}>
              <div className="grid gap-2 md:grid-cols-2">
                {m.items.map((it) => (
                  <Link key={it.to} to={it.to} className="group rounded-lg border border-black/[.06] p-3 transition-colors hover:border-brand-500 dark:border-white/10">
                    <div className="flex items-center justify-between font-medium">
                      {it.name}
                      <ArrowRight size={14} className="text-[var(--muted)] group-hover:text-brand-600" />
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{it.desc}</p>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
          <div className="grid gap-3 md:grid-cols-3">
            <Card title="Lean Six Sigma"><p className="text-sm text-[var(--text-secondary)]">Démarche guidée en 6 étapes et tableau comparatif des gains (Lean, Six Sigma, combinés, ROI).</p><Link to="/lss" className="mt-2 inline-block text-sm text-brand-600 underline">Ouvrir</Link></Card>
            <Card title="Gestion des scénarios"><p className="text-sm text-[var(--text-secondary)]">Créer, dupliquer, comparer, restaurer une version, exporter / importer.</p><Link to="/scenarios" className="mt-2 inline-block text-sm text-brand-600 underline">Ouvrir</Link></Card>
            <Card title="Rapports"><p className="text-sm text-[var(--text-secondary)]">Rapport PDF professionnel en 11 sections, à partir de deux scénarios.</p><Link to="/reports" className="mt-2 inline-block text-sm text-brand-600 underline">Ouvrir</Link></Card>
          </div>
        </div>
      )}

      {tab === 'install' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={<span className="inline-flex items-center gap-2"><Monitor size={17} /> Sur ordinateur</span>}>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Ouvrez <b>https://skz23.github.io/lean-six-sigma-simulator/</b> avec <b>Chrome</b> ou <b>Edge</b>.</li>
              <li>Cliquez sur l'icône <b>Installer</b> (un écran avec une flèche) à droite de la barre d'adresse.</li>
              <li>Confirmez avec <b>Installer</b>. L'appli s'ouvre dans sa propre fenêtre et apparaît dans le menu Démarrer / le Dock.</li>
            </ol>
            <p className="mt-2 text-xs text-[var(--muted)]">Pas d'icône ? Menu ⋮ → « Enregistrer et partager » → « Installer la page en tant qu'application ».</p>
          </Card>
          <Card title={<span className="inline-flex items-center gap-2"><Smartphone size={17} /> Sur téléphone</span>}>
            <div className="space-y-3 text-sm">
              <div>
                <b>Android (Chrome)</b>
                <ol className="mt-1 list-decimal space-y-1 pl-5"><li>Ouvrez le lien.</li><li>Menu <b>⋮</b> → <b>Installer l'application</b>.</li></ol>
              </div>
              <div>
                <b>iPhone / iPad (Safari obligatoire)</b>
                <ol className="mt-1 list-decimal space-y-1 pl-5"><li>Ouvrez le lien dans Safari.</li><li>Bouton <b>Partager</b> (carré avec une flèche) → <b>Sur l'écran d'accueil</b> → <b>Ajouter</b>.</li></ol>
              </div>
            </div>
          </Card>
          <Card title={<span className="inline-flex items-center gap-2"><Share2 size={17} /> Partager l'outil</span>}>
            <p className="text-sm text-[var(--text-secondary)]">Envoyez simplement le lien. Chacun peut l'ouvrir et l'installer, sans compte. Une fois installée, l'appli fonctionne aussi hors connexion et se met à jour toute seule.</p>
            <CopyLink />
          </Card>
          <Card title={<span className="inline-flex items-center gap-2"><Download size={17} /> Partager un travail</span>}>
            <p className="text-sm text-[var(--text-secondary)]">Chaque personne a ses propres données. Pour transmettre vos scénarios : <Link className="text-brand-600 underline" to="/scenarios">Gestion des scénarios</Link> → <b>Exporter</b>, envoyez le fichier .json, puis le destinataire clique sur <b>Importer</b>.</p>
          </Card>
        </div>
      )}

      {tab === 'faq' && (
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-black/[.08] bg-[var(--surface-1)] p-3.5 dark:border-white/10">
              <summary className="cursor-pointer list-none font-medium">
                <span className="mr-2 inline-block text-brand-600 transition-transform group-open:rotate-90">›</span>
                {f.q}
              </summary>
              <div className="mt-2 pl-5 text-sm text-[var(--text-secondary)]">{f.a}</div>
            </details>
          ))}
        </div>
      )}

      {tab === 'glossary' && (
        <Card>
          <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            {GLOSSARY.map(([t, d]) => (
              <div key={t} className="border-b border-black/[.05] pb-2 dark:border-white/[.06]">
                <dt className="font-semibold text-brand-700 dark:text-brand-300">{t}</dt>
                <dd className="text-sm text-[var(--text-secondary)]">{d}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  )
}

function CopyLink() {
  const url = 'https://skz23.github.io/lean-six-sigma-simulator/'
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-black/[.04] px-2.5 py-1.5 text-xs select-all dark:bg-white/[.06]">{url}</code>
      <Button
        size="sm"
        onClick={() =>
          navigator.clipboard
            ?.writeText(url)
            .then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            })
            .catch(() => setCopied(false))
        }
      >
        {copied ? 'Copié !' : 'Copier le lien'}
      </Button>
    </div>
  )
}

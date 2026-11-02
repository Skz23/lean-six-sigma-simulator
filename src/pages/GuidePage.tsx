import { useEffect, useState } from 'react'
import { useUrlTab } from '../lib/useUrlTab'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, BookMarked, CheckCircle2, Circle, Download, Monitor, RotateCcw, Share2, Smartphone } from 'lucide-react'
import { Badge, Button, Card, Note, PageHeader, Tabs } from '../components/ui'
import { PhaseIcon } from '../components/PhaseNav'
import { PHASES, phaseById, toolById, type PhaseId } from '../workflow/phases'

const TABS = ['start', 'tour', 'modules', 'install', 'faq', 'glossary'] as const
type Tab = (typeof TABS)[number]

interface Step {
  id: string
  phase: PhaseId
  title: string
  to: string
  what: string
  look: string
}

const TOUR: Step[] = [
  { id: 't1', phase: 'define', title: 'Constater le problème', to: '/', what: 'Sur l\'Accueil, scénario « Situation initiale ».', look: 'Le bandeau orange : la ligne ne couvre pas la demande de 420 pièces. Lead Time ≈ 3,7 h, ≈ 7 % de défauts.' },
  { id: 't5', phase: 'define', title: 'Cartographier le flux', to: '/lean/vsm', what: 'Lisez la VSM de gauche à droite.', look: 'Les triangles de stock et la ligne de temps : presque tout le Lead Time est de l\'attente.' },
  { id: 't2', phase: 'measure', title: 'Voir l\'usine tourner', to: '/lean/simulation', what: 'Cliquez sur « Démarrer », puis changez la vitesse (× 60, × 180…).', look: 'Les pièces (points) qui s\'accumulent devant les postes, et le poste encadré en rouge : le goulot.' },
  { id: 't3', phase: 'measure', title: 'Lire les indicateurs Lean', to: '/lean/kpi', what: 'Parcourez le tableau des indicateurs et le graphique Yamazumi.', look: 'Le temps de cycle du goulot comparé au Takt Time, et le PCE (part du temps à valeur ajoutée) inférieur à 1 %.' },
  { id: 't6', phase: 'measure', title: 'Mesurer la capabilité', to: '/sixsigma/capability', what: 'Regardez l\'histogramme et les indices.', look: 'Cp ≈ 1,5 mais Cpk ≈ 0,7 : le procédé est précis mais décentré vers la limite haute.' },
  { id: 't4', phase: 'analyze', title: 'Repérer les gaspillages', to: '/lean/muda', what: 'Cliquez sur chacune des 8 cartes.', look: 'Les gaspillages « élevés », leurs causes probables et les améliorations proposées.' },
  { id: 't7', phase: 'analyze', title: 'Trouver la cause', to: '/sixsigma/stats/corr', what: 'Choisissez la variable « Température broche ».', look: 'Une corrélation forte et significative : la température fait grossir le diamètre.' },
  { id: 't8', phase: 'improve', title: 'Corriger le réglage', to: '/sixsigma/process', what: 'Déplacez la température de 43 °C vers 35 °C, puis « Appliquer au scénario ».', look: 'Le Cpk prédit qui dépasse 1,33 et les rebuts simulés qui baissent.' },
  { id: 't9', phase: 'improve', title: 'Réduire les changements de série', to: '/lean/smed', what: 'Sur le tour CNC, étudiez la décomposition puis « Appliquer au scénario ».', look: 'Le changement de série divisé par 3 à 4 et le débit qui augmente.' },
  { id: 't10', phase: 'improve', title: 'Comparer avant / après', to: '/lss', what: 'Avant : Situation initiale · Après : Lean Six Sigma.', look: 'Les gains Lean, Six Sigma et combinés, le ROI et le délai de retour sur investissement.' },
  { id: 't11', phase: 'control', title: 'Produire le rapport', to: '/reports', what: 'Choisissez les sections puis « Générer le rapport PDF ».', look: 'Un rapport de 11 sections prêt à présenter.' },
]

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: 'Où sont enregistrées mes données ?', a: 'Sur votre appareil uniquement, dans le navigateur ou l\'application installée. Elles ne sont envoyées nulle part. Un autre appareil ou un autre navigateur ne les voit pas.' },
  { q: 'Comment partager mon travail avec quelqu\'un ?', a: <>Dans <Link className="text-brand-600 underline" to="/scenarios">Gestion des scénarios</Link>, cliquez sur <b>Exporter</b> : un fichier .json est créé. Envoyez-le ; l'autre personne clique sur <b>Importer</b>. Attention, l'import remplace ses propres données.</> },
  { q: 'J\'ai fait une erreur, comment revenir en arrière ?', a: <>Chaque modification appliquée depuis un outil crée une version. Dans <Link className="text-brand-600 underline" to="/scenarios">Gestion des scénarios</Link> → <b>Historique des versions</b> → <b>Restaurer</b>. Pensez aussi au bouton « Enregistrer une version » avant une grosse modification.</> },
  { q: 'Comment repartir de zéro ?', a: <>Dans Gestion des scénarios, bouton <b>Données de démo</b>. Toutes vos données sont alors remplacées par le jeu de démonstration.</> },
  { q: 'Pourquoi les résultats ne changent pas quand je relance ?', a: 'La simulation est reproductible : avec la même « graine aléatoire », la journée est identique. Changez la graine dans Ligne de production pour obtenir une autre journée, ou activez le mode « Robustesse » dans Lean Six Sigma pour moyenner 8 journées.' },
  { q: 'Les chiffres sont-ils réalistes ?', a: <>Ils découlent d'un modèle explicite (pannes, temps de cycle variables, modèle statistique du diamètre…) et ne sont jamais ajustés pour « faire joli ». Tout est documenté dans <Link className="text-brand-600 underline" to="/docs">Hypothèses & formules</Link>.</> },
  { q: 'Puis-je utiliser mes propres données ?', a: <>Oui. Dans <Link className="text-brand-600 underline" to="/data">Mes données</Link>, importez votre classeur Excel (.xlsx), un CSV, ou collez vos cellules : mesures (avec tolérances), défauts, description de votre ligne. Elles deviennent ensuite des sources dans Capabilité, SPC et Analyse des défauts. Pour un essai rapide, la « Saisie manuelle » de ces pages accepte aussi un simple collage de valeurs.</> },
  { q: 'Comment l\'appli choisit-elle les améliorations proposées ?', a: <>Le <Link className="text-brand-600 underline" to="/plan">Plan d'amélioration</Link> repère les leviers pertinents (goulot, changements de série, pannes, flux poussé, défauts, centrage et dispersion), applique chaque action à une copie de votre scénario, simule plusieurs journées avec les mêmes aléas et mesure la différence. Le gain dépend de la justesse de vos paramètres : vérifiez temps de cycle, disponibilités et coûts.</> },
  { q: 'Mon fichier Excel ne s\'importe pas', a: 'Les classeurs .xlsx sont lus directement (choisissez la feuille). Un ancien fichier .xls doit être réenregistré en .xlsx. Chaque feuille doit avoir une ligne d\'en-têtes puis une ligne par élément, sans cellules fusionnées. Les cellules au format % sont reprises telles qu\'affichées ; une saisie en nombre est lue en pourcentage pour le taux de défauts (0,5 = 0,5 %). En dernier recours : copier les cellules et les coller dans la zone de texte.' },
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
  ['TRG', 'Taux de Rendement Global = temps utile / temps d\'ouverture (tient compte des arrêts planifiés, contrairement au TRS).'],
  ['RTF', 'Ratio de Tension de Flux = Σ VA / (Σ VA + Takt × Σ en-cours) : part de valeur ajoutée dans le flux.'],
  ['Cm / Cmk', 'Capabilité machine (dispersion instantanée, contexte figé). Objectif du cours : > 2.'],
  ['Cpm', 'Indice de Taguchi : pénalise l\'écart à la cible, pas seulement aux limites.'],
  ['MSA / R&R', 'Analyse du système de mesure : répétabilité (instrument) et reproductibilité (opérateurs). %R&R < 10 % souhaitable, > 30 % à améliorer.'],
  ['Cmc', 'Capabilité du moyen de contrôle (méthode de Charbonneau) : IT / 6σ mesure, capable si > 4.'],
  ['MARP', 'Méthode d\'Analyse et de Résolution de Problèmes : définir, chercher les causes, les solutions, valider, pérenniser.'],
  ['QQOQCPC', 'Quoi, Qui, Où, Quand, Comment, Pourquoi, Combien : définir un problème par les faits.'],
  ['8D / A3', 'Démarches de résolution de problèmes en groupe (8D : Ford, avec confinement ; A3 : Toyota, sur une page).'],
  ['Kano', 'Classement des attentes clients : obligatoires, proportionnelles, attractives, indifférentes.'],
  ['Vote pondéré', 'Choix collectif : notes 1-3-9 par critère, multipliées par le poids du critère.'],
  ['Multi-vari', 'Graphique qui montre si la variation vient surtout de pièce à pièce, du temps ou des lots.'],
  ['Box-Cox', 'Transformation qui rend des données non normales compatibles avec la loi normale.'],
  ['Puissance', 'Probabilité de détecter une différence qui existe vraiment ; fixe l\'effectif à collecter.'],
  ['TOC', 'Théorie des contraintes (Goldratt) : identifier, exploiter, subordonner, élever, recommencer.'],
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
  const [tab, setTab] = useUrlTab<Tab>('start', TABS)
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
          { id: 'modules', label: 'La démarche & les outils' },
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
          <Card title="Travailler sur votre propre usine" className="lg:col-span-3" subtitle="De vos fichiers Excel à un plan d'amélioration chiffré">
            <ol className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
              {[
                ['Préparer', 'Dans Mes données, téléchargez le modèle Excel (feuilles Ligne, Mesures, Défauts) et complétez-le.', '/data'],
                ['Importer', 'Importez votre classeur .xlsx (choix de la feuille), un CSV ou un copier-coller ; vérifiez l\'association des colonnes.', '/data'],
                ['Décrire', 'Créez le scénario de votre ligne, renseignez prix, coûts, demande et horaires ; calez le modèle qualité sur vos mesures.', '/data'],
                ['Analyser', 'Capabilité, cartes de contrôle et Pareto acceptent vos données réelles comme source.', '/sixsigma/capability'],
                ['Améliorer', 'Le Plan d\'amélioration diagnostique vos données, simule les actions possibles et les classe par gain.', '/plan'],
              ].map(([t, d, to], i) => (
                <li key={t} className="rounded-lg bg-black/[.03] p-3 dark:bg-white/[.05]">
                  <div className="font-semibold">{i + 1}. {t}</div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{d}</p>
                  <Link to={to} className="mt-1.5 inline-block text-xs text-brand-600 underline">Ouvrir</Link>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Comment lire l'écran" className="lg:col-span-3">
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><b>Menu de gauche</b><p className="text-xs text-[var(--muted)]">Vos projets et vos données, puis les 5 phases de la démarche DMAIC, chacune avec ses outils. Sur téléphone : icône ☰ en haut à gauche.</p></div>
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
                    <h3 className={clsx('flex flex-wrap items-center gap-2 font-semibold', ok && 'text-[var(--muted)] line-through')}>
                      Étape {i + 1} · {s.title}
                      <Badge tone="brand">{phaseById(s.phase)!.n} · {phaseById(s.phase)!.label}</Badge>
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
          <Card title="Une démarche, des outils" subtitle="L'appli suit la démarche DMAIC de résolution de problèmes">
            <div className="space-y-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              <p>
                Les outils ne sont pas rangés par famille (Lean, Six Sigma…) mais par <b className="text-[var(--text-primary)]">étape de la démarche</b>. On ne cherche pas de solution avant d'avoir défini le problème, on ne cherche pas les causes avant d'avoir des données fiables, et on ne clôture pas sans avoir pérennisé.
              </p>
              <p>
                DMAIC est la version complète de la <b className="text-[var(--text-primary)]">MARP</b> (Méthode d'Analyse et de Résolution de Problèmes) : définir, chercher les causes, chercher des solutions, valider, pérenniser. Pour un problème simple, une démarche courte suffit (Kaizen / PDCA, A3, 8D) : voyez « Choisir la démarche » dans la phase Définir.
              </p>
              <p>
                Dans le menu, chaque phase ouvre une page qui rappelle son objectif, les questions à se poser, ses outils, ses livrables et sa revue de fin de phase. La <Link className="text-brand-600 underline" to="/outils">Boîte à outils</Link> liste tous les outils ; <Link className="text-brand-600 underline" to="/sixsigma/dmaic">Mes projets</Link> garde la trace de votre projet.
              </p>
            </div>
          </Card>
          {PHASES.map((p) => (
            <Card
              key={p.id}
              title={<span className="inline-flex items-center gap-2"><PhaseIcon id={p.id} /> {p.n} · {p.label} <span className="font-normal text-[var(--muted)]">— {p.marp}</span></span>}
              subtitle={p.goal}
              actions={<Link to={`/dmaic/${p.id}`} className="text-xs text-brand-600 underline">Ouvrir la phase</Link>}
            >
              <ol className="space-y-2 text-sm">
                {p.steps.map((st) => (
                  <li key={st.n} className="flex flex-wrap gap-x-2 gap-y-1">
                    <span className="font-semibold">{st.n} {st.title} :</span>
                    {st.tools.map((x, i) => (
                      <span key={x.id}>
                        <Link to={toolById(x.id)!.to} className="text-brand-600 hover:underline dark:text-brand-300">{x.role ?? toolById(x.id)!.name}</Link>
                        {i < st.tools.length - 1 ? ' ·' : ''}
                      </span>
                    ))}
                  </li>
                ))}
              </ol>
            </Card>
          ))}
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

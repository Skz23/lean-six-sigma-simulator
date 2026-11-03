import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Factory, FolderOpen, PencilRuler, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { demoDmaic } from '../data/demoTools'
import { phaseById, rememberPhase, toolById } from '../workflow/phases'
import { nextTarget, projectProgress } from '../workflow/project'

const KEY = 'lss-welcome-shown'
export const DEMO_PROJECT_ID = 'dmaic-1'

function alreadyShown() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
function markShown() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* stockage indisponible : l'écran pourra réapparaître */
  }
}

/** Écran d'accueil affiché à chaque lancement de l'appli : exemple, nouveau projet, ou reprise. */
export function Welcome() {
  const [open, setOpen] = useState(() => !alreadyShown())
  const nav = useNavigate()
  const projects = useStore((s) => s.tools.dmaic)
  const scenarios = useStore((s) => s.scenarios)
  const currentId = useStore((s) => s.currentProjectId)
  const openProject = useStore((s) => s.openProject)
  const setTools = useStore((s) => s.setTools)
  if (!open) return null

  const close = () => {
    markShown()
    setOpen(false)
  }
  const mine = projects.filter((p) => p.id !== DEMO_PROJECT_ID)
  const resume = mine.find((p) => p.id === currentId) ?? mine[mine.length - 1]
  const demoScenario = scenarios.find((s) => s.kind === 'initial') ?? scenarios[0]

  const example = () => {
    if (!projects.some((p) => p.id === DEMO_PROJECT_ID)) setTools((t) => t.dmaic.unshift(demoDmaic(demoScenario.id)))
    openProject(DEMO_PROJECT_ID)
    close()
    nav('/')
  }
  const fresh = () => {
    close()
    nav('/projets?new=blank')
  }
  const goOn = () => {
    if (!resume) return
    openProject(resume.id)
    close()
    const t = nextTarget(resume)
    if (t) rememberPhase(t.phase.id)
    nav(t ? toolById(t.tool.id)!.to : '/projets/synthese')
  }

  const Choice = ({ icon, title, text, onClick, primary }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; primary?: boolean }) => (
    <button
      onClick={onClick}
      className={
        'group flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ' +
        (primary ? 'border-brand-500 bg-brand-500/10 hover:bg-brand-500/15' : 'border-black/[.08] hover:border-brand-500/60 dark:border-white/10')
      }
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-600 text-white">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-[var(--text-secondary)]">{text}</span>
      </span>
      <ArrowRight size={18} className="mt-2.5 shrink-0 text-[var(--muted)] group-hover:text-brand-600" />
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="relative w-full max-w-xl rounded-2xl bg-[var(--surface-1)] p-5 shadow-2xl sm:p-6">
        <button onClick={close} className="absolute top-3 right-3 rounded-md p-1.5 text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/10" aria-label="Fermer">
          <X size={18} />
        </button>
        <h2 id="welcome-title" className="pr-8 text-xl font-semibold tracking-tight">Bienvenue dans Lean Six Sigma Simulator</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Que voulez-vous faire ?</p>
        <div className="mt-4 space-y-3">
          {resume && (
            <Choice
              primary
              icon={<FolderOpen size={20} />}
              title={`Reprendre « ${resume.name} »`}
              text={`Phase ${phaseById(resume.phase)!.n} · ${phaseById(resume.phase)!.label} — ${Math.round(projectProgress(resume).ratio * 100)} % des outils faits.${nextTarget(resume) ? ` Prochain outil : ${nextTarget(resume)!.tool.role ?? toolById(nextTarget(resume)!.tool.id)!.name}.` : ''}`}
              onClick={goOn}
            />
          )}
          <Choice
            primary={!resume}
            icon={<PencilRuler size={20} />}
            title="Créer un nouveau projet, de A à Z"
            text="Votre problème, votre ligne : vous partez d'une page blanche et l'appli vous guide phase par phase (Définir → Contrôler)."
            onClick={fresh}
          />
          <Choice
            icon={<Factory size={20} />}
            title="Voir l'exemple MécaPrécis SAS"
            text="Une usine d'arbres usinés qui livre en retard et rebute trop. Le projet de démonstration est déjà commencé : explorez-le librement."
            onClick={example}
          />
        </div>
        <button onClick={close} className="mt-4 text-sm text-[var(--text-secondary)] underline">
          Fermer et aller directement à l'appli
        </button>
      </div>
    </div>
  )
}

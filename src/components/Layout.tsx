import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Home, FolderOpen, Database, FolderKanban, FileText, Wrench, BookMarked, BookOpen, Moon, Sun, Menu, X, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { PHASES, lastPhase, rememberPhase, stepsOf, toolsAt } from '../workflow/phases'
import { PhaseIcon } from './PhaseNav'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const TOP: NavItem[] = [
  { label: 'Accueil', icon: <Home size={17} />, to: '/' },
  { label: 'Mes projets', icon: <FolderOpen size={17} />, to: '/sixsigma/dmaic' },
  { label: 'Mes données', icon: <Database size={17} />, to: '/data' },
]
const RESULTS: NavItem[] = [
  { label: 'Scénarios', icon: <FolderKanban size={17} />, to: '/scenarios' },
  { label: 'Rapports', icon: <FileText size={17} />, to: '/reports' },
]
const HELP: NavItem[] = [
  { label: 'Boîte à outils', icon: <Wrench size={17} />, to: '/outils' },
  { label: 'Guide d\'utilisation', icon: <BookMarked size={17} />, to: '/guide' },
  { label: 'Hypothèses & formules', icon: <BookOpen size={17} />, to: '/docs' },
]

/** Phase « courante » : page de phase, ou outil ouvert depuis une phase. */
function useCurrentPhase(): string | undefined {
  const loc = useLocation()
  const m = loc.pathname.match(/^\/dmaic\/(\w+)/)
  if (m) return m[1]
  const tools = toolsAt(loc.pathname, loc.search)
  if (!tools.length) return undefined
  const last = lastPhase()
  const phases = tools.flatMap((t) => t.phases)
  return last && phases.includes(last as never) ? last : phases[0]
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
        <rect width="32" height="32" rx="7" fill="#157a6f" />
        <path d="M6 22 L12 14 L17 18 L26 8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="26" cy="8" r="2.5" fill="#fbbf24" />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white">Lean Six Sigma</div>
        <div className="text-[11px] text-white/60">Simulator</div>
      </div>
    </div>
  )
}

const linkCls = ({ isActive }: { isActive: boolean }) =>
  clsx('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors', isActive ? 'bg-white/12 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')

function Section({ title }: { title: string }) {
  return <div className="mt-4 mb-1 px-2.5 text-[10.5px] font-semibold tracking-wider text-white/40 uppercase">{title}</div>
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const current = useCurrentPhase()
  const items = (list: NavItem[]) =>
    list.map((i) => (
      <NavLink key={i.to} to={i.to} end onClick={onNavigate} className={linkCls}>
        {i.icon}
        {i.label}
      </NavLink>
    ))
  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto bg-[#0f2a28] px-3 py-4 dark:bg-[#0b1a19]">
      <Logo />
      <div className="mt-5 space-y-0.5">{items(TOP)}</div>
      <Section title="Démarche DMAIC" />
      <div className="space-y-0.5">
        {PHASES.map((p) => (
          <Link
            key={p.id}
            to={`/dmaic/${p.id}`}
            onClick={onNavigate}
            className={clsx(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
              current === p.id ? 'bg-white/12 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
            )}
          >
            <span className={clsx('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold', current === p.id ? 'bg-brand-500 text-white' : 'bg-white/10 text-white/80')}>{p.n}</span>
            <span className="flex-1">{p.label}</span>
            <span className="text-white/40"><PhaseIcon id={p.id} size={14} /></span>
          </Link>
        ))}
      </div>
      <Section title="Résultats" />
      <div className="space-y-0.5">{items(RESULTS)}</div>
      <Section title="Aide" />
      <div className="space-y-0.5">{items(HELP)}</div>
      <div className="mt-auto px-2 pt-6 text-[11px] leading-relaxed text-white/40">Laboratoire virtuel d'amélioration continue</div>
    </nav>
  )
}

/** Fil d'Ariane d'un outil : phase, sous-étape, et autres étapes où il sert. */
function ToolContext() {
  const loc = useLocation()
  const current = useCurrentPhase()
  if (loc.pathname.startsWith('/dmaic/')) return null
  const tools = toolsAt(loc.pathname, loc.search)
  if (!tools.length) return null
  const crumb = 'rounded-full px-2 py-0.5 font-medium hover:bg-black/5 dark:hover:bg-white/10'
  if (tools.length > 1) {
    const phases = PHASES.filter((p) => tools.some((t) => t.phases.includes(p.id)))
    return (
      <div className="no-print mb-4 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        <span>Démarche DMAIC</span>
        <ChevronRight size={13} />
        {phases.map((p) => (
          <Link key={p.id} to={`/dmaic/${p.id}`} className={crumb}>
            {p.n} · {p.label}
          </Link>
        ))}
      </div>
    )
  }
  const t = tools[0]
  const occ = stepsOf(t.id)
  const main = occ.find((o) => o.phase.id === current) ?? occ[0]
  const others = occ.filter((o) => o !== main)
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--text-secondary)]">
      {main && (
        <>
          <Link to={`/dmaic/${main.phase.id}`} className={clsx(crumb, 'bg-brand-600/10 text-brand-700 dark:text-brand-300')}>
            {main.phase.n} · {main.phase.label}
          </Link>
          <ChevronRight size={13} />
          <Link to={`/dmaic/${main.phase.id}`} className={crumb}>
            {main.step.n} {main.step.title}
          </Link>
          <ChevronRight size={13} />
        </>
      )}
      <span className="font-medium text-[var(--text-primary)]">{main?.role ?? t.name}</span>
      {others.length > 0 && (
        <span className="ml-2 flex flex-wrap items-center gap-1 text-[var(--muted)]">
          aussi en
          {others.map((o) => (
            <Link key={o.step.n} to={`/dmaic/${o.phase.id}`} onClick={() => rememberPhase(o.phase.id)} className={crumb}>
              {o.step.n} {o.role ? `(${o.role.toLowerCase()})` : o.step.title}
            </Link>
          ))}
        </span>
      )}
    </div>
  )
}

function ScenarioPicker() {
  const scenarios = useStore((s) => s.scenarios)
  const activeId = useStore((s) => s.activeId)
  const setActive = useStore((s) => s.setActive)
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <span className="hidden text-[var(--text-secondary)] sm:inline">Scénario actif</span>
      <select
        value={activeId}
        onChange={(e) => setActive(e.target.value)}
        className="h-8 max-w-[220px] min-w-0 rounded-lg border border-black/10 bg-white px-2 text-sm font-medium dark:border-white/15 dark:bg-white/5"
      >
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function Layout() {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const [mobile, setMobile] = useState(false)
  const loc = useLocation()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [loc.pathname])
  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 lg:block">
        <Sidebar />
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobile(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <Sidebar onNavigate={() => setMobile(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 shrink-0 items-center gap-3 border-b border-black/[.08] bg-[var(--surface-1)] px-4 dark:border-white/10">
          <button className="rounded-md p-1.5 hover:bg-black/5 lg:hidden dark:hover:bg-white/10" onClick={() => setMobile(true)} aria-label="Menu">
            {mobile ? <X size={18} /> : <Menu size={18} />}
          </button>
          <ScenarioPicker />
          <div className="ml-auto flex items-center gap-1">
            <NavLink to="/guide" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10" title="Guide d'utilisation">
              <BookMarked size={16} /> <span className="hidden sm:inline">Guide</span>
            </NavLink>
            <button onClick={toggleTheme} className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10" aria-label="Changer de thème" title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
            <ToolContext />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

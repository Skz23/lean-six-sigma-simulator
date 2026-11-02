import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  LayoutDashboard,
  Factory,
  Sigma,
  Combine,
  FolderKanban,
  FileText,
  Moon,
  Sun,
  Menu,
  X,
  BookOpen,
  ChevronDown,
  BookMarked,
} from 'lucide-react'
import { useStore } from '../store/useStore'

interface NavItem {
  to: string
  label: string
}
interface NavGroup {
  label: string
  icon: React.ReactNode
  to?: string
  items?: NavItem[]
}

const NAV: NavGroup[] = [
  { label: 'Dashboard général', icon: <LayoutDashboard size={17} />, to: '/' },
  { label: 'Guide d\'utilisation', icon: <BookMarked size={17} />, to: '/guide' },
  {
    label: 'Lean Manufacturing',
    icon: <Factory size={17} />,
    items: [
      { to: '/lean/line', label: 'Ligne de production' },
      { to: '/lean/simulation', label: 'Simulation' },
      { to: '/lean/kpi', label: 'Indicateurs Lean' },
      { to: '/lean/muda', label: '8 gaspillages (Muda)' },
      { to: '/lean/vsm', label: 'VSM' },
      { to: '/lean/smed', label: 'SMED' },
      { to: '/lean/kanban', label: 'Kanban' },
      { to: '/lean/5s', label: '5S' },
      { to: '/lean/spaghetti', label: 'Diagramme spaghetti' },
      { to: '/lean/kaizen', label: 'Kaizen' },
    ],
  },
  {
    label: 'Six Sigma',
    icon: <Sigma size={17} />,
    items: [
      { to: '/sixsigma/dmaic', label: 'Projets DMAIC' },
      { to: '/sixsigma/process', label: 'Paramètres procédé' },
      { to: '/sixsigma/capability', label: 'Capabilité' },
      { to: '/sixsigma/spc', label: 'SPC — cartes de contrôle' },
      { to: '/sixsigma/defects', label: 'Analyse des défauts' },
      { to: '/sixsigma/stats', label: 'Statistiques avancées' },
    ],
  },
  { label: 'Lean Six Sigma', icon: <Combine size={17} />, to: '/lss' },
  { label: 'Gestion des scénarios', icon: <FolderKanban size={17} />, to: '/scenarios' },
  { label: 'Rapports et analyses', icon: <FileText size={17} />, to: '/reports' },
  { label: 'Hypothèses & formules', icon: <BookOpen size={17} />, to: '/docs' },
]

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

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const loc = useLocation()
  const [open, setOpen] = useState<Record<string, boolean>>({ 'Lean Manufacturing': true, 'Six Sigma': true })
  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto bg-[#0f2a28] px-3 py-4 dark:bg-[#0b1a19]">
      <Logo />
      <div className="mt-5 space-y-0.5">
        {NAV.map((g) =>
          g.to ? (
            <NavLink
              key={g.label}
              to={g.to}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors', isActive ? 'bg-white/12 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')
              }
            >
              {g.icon}
              {g.label}
            </NavLink>
          ) : (
            <div key={g.label}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.label]: !o[g.label] }))}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-white/5',
                  g.items!.some((i) => loc.pathname.startsWith(i.to)) ? 'text-white' : 'text-white/70',
                )}
              >
                {g.icon}
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown size={14} className={clsx('transition-transform', open[g.label] ? '' : '-rotate-90')} />
              </button>
              {open[g.label] && (
                <div className="mt-0.5 mb-1 ml-[18px] space-y-0.5 border-l border-white/10 pl-3">
                  {g.items!.map((i) => (
                    <NavLink
                      key={i.to}
                      to={i.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        clsx('block rounded-md px-2 py-1.5 text-[13px] transition-colors', isActive ? 'bg-brand-500/25 font-medium text-white' : 'text-white/60 hover:text-white')
                      }
                    >
                      {i.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
      </div>
      <div className="mt-auto px-2 pt-6 text-[11px] leading-relaxed text-white/40">Laboratoire virtuel d'amélioration continue · données simulées</div>
    </nav>
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
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

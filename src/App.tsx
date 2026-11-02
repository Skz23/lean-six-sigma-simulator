import { lazy, Suspense } from 'react'
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const LineEditor = lazy(() => import('./pages/lean/LineEditor'))
const SimulationPage = lazy(() => import('./pages/lean/SimulationPage'))
const LeanKpis = lazy(() => import('./pages/lean/LeanKpis'))
const MudaPage = lazy(() => import('./pages/lean/MudaPage'))
const FiveSPage = lazy(() => import('./pages/lean/FiveSPage'))
const SmedPage = lazy(() => import('./pages/lean/SmedPage'))
const KanbanPage = lazy(() => import('./pages/lean/KanbanPage'))
const VsmPage = lazy(() => import('./pages/lean/VsmPage'))
const SpaghettiPage = lazy(() => import('./pages/lean/SpaghettiPage'))
const KaizenPage = lazy(() => import('./pages/lean/KaizenPage'))
const DmaicPage = lazy(() => import('./pages/sixsigma/DmaicPage'))
const ProcessPage = lazy(() => import('./pages/sixsigma/ProcessPage'))
const CapabilityPage = lazy(() => import('./pages/sixsigma/CapabilityPage'))
const SpcPage = lazy(() => import('./pages/sixsigma/SpcPage'))
const DefectsPage = lazy(() => import('./pages/sixsigma/DefectsPage'))
const StatsPage = lazy(() => import('./pages/sixsigma/StatsPage'))
const LssPage = lazy(() => import('./pages/LssPage'))
const ScenariosPage = lazy(() => import('./pages/ScenariosPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))

function Loading() {
  return <div className="py-20 text-center text-sm text-[var(--muted)]">Chargement…</div>
}

// Version intégrée (artifact) : routage en mémoire, l'URL du cadre hôte n'étant pas modifiable
const Router = import.meta.env.VITE_EMBED ? MemoryRouter : HashRouter

export default function App() {
  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="lean/line" element={<LineEditor />} />
            <Route path="lean/simulation" element={<SimulationPage />} />
            <Route path="lean/kpi" element={<LeanKpis />} />
            <Route path="lean/muda" element={<MudaPage />} />
            <Route path="lean/5s" element={<FiveSPage />} />
            <Route path="lean/smed" element={<SmedPage />} />
            <Route path="lean/kanban" element={<KanbanPage />} />
            <Route path="lean/vsm" element={<VsmPage />} />
            <Route path="lean/spaghetti" element={<SpaghettiPage />} />
            <Route path="lean/kaizen" element={<KaizenPage />} />
            <Route path="sixsigma/dmaic" element={<DmaicPage />} />
            <Route path="sixsigma/process" element={<ProcessPage />} />
            <Route path="sixsigma/capability" element={<CapabilityPage />} />
            <Route path="sixsigma/spc" element={<SpcPage />} />
            <Route path="sixsigma/defects" element={<DefectsPage />} />
            <Route path="sixsigma/stats" element={<StatsPage />} />
            <Route path="lss" element={<LssPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  )
}

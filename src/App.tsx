import { lazy, Suspense } from 'react'
import { HashRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
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
const GuidePage = lazy(() => import('./pages/GuidePage'))
const MyDataPage = lazy(() => import('./pages/MyDataPage'))
const PlanPage = lazy(() => import('./pages/PlanPage'))
const MethodPage = lazy(() => import('./pages/MethodPage'))
const MsaPage = lazy(() => import('./pages/sixsigma/MsaPage'))
const PhasePage = lazy(() => import('./pages/PhasePage'))
const ToolboxPage = lazy(() => import('./pages/ToolboxPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const TestWizardPage = lazy(() => import('./pages/TestWizardPage'))
const SynthesisPage = lazy(() => import('./pages/SynthesisPage'))

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
            <Route path="lean/toc" element={<LeanKpis section="toc" />} />
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
            <Route path="sixsigma/defects/:tab" element={<DefectsPage />} />
            <Route path="sixsigma/stats" element={<StatsPage />} />
            <Route path="sixsigma/stats/:tab" element={<StatsPage />} />
            <Route path="lss" element={<LssPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="guide" element={<GuidePage />} />
            <Route path="data" element={<MyDataPage />} />
            <Route path="plan" element={<PlanPage />} />
            <Route path="methode" element={<MethodPage />} />
            <Route path="methode/:tab" element={<MethodPage />} />
            <Route path="sixsigma/msa" element={<MsaPage />} />
            <Route path="sixsigma/msa/:tab" element={<MsaPage />} />
            <Route path="dmaic" element={<Navigate to="/dmaic/define" replace />} />
            <Route path="dmaic/:phase" element={<PhasePage />} />
            <Route path="outils" element={<ToolboxPage />} />
            <Route path="analyse/quel-test" element={<TestWizardPage />} />
            <Route path="projets" element={<ProjectsPage />} />
            <Route path="projets/synthese" element={<SynthesisPage />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  )
}

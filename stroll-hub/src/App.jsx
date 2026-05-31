import { useState, Suspense, lazy } from 'react'
import './App.css'

const DailyStatus = lazy(() => import('./components/DailyStatus.jsx'))
const StrollDashboard = lazy(() => import('./components/StrollDashboard.jsx'))
const JejuWaterProject = lazy(() => import('./components/JejuWaterProject.jsx'))
const WaterProject = lazy(() => import('./components/WaterProject.jsx'))
const HarechoConceptBoard = lazy(() => import('./components/HarechoConceptBoard.jsx'))
const HarechoMvSchedule = lazy(() => import('./components/HarechoMvSchedule.jsx'))
const ProjectGantt = lazy(() => import('./components/ProjectGantt.jsx'))
const InvestmentDashboard = lazy(() => import('./components/InvestmentDashboard.jsx'))
const UnofficialSpecHub = lazy(() => import('./components/UnofficialSpecHub.jsx'))

const TABS = [
  { id: 'daily-status',        label: 'Daily Status',        icon: '📋', component: DailyStatus },
  { id: 'stroll-dashboard',    label: 'Stroll Dashboard',    icon: '📊', component: StrollDashboard },
  { id: 'jeju-water-project',  label: 'Jeju Water',          icon: '💧', component: JejuWaterProject },
  { id: 'water-project',       label: 'Water Project',       icon: '🌊', component: WaterProject },
  { id: 'hareecho-concept',    label: 'Hareecho Concept',    icon: '🎨', component: HarechoConceptBoard },
  { id: 'hareecho-mv',         label: 'Hareecho MV',         icon: '🎬', component: HarechoMvSchedule },
  { id: 'project-gantt',       label: 'Gantt',               icon: '📅', component: ProjectGantt },
  { id: 'investment',          label: 'Investment',          icon: '💰', component: InvestmentDashboard },
  { id: 'spec-hub',            label: 'Spec Hub',            icon: '📐', component: UnofficialSpecHub },
]

function LoadingSpinner() {
  return (
    <div className="loading">
      <div className="spinner" />
    </div>
  )
}

export default function App() {
  const [activeId, setActiveId] = useState(TABS[0].id)

  const activeTab = TABS.find(t => t.id === activeId)
  const ActiveComponent = activeTab?.component

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-icon">🚶</span>
          <span className="brand-name">Stroll Hub</span>
        </div>
        <nav className="tab-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${tab.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(tab.id)}
              title={tab.label}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        <Suspense fallback={<LoadingSpinner />}>
          {ActiveComponent && <ActiveComponent />}
        </Suspense>
      </main>
    </div>
  )
}

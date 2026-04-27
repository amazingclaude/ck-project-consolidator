import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import BusinessPlanning from './pages/BusinessPlanning'
import PortfolioOverview from './pages/PortfolioOverview'
import ScheduleAnalysis from './pages/ScheduleAnalysis'
import CostAnalysis from './pages/CostAnalysis'
import PlanView from './pages/PlanView'
import AIAssistant from './pages/AIAssistant'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-[#F7FAFC]">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/business-planning" element={<BusinessPlanning />} />
            <Route path="/portfolio-overview" element={<PortfolioOverview />} />
            <Route path="/schedule-analysis" element={<ScheduleAnalysis />} />
            <Route path="/cost-analysis" element={<CostAnalysis />} />
            <Route path="/plan-view" element={<PlanView />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

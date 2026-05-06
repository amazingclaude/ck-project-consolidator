import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PlansProvider } from './context/PlansContext'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import BusinessPlanning from './pages/BusinessPlanning'
import PlanDetail from './pages/PlanDetail'
import PlanEdit from './pages/PlanEdit'
import PortfolioOverview from './pages/PortfolioOverview'
import AIAssistant from './pages/AIAssistant'
import Settings from './pages/Settings'
import DataIngestion from './pages/DataIngestion'

export default function App() {
  return (
    <BrowserRouter>
      <PlansProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-[#F7FAFC]">
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/business-planning" element={<BusinessPlanning />} />
              <Route path="/business-planning/:planId" element={<PlanDetail />} />
              <Route path="/business-planning/:planId/edit" element={<PlanEdit />} />
              <Route path="/portfolio-overview" element={<PortfolioOverview />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/data-ingestion" element={<DataIngestion />} />
            </Routes>
          </main>
        </div>
      </PlansProvider>
    </BrowserRouter>
  )
}

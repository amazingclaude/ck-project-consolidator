import { NavLink } from 'react-router-dom'
import {
  Home,
  Briefcase,
  LayoutGrid,
  CalendarClock,
  DollarSign,
  Map,
  Bot,
  Settings,
} from 'lucide-react'

const navItems = [
  { label: 'Home', icon: Home, to: '/home' },
  { label: 'Business Planning', icon: Briefcase, to: '/business-planning' },
  { label: 'Portfolio Overview', icon: LayoutGrid, to: '/portfolio-overview' },
  { label: 'Schedule Analysis', icon: CalendarClock, to: '/schedule-analysis' },
  { label: 'Cost Analysis', icon: DollarSign, to: '/cost-analysis' },
  { label: 'Plan View', icon: Map, to: '/plan-view' },
  { label: 'AI Assistant', icon: Bot, to: '/ai-assistant' },
  { label: 'Settings', icon: Settings, to: '/settings' },
]

export default function Sidebar() {
  return (
    <aside
      className="w-[260px] shrink-0 flex flex-col h-full px-4 py-5"
      style={{
        background: 'linear-gradient(180deg, #1B2A4A 0%, #0F1C33 100%)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 mb-8 px-1">
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500 text-white font-bold text-sm shrink-0">
          CK
        </span>
        <span className="text-white font-semibold text-base leading-tight">
          Connected Kerb
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {navItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5',
              ].join(' ')
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

import { useNavigate } from 'react-router-dom'
import { Briefcase, LayoutGrid, Bot, Settings } from 'lucide-react'

const cards = [
  {
    title: 'Business Planning',
    description:
      'Define project scope, set financial targets, and manage business cases for EV infrastructure rollouts.',
    icon: Briefcase,
    to: '/business-planning',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    linkColor: 'text-emerald-600 hover:text-emerald-700',
  },
  {
    title: 'Portfolio Overview',
    description:
      'Track all active and planned EV charging projects across UK regions in a single consolidated view.',
    icon: LayoutGrid,
    to: '/portfolio-overview',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    linkColor: 'text-blue-600 hover:text-blue-700',
  },
  {
    title: 'AI Assistant',
    description:
      'Get intelligent recommendations, generate reports, and surface insights using natural language queries.',
    icon: Bot,
    to: '/ai-assistant',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    linkColor: 'text-purple-600 hover:text-purple-700',
  },
  {
    title: 'Settings',
    description:
      'Configure platform preferences, manage user access, and customise regional data integrations.',
    icon: Settings,
    to: '/settings',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    linkColor: 'text-gray-600 hover:text-gray-700',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="px-8 py-8 min-h-full">
      {/* Header */}
      <div className="flex items-start gap-4 mb-10">
        <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 text-white font-bold text-base shrink-0 mt-0.5">
          CK
        </span>
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
            Welcome to Connected Kerb
          </h1>
          <p className="mt-2 text-base text-gray-500 max-w-2xl">
            Your centralised platform for EV charging infrastructure planning,
            project portfolio management, and performance tracking across UK
            regions.
          </p>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-6">
        {cards.map(({ title, description, icon: Icon, to, bg, border, iconBg, iconColor, linkColor }) => (
          <div
            key={to}
            className={`${bg} ${border} border rounded-xl p-6 flex flex-col gap-4`}
          >
            <div className={`w-11 h-11 rounded-lg ${iconBg} flex items-center justify-center`}>
              <Icon size={22} className={iconColor} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">{title}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
            </div>
            <button
              onClick={() => navigate(to)}
              className={`self-start text-sm font-semibold ${linkColor} transition-colors`}
            >
              Open →
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

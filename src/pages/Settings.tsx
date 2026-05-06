import { useNavigate } from 'react-router-dom'
import { Database } from 'lucide-react'

export default function Settings() {
  const navigate = useNavigate()

  return (
    <div className="px-8 py-8 min-h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage platform configuration and supporting data workflows.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => navigate('/settings/data-ingestion')}
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 text-left hover:border-emerald-300 hover:shadow-md transition-all"
        >
          <span className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
            <Database size={22} />
          </span>
          <h2 className="text-lg font-bold text-gray-900">Data Ingestion</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Upload and manage source files for project consolidation workflows.
          </p>
        </button>
      </div>
    </div>
  )
}

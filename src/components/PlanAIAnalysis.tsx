import { useState, useEffect } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { fetchPlanAIAnalysis } from '../api/plansApi'

interface Props {
  planId: string
}

export default function PlanAIAnalysis({ planId }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchPlanAIAnalysis(planId)
      .then(res => setAnalysis(res.analysis))
      .catch(e => setError(e instanceof Error ? e.message : 'AI analysis unavailable'))
      .finally(() => setLoading(false))
  }, [planId])

  return (
    <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-violet-600" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700">AI Analysis</h3>
        <span className="text-xs text-gray-400 font-medium px-2 py-0.5 bg-gray-100 rounded-full">
          Overall summary · unaffected by filters
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-400 py-4">
          <Loader2 size={16} className="animate-spin shrink-0" />
          <span className="text-sm">Generating analysis…</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>
            AI analysis is unavailable — ensure <code className="font-mono text-xs bg-amber-100 px-1 rounded">AI_FOUNDRY_ENDPOINT</code> and{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">AI_FOUNDRY_API_KEY</code> are configured.
          </span>
        </div>
      )}

      {!loading && analysis && (
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{analysis}</p>
      )}
    </div>
  )
}

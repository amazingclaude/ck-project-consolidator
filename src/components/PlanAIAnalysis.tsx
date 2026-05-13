import { useState, useEffect } from 'react'
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { fetchPlanAIAnalysis, regeneratePlanAIAnalysis } from '../api/plansApi'

interface Props {
  planId: string
}

export default function PlanAIAnalysis({ planId }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchPlanAIAnalysis(planId)
      .then(res => {
        setAnalysis(res.analysis)
        setGeneratedAt(res.generated_at)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load analysis'))
      .finally(() => setLoading(false))
  }, [planId])

  const handleRegenerate = async () => {
    setRegenerating(true)
    setError(null)
    try {
      const res = await regeneratePlanAIAnalysis(planId)
      setAnalysis(res.analysis)
      setGeneratedAt(res.generated_at)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI analysis unavailable')
    } finally {
      setRegenerating(false)
    }
  }

  const formattedDate = generatedAt
    ? new Date(generatedAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles size={15} className="text-violet-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">AI Analysis</h3>
          <span className="text-xs text-gray-400 font-medium px-2 py-0.5 bg-gray-100 rounded-full">
            Overall summary · unaffected by filters
          </span>
        </div>

        <button
          onClick={handleRegenerate}
          disabled={regenerating || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 border border-violet-200 hover:border-violet-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? 'Generating…' : analysis ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-400 py-2">
          <Loader2 size={15} className="animate-spin shrink-0" />
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>
            AI analysis unavailable — ensure{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">AI_FOUNDRY_ENDPOINT</code>{' '}
            and{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">AI_FOUNDRY_API_KEY</code>{' '}
            are configured.
          </span>
        </div>
      )}

      {/* Empty state — no analysis yet */}
      {!loading && !error && !analysis && (
        <p className="text-sm text-gray-400 py-2">
          No analysis yet. Click <span className="font-semibold text-violet-500">Generate</span> to
          create one. Re-generate any time you update assumptions or plan data.
        </p>
      )}

      {/* Analysis content */}
      {!loading && analysis && (
        <>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{analysis}</p>
          {formattedDate && (
            <p className="mt-4 text-xs text-gray-400">Generated {formattedDate}</p>
          )}
        </>
      )}
    </div>
  )
}

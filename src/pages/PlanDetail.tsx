import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Archive, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { usePlans } from '../context/PlansContext'
import { fetchPlanMetrics, fetchAssumptions, fetchPlanRows, fetchCapexIncurred, updateAssumptions } from '../api/plansApi'
import type { PlanMetrics, Assumptions, PlanRow, CapexIncurredData, AssumptionsUpdate } from '../api/plansApi'
import MetricsSection, { MetricsSkeleton } from '../components/MetricsSection'
import AssumptionSheet from '../components/AssumptionSheet'
import PlanCharts from '../components/PlanCharts'

export default function PlanDetail() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const { getPlan, loading, archivePlan, unarchivePlan, deletePlan } = usePlans()

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [metrics, setMetrics] = useState<PlanMetrics | null>(null)
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState<string | null>(null)

  const [rows, setRows] = useState<PlanRow[]>([])
  const [capexIncurred, setCapexIncurred] = useState<CapexIncurredData | null>(null)
  const [rowsLoading, setRowsLoading] = useState(false)

  const plan = getPlan(planId ?? '')

  useEffect(() => {
    if (!plan?.id) return
    setMetricsLoading(true)
    setMetricsError(null)
    Promise.all([fetchPlanMetrics(plan.id), fetchAssumptions()])
      .then(([m, a]) => { setMetrics(m); setAssumptions(a) })
      .catch(e => setMetricsError(e instanceof Error ? e.message : 'Failed to load metrics'))
      .finally(() => setMetricsLoading(false))
  }, [plan?.id])

  useEffect(() => {
    if (!plan?.id) return
    setRowsLoading(true)
    Promise.all([fetchPlanRows(plan.id), fetchCapexIncurred(plan.id)])
      .then(([planRows, incurred]) => {
        setRows(planRows)
        setCapexIncurred(incurred)
      })
      .catch(console.error)
      .finally(() => setRowsLoading(false))
  }, [plan?.id])

  if (loading && !plan) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="px-8 py-8">
        <button
          onClick={() => navigate('/business-planning')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Business Planning
        </button>
        <p className="text-gray-500">Plan not found.</p>
      </div>
    )
  }

  const isArchived = plan.status === 'archived'

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deletePlan(plan.id)
      navigate('/business-planning')
    } catch (e) {
      console.error(e)
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  const toggleArchive = () => {
    if (isArchived) unarchivePlan(plan.id).catch(console.error)
    else archivePlan(plan.id).catch(console.error)
  }

  const handleAssumptionsSave = async (updates: AssumptionsUpdate) => {
    const updatedAssumptions = await updateAssumptions(updates)
    const updatedMetrics = await fetchPlanMetrics(plan.id)
    setAssumptions(updatedAssumptions)
    setMetrics(updatedMetrics)
  }

  return (
    <div className="px-8 py-8 min-h-full">
      {/* Back breadcrumb */}
      <button
        onClick={() => navigate('/business-planning')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Business Planning
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-gray-900">{plan.name}</h1>
            {isArchived && (
              <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full">
                Archived
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Created{' '}
            {new Date(plan.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {` · Planning year ${plan.planYear}`}
            {plan.fileName && ` · ${plan.fileName}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleArchive}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
          >
            <Archive size={15} />
            {isArchived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            onClick={() => navigate(`/business-planning/${plan.id}/edit`)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
          >
            <Pencil size={15} /> Modify
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg transition-colors"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      {/* Metrics */}
      {metricsLoading && <MetricsSkeleton />}
      {metricsError && (
        <div className="flex items-center gap-2 mb-8 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          Could not load metrics: {metricsError}
        </div>
      )}
      {!metricsLoading && metrics && assumptions && (
        <MetricsSection metrics={metrics} assumptions={assumptions} />
      )}
      {!metricsLoading && assumptions && (
        <AssumptionSheet assumptions={assumptions} onSave={handleAssumptionsSave} />
      )}

      {/* Charts */}
      {rowsLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-400 mt-6">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading chart data…</span>
        </div>
      ) : rows.length > 0 && capexIncurred ? (
        <PlanCharts rows={rows} capexIncurred={capexIncurred} />
      ) : null}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Plan?</h3>
            <p className="text-sm text-gray-500 mb-6">
              <span className="font-medium text-gray-700">"{plan.name}"</span> will be permanently
              deleted. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

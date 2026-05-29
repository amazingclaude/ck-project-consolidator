import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Database, Loader2, Trash2 } from 'lucide-react'
import { deleteStageGatePlan } from '../api/portfolioApi'

export default function Settings() {
  const navigate = useNavigate()
  const [deleteYear, setDeleteYear] = useState(String(new Date().getFullYear()))
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const parsedDeleteYear = Number(deleteYear)
  const canDelete =
    Number.isInteger(parsedDeleteYear) &&
    parsedDeleteYear >= 2000 &&
    parsedDeleteYear <= 2100 &&
    !deleting

  async function handleDeleteStageGatePlan() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      setDeleteMessage('')
      setDeleteError('')
      return
    }

    setDeleting(true)
    setDeleteMessage('')
    setDeleteError('')
    try {
      const result = await deleteStageGatePlan(parsedDeleteYear)
      setDeleteMessage(result.message)
      setConfirmingDelete(false)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete stage gate plan.')
    } finally {
      setDeleting(false)
    }
  }

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

      <section className="mt-8 max-w-3xl bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4 mb-6">
          <span className="w-11 h-11 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <Trash2 size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Data Deletion</h2>
            <p className="mt-1 text-sm text-gray-500 leading-relaxed">
              Delete uploaded data that should no longer be used by portfolio planning workflows.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Delete stage gate plan by year</h3>
              <p className="mt-1 text-sm text-gray-500">
                Removes the stage_gate_plan for the selected year and all related stage gate rows.
              </p>
              <label htmlFor="delete-stage-gate-year" className="mt-4 block text-sm font-medium text-gray-700">
                Stage Gate Plan Year
              </label>
              <input
                id="delete-stage-gate-year"
                type="number"
                min={2000}
                max={2100}
                value={deleteYear}
                onChange={(event) => {
                  setDeleteYear(event.target.value)
                  setConfirmingDelete(false)
                  setDeleteMessage('')
                  setDeleteError('')
                }}
                className="mt-1 w-40 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {confirmingDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteStageGatePlan}
                disabled={!canDelete}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
                  confirmingDelete ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? 'Deleting...' : confirmingDelete ? `Confirm delete ${parsedDeleteYear}` : 'Delete plan'}
              </button>
            </div>
          </div>

          {confirmingDelete && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>This deletion cannot be undone.</span>
            </div>
          )}

          {deleteError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}

          {deleteMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 size={18} className="shrink-0" />
              {deleteMessage}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

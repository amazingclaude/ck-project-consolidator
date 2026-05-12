import { useState } from 'react'
import { Plus, FolderOpen, Archive, Loader2, AlertCircle, Download } from 'lucide-react'
import { usePlans } from '../context/PlansContext'
import type { Plan } from '../context/PlansContext'
import NewPlanModal from '../components/NewPlanModal'
import PlanCard from '../components/PlanCard'

interface DeleteTarget {
  id: string
  name: string
}

export default function BusinessPlanning() {
  const { plans, loading, error, archivePlan, unarchivePlan, deletePlan } = usePlans()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const active = plans.filter(p => p.status === 'active')
  const archived = plans.filter(p => p.status === 'archived')

  const openNewModal = () => {
    setEditingPlan(null)
    setModalOpen(true)
  }

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan)
    setModalOpen(true)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    deletePlan(id).catch(console.error)
  }

  return (
    <div className="px-8 py-8 min-h-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Business Planning</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your EV infrastructure business plans
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/plans/template/download"
            download
            className="flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800 bg-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
          >
            <Download size={16} />
            Download Template
          </a>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
          >
            <Plus size={16} />
            New Plan
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm">Loading plans…</span>
        </div>
      ) : (
        <>
          {/* Active Plans */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen size={18} className="text-gray-600" />
              <h2 className="text-base font-semibold text-gray-700">Active Plans</h2>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {active.length}
              </span>
            </div>

            {active.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-14 flex flex-col items-center gap-2 text-gray-400">
                <FolderOpen size={32} />
                <p className="text-sm">No active plans yet. Click "+ New Plan" to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {active.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onEdit={() => openEditModal(plan)}
                    onToggleArchive={() => archivePlan(plan.id).catch(console.error)}
                    onDelete={() => setDeleteTarget({ id: plan.id, name: plan.name })}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Archived Plans */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Archive size={18} className="text-gray-400" />
              <h2 className="text-base font-semibold text-gray-500">Archived Plans</h2>
              <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">
                {archived.length}
              </span>
            </div>

            {archived.length === 0 ? (
              <p className="text-sm text-gray-400 pl-1">No archived plans.</p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {archived.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onEdit={() => openEditModal(plan)}
                    onToggleArchive={() => unarchivePlan(plan.id).catch(console.error)}
                    onDelete={() => setDeleteTarget({ id: plan.id, name: plan.name })}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* New / Edit modal */}
      <NewPlanModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        planToEdit={editingPlan}
      />

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Plan?</h3>
            <p className="text-sm text-gray-500 mb-6">
              <span className="font-medium text-gray-700">"{deleteTarget.name}"</span> will be
              permanently deleted. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

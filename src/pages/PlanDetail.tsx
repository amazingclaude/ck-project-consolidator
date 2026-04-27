import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Archive, Pencil, Trash2 } from 'lucide-react'
import { usePlans } from '../context/PlansContext'
import NewPlanModal from '../components/NewPlanModal'

export default function PlanDetail() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const { getPlan, archivePlan, unarchivePlan, deletePlan } = usePlans()

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const plan = getPlan(planId ?? '')

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

  const handleDelete = () => {
    deletePlan(plan.id)
    navigate('/business-planning')
  }

  const toggleArchive = () => {
    if (isArchived) unarchivePlan(plan.id)
    else archivePlan(plan.id)
  }

  return (
    <div className="px-8 py-8 min-h-full">
      {/* Breadcrumb back */}
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
            {plan.fileName && ` · ${plan.fileName}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleArchive}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
          >
            <Archive size={15} />
            {isArchived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            onClick={() => setModalOpen(true)}
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

      {/* Content placeholder — to be populated in next phase */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl py-32 flex flex-col items-center text-gray-300 gap-2">
        <p className="text-sm">Plan content will be displayed here.</p>
      </div>

      {/* Modify modal */}
      <NewPlanModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        planToEdit={plan}
      />

      {/* Delete confirmation */}
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
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
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

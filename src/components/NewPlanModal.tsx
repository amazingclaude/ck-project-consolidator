import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'
import { X, Upload, FileText, Loader2 } from 'lucide-react'
import { usePlans } from '../context/PlansContext'
import type { Plan } from '../context/PlansContext'

interface Props {
  isOpen: boolean
  onClose: () => void
  planToEdit: Plan | null
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function NewPlanModal({ isOpen, onClose, planToEdit }: Props) {
  const { addPlan, updatePlan } = usePlans()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(planToEdit?.name ?? '')
      setFile(null)
      setIsDragging(false)
      setSubmitting(false)
      setSubmitError(null)
    }
  }, [isOpen, planToEdit])

  if (!isOpen) return null

  const isEdit = planToEdit != null
  const canSubmit = !submitting && name.trim().length > 0 && (isEdit || file != null)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (picked) setFile(picked)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (isEdit) {
        await updatePlan(planToEdit.id, { name: name.trim(), file: file ?? undefined })
      } else {
        await addPlan(name.trim(), file!)
      }
      onClose()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[480px] p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modify Plan' : 'Create New Plan'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Plan Name */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Plan Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. North West Region Q1 2026"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Upload Template{' '}
            {isEdit && (
              <span className="text-gray-400 font-normal">
                (optional — replaces current file)
              </span>
            )}
          </label>

          {file ? (
            <div className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
              <FileText size={20} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
              }`}
            >
              <Upload size={24} className={isDragging ? 'text-emerald-500' : 'text-gray-400'} />
              <p className="text-sm text-gray-500">
                Drag & drop a file, or{' '}
                <span className="text-emerald-600 font-medium">browse</span>
              </p>
              <p className="text-xs text-gray-400">Supports Excel, CSV, PDF</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={handleFileChange}
          />

          {isEdit && !file && planToEdit?.fileName && (
            <p className="text-xs text-gray-400 mt-1.5">
              Current file: {planToEdit.fileName}
            </p>
          )}
        </div>

        {/* Error */}
        {submitError && (
          <p className="text-sm text-red-500 mb-4">{submitError}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting
              ? isEdit ? 'Saving…' : 'Uploading…'
              : isEdit ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

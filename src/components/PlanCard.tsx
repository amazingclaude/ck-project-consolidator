import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, MoreVertical, Eye, Pencil, Archive, Trash2 } from 'lucide-react'
import type { Plan } from '../context/PlansContext'

interface Props {
  plan: Plan
  onEdit: () => void
  onToggleArchive: () => void
  onDelete: () => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PlanCard({ plan, onEdit, onToggleArchive, onDelete }: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const isArchived = plan.status === 'archived'

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow ${
        isArchived ? 'opacity-60' : ''
      }`}
    >
      {/* Top row: file icon + menu */}
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <FileText size={20} className="text-emerald-600" />
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[152px] py-1">
              <button
                onClick={() => { navigate(`/business-planning/${plan.id}`); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye size={14} /> Open
              </button>
              <button
                onClick={() => { onEdit(); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={14} /> Modify
              </button>
              <button
                onClick={() => { onToggleArchive(); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Archive size={14} />
                {isArchived ? 'Unarchive' : 'Archive'}
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { onDelete(); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Plan name — clicking opens detail */}
      <button
        className="text-left"
        onClick={() => navigate(`/business-planning/${plan.id}`)}
      >
        <h3 className="font-semibold text-gray-900 hover:text-emerald-600 transition-colors leading-snug">
          {plan.name}
        </h3>
      </button>

      {/* Meta */}
      <div className="text-xs text-gray-400 space-y-0.5">
        <p>Created {formatDate(plan.createdAt)}</p>
        <p>Planning year {plan.planYear}</p>
        {plan.fileName && (
          <p className="truncate">
            {plan.fileName} · {formatBytes(plan.fileSize)}
          </p>
        )}
      </div>

      {isArchived && (
        <span className="self-start bg-gray-100 text-gray-400 text-xs font-medium px-2 py-0.5 rounded-full">
          Archived
        </span>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, AlertCircle, Check } from 'lucide-react'
import { usePlans } from '../context/PlansContext'
import { fetchPlanRows, updatePlanRow } from '../api/plansApi'
import type { PlanRow } from '../api/plansApi'

// ─── Column definitions ────────────────────────────────────────────────────────

const TEXT_COLS: { key: keyof PlanRow; label: string }[] = [
  { key: 'region_name',       label: 'Region' },
  { key: 'contract_name',     label: 'Contract' },
  { key: 'work_package_name', label: 'Work Package' },
]

const CAPEX_COLS: { key: keyof PlanRow; label: string }[] = [
  { key: 'capex_bom_per_socket',          label: 'BOM £/socket' },
  { key: 'capex_installation_per_socket', label: 'Install £/socket' },
  { key: 'capex_connection_per_socket',   label: 'Connection £/socket' },
]

const SOCKET_COLS: { key: keyof PlanRow; label: string }[] = Array.from(
  { length: 12 },
  (_, i) => ({ key: `target_sockets_${i + 1}` as keyof PlanRow, label: `M${i + 1}` }),
)

// ─── Cell editors ─────────────────────────────────────────────────────────────

const cellBase =
  'w-full px-2 py-1 text-sm border border-transparent rounded focus:outline-none focus:border-emerald-400 focus:bg-white bg-transparent hover:bg-gray-50 transition-colors'

function NumCell({
  value,
  onChange,
  step,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <input
      type="number"
      value={value}
      step={step ?? 1}
      min={0}
      onChange={e => onChange(Number(e.target.value) || 0)}
      className={`${cellBase} text-right tabular-nums`}
    />
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PlanEdit() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const { getPlan, loading: plansLoading } = usePlans()

  const [rows, setRows] = useState<PlanRow[]>([])
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const plan = getPlan(planId ?? '')

  useEffect(() => {
    if (!planId) return
    setFetching(true)
    setLoadError(null)
    fetchPlanRows(planId)
      .then(data => { setRows(data); setDirtyRows(new Set()) })
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load rows'))
      .finally(() => setFetching(false))
  }, [planId])

  if (plansLoading && !plan) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  const backPath = `/business-planning/${planId}`

  const updateCell = (rowIndex: number, key: keyof PlanRow, value: string | number) => {
    setRows(prev =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r
        const updated = { ...r, [key]: value }
        if (
          key === 'capex_bom_per_socket' ||
          key === 'capex_installation_per_socket' ||
          key === 'capex_connection_per_socket'
        ) {
          updated.total_capex_per_socket =
            Number(updated.capex_bom_per_socket) +
            Number(updated.capex_installation_per_socket) +
            Number(updated.capex_connection_per_socket)
        }
        if ((key as string).startsWith('target_sockets_')) {
          updated.target_sockets = Array.from(
            { length: 12 },
            (_, i) => Number(updated[`target_sockets_${i + 1}` as keyof PlanRow]) || 0,
          ).reduce((a, b) => a + b, 0)
        }
        return updated
      }),
    )
    setDirtyRows(prev => new Set(prev).add(rowIndex))
    setSaved(false)
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!planId || dirtyRows.size === 0) { setSaved(true); return }
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      await Promise.all(
        rows
          .filter((_, i) => dirtyRows.has(i))
          .map(row => {
            const { row_id, ...data } = row
            return updatePlanRow(planId, row_id, data)
          }),
      )
      setDirtyRows(new Set())
      setSaved(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDone = async () => {
    await handleSave()
    navigate(backPath)
  }

  return (
    <div className="px-6 py-6 min-h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <span className="text-gray-300">·</span>
          <h1 className="text-lg font-bold text-gray-900">
            {plan ? `Edit — ${plan.name}` : 'Edit Plan'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {saveError && (
            <span className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle size={13} /> {saveError}
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <Check size={13} /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || fetching}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleDone}
            disabled={saving || fetching}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Done
          </button>
        </div>
      </div>

      {/* Loading / error */}
      {fetching && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
          <Loader2 size={18} className="animate-spin" />
          Loading rows…
        </div>
      )}
      {!fetching && loadError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {loadError}
        </div>
      )}

      {/* Editable table */}
      {!fetching && !loadError && (
        <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-max w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              {/* Group header row */}
              <tr>
                <th
                  colSpan={TEXT_COLS.length}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200"
                >
                  Work Package
                </th>
                <th
                  colSpan={CAPEX_COLS.length}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200"
                >
                  Capex per Socket (£)
                </th>
                <th
                  colSpan={SOCKET_COLS.length}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200"
                >
                  Target Sockets
                </th>
              </tr>
              {/* Column header row */}
              <tr>
                {TEXT_COLS.map((c, i) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2 text-left text-xs font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap min-w-[140px] ${
                      i === TEXT_COLS.length - 1 ? 'border-r' : ''
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
                {CAPEX_COLS.map((c, i) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2 text-right text-xs font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap min-w-[120px] ${
                      i === CAPEX_COLS.length - 1 ? 'border-r' : ''
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
                {SOCKET_COLS.map(c => (
                  <th
                    key={c.key}
                    className="px-3 py-2 text-right text-xs font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap min-w-[72px]"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={TEXT_COLS.length + CAPEX_COLS.length + SOCKET_COLS.length}
                    className="px-4 py-8 text-center text-gray-400 text-sm"
                  >
                    No rows found.
                  </td>
                </tr>
              )}
              {rows.map((row, ri) => (
                <tr
                  key={row.row_id}
                  className={`border-b border-gray-100 last:border-0 ${
                    ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  {TEXT_COLS.map((c, i) => (
                    <td
                      key={c.key}
                      className={`px-3 py-1.5 text-sm text-gray-600 whitespace-nowrap select-none ${
                        i === TEXT_COLS.length - 1 ? 'border-r border-gray-200' : ''
                      }`}
                    >
                      {row[c.key] as string}
                    </td>
                  ))}
                  {CAPEX_COLS.map((c, i) => (
                    <td
                      key={c.key}
                      className={`px-1 py-0.5 ${i === CAPEX_COLS.length - 1 ? 'border-r border-gray-200' : ''}`}
                    >
                      <NumCell
                        value={row[c.key] as number}
                        onChange={v => updateCell(ri, c.key, v)}
                        step={50}
                      />
                    </td>
                  ))}
                  {SOCKET_COLS.map(c => (
                    <td key={c.key} className="px-1 py-0.5">
                      <NumCell
                        value={row[c.key] as number}
                        onChange={v => updateCell(ri, c.key, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

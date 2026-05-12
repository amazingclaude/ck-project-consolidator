import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, Boxes, CheckCircle, Gauge, Loader2, Pencil, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { fetchStageGateRows, updateStageGateRow } from '../api/portfolioApi'
import type { StageGateRow } from '../api/portfolioApi'
import { syncForecastGatesFromMpp } from '../api/dataIngestionApi'

const GATES = [1, 2, 3, 4] as const

type GateNumber = (typeof GATES)[number]
type HealthStatus = 'healthy' | 'warning' | 'critical'

interface GateHealth {
  gate: GateNumber
  healthy: number
  warning: number
  critical: number
  total: number
}

const HEALTH_CONFIG: Record<HealthStatus, { label: string; color: string; text: string }> = {
  healthy: { label: 'Healthy', color: '#10b981', text: 'text-emerald-600' },
  warning: { label: 'Warning', color: '#f59e0b', text: 'text-amber-600' },
  critical: { label: 'Critical', color: '#ef4444', text: 'text-red-600' },
}

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => 2023 + i)

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== ''
}

function getPlanned(row: StageGateRow, gate: GateNumber) {
  return row[`planned_gate_${gate}` as keyof StageGateRow] as number | null
}

function getForecast(row: StageGateRow, gate: GateNumber) {
  return row[`forecast_gate_${gate}` as keyof StageGateRow] as number | null
}

function getDelayWeeks(row: StageGateRow, gate: GateNumber) {
  const planned = getPlanned(row, gate)
  const forecast = getForecast(row, gate)
  if (!isPresent(planned) || !isPresent(forecast)) return null
  return Number(forecast) - Number(planned)
}

function getHealthStatus(delayWeeks: number): HealthStatus {
  if (delayWeeks <= 1) return 'healthy'
  if (delayWeeks <= 2) return 'warning'
  return 'critical'
}

function formatGate(value: number | null) {
  return isPresent(value) ? `W${Number(value)}` : '-'
}

function getWorkPackageDeviationCount(row: StageGateRow): number {
  return GATES.reduce((count, gate) => {
    const delay = getDelayWeeks(row, gate)
    return count + (delay !== null && delay > 0 ? 1 : 0)
  }, 0)
}

function getWorkPackageHealth(deviationCount: number): HealthStatus {
  if (deviationCount === 0) return 'healthy'
  if (deviationCount === 1) return 'warning'
  return 'critical'
}

function hasAnyForecast(row: StageGateRow): boolean {
  return GATES.some(gate => isPresent(getForecast(row, gate)))
}

function MetricCard({
  children,
  className = '',
  icon,
  label,
  value,
}: {
  children?: React.ReactNode
  className?: string
  icon: React.ReactNode
  label: string
  value?: string
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 min-w-0 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
      </div>
      {value !== undefined && (
        <p className="text-3xl font-extrabold text-gray-900 tabular-nums">{value}</p>
      )}
      {children}
    </div>
  )
}

function GateRing({ health }: { health: GateHealth }) {
  const data = (Object.keys(HEALTH_CONFIG) as HealthStatus[]).map(status => ({
    name: HEALTH_CONFIG[status].label,
    status,
    value: health[status],
  }))

  return (
    <div className="min-w-0">
      <div className="h-32 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius="62%"
              outerRadius="86%"
              paddingAngle={health.total > 0 ? 2 : 0}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {data.map(item => (
                <Cell key={item.status} fill={HEALTH_CONFIG[item.status].color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value.toLocaleString('en-GB'), name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs font-semibold text-gray-400">Gate</span>
          <span className="text-xl font-extrabold text-gray-900">{health.gate}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {(Object.keys(HEALTH_CONFIG) as HealthStatus[]).map(status => (
          <div key={status}>
            <p className={`text-sm font-bold tabular-nums ${HEALTH_CONFIG[status].text}`}>
              {health[status]}
            </p>
            <p className="text-[11px] text-gray-400 truncate">{HEALTH_CONFIG[status].label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PortfolioOverview() {
  const [planYear, setPlanYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<StageGateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ message: string; updatedRows: number } | null>(null)
  const [syncConfirmPending, setSyncConfirmPending] = useState(false)

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [localRows, setLocalRows] = useState<StageGateRow[]>([])
  const [dirtyRowIds, setDirtyRowIds] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchStageGateRows(planYear)
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio rows')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [planYear])

  useEffect(() => {
    setSyncResult(null)
    setEditMode(false)
    loadRows()
  }, [loadRows])

  function enterEditMode() {
    setLocalRows(rows.map(r => ({ ...r })))
    setDirtyRowIds(new Set())
    setSaveError(null)
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setLocalRows([])
    setDirtyRowIds(new Set())
    setSaveError(null)
  }

  function updateCell(rowId: number, field: keyof StageGateRow, raw: string) {
    const value = raw === '' ? null : Number(raw)
    setLocalRows(prev =>
      prev.map(r => (r.row_id === rowId ? { ...r, [field]: value } : r)),
    )
    setDirtyRowIds(prev => new Set(prev).add(rowId))
    setSaveError(null)
  }

  async function handleSave() {
    if (dirtyRowIds.size === 0) { setEditMode(false); return }
    setSaving(true)
    setSaveError(null)
    try {
      await Promise.all(
        localRows
          .filter(r => dirtyRowIds.has(r.row_id))
          .map(r =>
            updateStageGateRow(r.row_id, {
              planned_gate_1: r.planned_gate_1 ?? undefined,
              planned_gate_2: r.planned_gate_2 ?? undefined,
              planned_gate_3: r.planned_gate_3 ?? undefined,
              planned_gate_4: r.planned_gate_4 ?? undefined,
              forecast_gate_1: r.forecast_gate_1 ?? undefined,
              forecast_gate_2: r.forecast_gate_2 ?? undefined,
              forecast_gate_3: r.forecast_gate_3 ?? undefined,
              forecast_gate_4: r.forecast_gate_4 ?? undefined,
            }),
          ),
      )
      setEditMode(false)
      setDirtyRowIds(new Set())
      await loadRows()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleSyncMpp() {
    setSyncConfirmPending(false)
    setSyncing(true)
    setSyncResult(null)
    setError(null)
    try {
      const result = await syncForecastGatesFromMpp(planYear)
      setSyncResult(result)
      await loadRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MPP sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const displayRows = editMode ? localRows : rows
  const workPackageRows = useMemo(
    () => displayRows.filter(row => isPresent(row.work_package_name)),
    [displayRows],
  )

  const missedGateCount = useMemo(
    () =>
      workPackageRows.reduce((count, row) => {
        return (
          count +
          GATES.reduce((gateCount, gate) => {
            const delayWeeks = getDelayWeeks(row, gate)
            return gateCount + (delayWeeks !== null && delayWeeks > 0 ? 1 : 0)
          }, 0)
        )
      }, 0),
    [workPackageRows],
  )

  const gateHealth = useMemo<GateHealth[]>(
    () =>
      GATES.map(gate => {
        const health: GateHealth = { gate, healthy: 0, warning: 0, critical: 0, total: 0 }
        workPackageRows.forEach(row => {
          const delayWeeks = getDelayWeeks(row, gate)
          if (delayWeeks === null) return
          health[getHealthStatus(delayWeeks)] += 1
          health.total += 1
        })
        return health
      }),
    [workPackageRows],
  )

  const wpHealthCounts = useMemo(() => {
    const counts = { healthy: 0, warning: 0, critical: 0 }
    workPackageRows.forEach(row => {
      counts[getWorkPackageHealth(getWorkPackageDeviationCount(row))] += 1
    })
    return counts
  }, [workPackageRows])

  return (
    <div className="px-8 py-8 min-h-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Portfolio Overview</h1>
          <p className="mt-1 text-sm text-gray-500">
            Stage gate health by planning year, sourced from the uploaded stage gate plan.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="plan-year-select" className="text-sm font-medium text-gray-600 whitespace-nowrap">
              Planning year
            </label>
            <select
              id="plan-year-select"
              value={planYear}
              onChange={e => setPlanYear(Number(e.target.value))}
              disabled={editMode}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {YEAR_OPTIONS.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {syncConfirmPending ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
              <TriangleAlert size={14} className="shrink-0" />
              <span>This will overwrite manually-edited forecast gates.</span>
              <button
                onClick={handleSyncMpp}
                className="ml-1 font-semibold text-amber-900 hover:underline"
              >
                Confirm
              </button>
              <button
                onClick={() => setSyncConfirmPending(false)}
                className="font-semibold text-amber-700 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSyncConfirmPending(true)}
              disabled={syncing || loading || editMode}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Refresh forecast gates from MPP'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {syncResult && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle size={16} className="shrink-0" />
          {syncResult.message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm">Loading portfolio dashboard…</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-12 gap-4 mb-8">
            {/* Row 1: three summary metric cards */}
            <MetricCard
              className="col-span-12 md:col-span-4"
              icon={<Boxes size={16} className="text-emerald-600" />}
              label="Number of Work Packages"
              value={workPackageRows.length.toLocaleString('en-GB')}
            />

            <MetricCard
              className="col-span-12 md:col-span-4"
              icon={<TriangleAlert size={16} className="text-amber-600" />}
              label="Stage Gate Deviations"
              value={missedGateCount.toLocaleString('en-GB')}
            />

            <MetricCard
              className="col-span-12 md:col-span-4"
              icon={<Activity size={16} className="text-purple-600" />}
              label="Work Package Health Status"
            >
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                {(Object.keys(HEALTH_CONFIG) as HealthStatus[]).map(status => (
                  <div key={status}>
                    <p className={`text-2xl font-extrabold tabular-nums ${HEALTH_CONFIG[status].text}`}>
                      {wpHealthCounts[status]}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{HEALTH_CONFIG[status].label}</p>
                  </div>
                ))}
              </div>
            </MetricCard>

            {/* Row 2: gate health donut charts */}
            <div className="col-span-12 bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
                  <Gauge size={16} className="text-cyan-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-700">Gate Health Status</h2>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {gateHealth.map(health => (
                  <GateRing key={health.gate} health={health} />
                ))}
              </div>
            </div>
          </div>

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900">Project Health Overview</h2>
              {workPackageRows.length > 0 && (
                editMode ? (
                  <div className="flex items-center gap-2">
                    {saveError && (
                      <span className="text-xs text-red-600">{saveError}</span>
                    )}
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={enterEditMode}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    <Pencil size={14} />
                    Modify
                  </button>
                )
              )}
            </div>

            {workPackageRows.length === 0 ? (
              <div className="py-14 text-center text-sm text-gray-400">
                No stage gate data found for {planYear}. Upload a stage gate Excel file to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">
                        Work Package
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">
                        Gate Deviations
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">
                        Health
                      </th>
                      {GATES.map(gate => (
                        <th
                          key={`planned-${gate}`}
                          className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap"
                        >
                          Planned Gate {gate}
                        </th>
                      ))}
                      {GATES.map(gate => (
                        <th
                          key={`forecast-${gate}`}
                          className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap"
                        >
                          Forecast Gate {gate}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {workPackageRows.map(row => {
                      const isDirty = dirtyRowIds.has(row.row_id)
                      const anyForecast = hasAnyForecast(row)
                      const deviationCount = anyForecast ? getWorkPackageDeviationCount(row) : null
                      const wpHealth = anyForecast ? getWorkPackageHealth(deviationCount!) : null
                      return (
                        <tr key={row.row_id} className={`hover:bg-gray-50 ${isDirty ? 'bg-blue-50/40' : ''}`}>
                          <td className="px-4 py-3 text-gray-900 font-medium min-w-56">
                            <span className="flex items-center gap-1.5">
                              {row.work_package_name}
                              {isDirty && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Unsaved changes" />
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-gray-700 font-medium">
                            {deviationCount === null ? <span className="text-gray-400">-</span> : deviationCount}
                          </td>
                          <td className="px-4 py-3">
                            {wpHealth === null ? (
                              <span className="text-gray-400 text-xs">-</span>
                            ) : (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                wpHealth === 'healthy'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : wpHealth === 'warning'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                              }`}>
                                {HEALTH_CONFIG[wpHealth].label}
                              </span>
                            )}
                          </td>
                          {GATES.map(gate => {
                            const field = `planned_gate_${gate}` as keyof StageGateRow
                            const value = row[field] as number | null
                            return (
                              <td key={`planned-${row.row_id}-${gate}`} className="px-4 py-2 text-gray-600 tabular-nums whitespace-nowrap">
                                {editMode ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={value ?? ''}
                                    onChange={e => updateCell(row.row_id, field, e.target.value)}
                                    placeholder="-"
                                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 tabular-nums"
                                  />
                                ) : (
                                  formatGate(value)
                                )}
                              </td>
                            )
                          })}
                          {GATES.map(gate => {
                            const field = `forecast_gate_${gate}` as keyof StageGateRow
                            const forecast = row[field] as number | null
                            const planned = getPlanned(row, gate)
                            const delay =
                              isPresent(planned) && isPresent(forecast)
                                ? Number(forecast) - Number(planned)
                                : null
                            const statusClass =
                              editMode || delay === null
                                ? 'text-gray-600'
                                : delay > 2
                                  ? 'text-red-600 font-semibold'
                                  : delay > 1
                                    ? 'text-amber-600 font-semibold'
                                    : 'text-emerald-600'
                            return (
                              <td
                                key={`forecast-${row.row_id}-${gate}`}
                                className={`px-4 py-2 tabular-nums whitespace-nowrap ${statusClass}`}
                              >
                                {editMode ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={forecast ?? ''}
                                    onChange={e => updateCell(row.row_id, field, e.target.value)}
                                    placeholder="-"
                                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 tabular-nums text-gray-600 font-normal"
                                  />
                                ) : (
                                  formatGate(forecast)
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

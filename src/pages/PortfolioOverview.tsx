import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Boxes, CheckCircle, Gauge, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { fetchStageGateRows } from '../api/portfolioApi'
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
  value: string
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 min-w-0 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
      </div>
      <p className="text-3xl font-extrabold text-gray-900 tabular-nums">{value}</p>
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
    loadRows()
  }, [loadRows])

  async function handleSyncMpp() {
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

  const workPackageRows = useMemo(
    () => rows.filter(row => isPresent(row.work_package_name)),
    [rows],
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
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {YEAR_OPTIONS.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSyncMpp}
            disabled={syncing || loading}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Refresh forecast gates from MPP'}
          </button>
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
            <MetricCard
              className="col-span-12 md:col-span-6 2xl:col-span-3"
              icon={<Boxes size={16} className="text-emerald-600" />}
              label="Number of Work Packages"
              value={workPackageRows.length.toLocaleString('en-GB')}
            />

            <MetricCard
              className="col-span-12 md:col-span-6 2xl:col-span-3"
              icon={<TriangleAlert size={16} className="text-amber-600" />}
              label="Stage Gate Deviations"
              value={missedGateCount.toLocaleString('en-GB')}
            />

            <div className="col-span-12 2xl:col-span-6 bg-white border border-gray-200 rounded-xl p-5">
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
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Project Health Overview</h2>
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
                    {workPackageRows.map(row => (
                      <tr key={row.row_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium min-w-56">
                          {row.work_package_name}
                        </td>
                        {GATES.map(gate => (
                          <td
                            key={`planned-${row.row_id}-${gate}`}
                            className="px-4 py-3 text-gray-600 tabular-nums whitespace-nowrap"
                          >
                            {formatGate(getPlanned(row, gate))}
                          </td>
                        ))}
                        {GATES.map(gate => {
                          const forecast = getForecast(row, gate)
                          const planned = getPlanned(row, gate)
                          const delay =
                            isPresent(planned) && isPresent(forecast)
                              ? Number(forecast) - Number(planned)
                              : null
                          const statusClass =
                            delay === null
                              ? 'text-gray-600'
                              : delay > 2
                                ? 'text-red-600 font-semibold'
                                : delay > 1
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-emerald-600'
                          return (
                            <td
                              key={`forecast-${row.row_id}-${gate}`}
                              className={`px-4 py-3 tabular-nums whitespace-nowrap ${statusClass}`}
                            >
                              {formatGate(forecast)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
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

import { useState, useMemo } from 'react'
import {
  ComposedChart, LineChart,
  Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { PlanRow, Assumptions } from '../api/plansApi'
import FilterBar, { DEFAULT_FILTER } from './FilterBar'
import type { FilterState } from './FilterBar'

const ALL = 'All'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  return n.toLocaleString('en-GB')
}

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `£${(n / 1_000).toFixed(1)}K`
  return `£${n.toFixed(0)}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartPoint {
  label: string
  targetMonthly: number
  plannedMonthly: number
  targetCumulative: number
  plannedCumulative: number
  capexBom: number
  capexInstallation: number
  capexConnection: number
  capexTotal: number
  seniorDMs: number
  dms: number
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-5">{title}</h3>
      {children}
    </div>
  )
}

// ─── Axis / legend shared styles ─────────────────────────────────────────────

const TICK = { fontSize: 11, fill: '#9ca3af' }
const LEGEND = { fontSize: 12 }

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  rows: PlanRow[]
  assumptions: Assumptions
}

export default function PlanCharts({ rows, assumptions }: Props) {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)

  // Apply hierarchical filter
  const filteredRows = useMemo(() =>
    rows.filter(row => {
      if (filter.region !== ALL && row.custom_region_name !== filter.region) return false
      if (filter.contract !== ALL && row.contract_name !== filter.contract) return false
      if (filter.workPackage !== ALL && row.work_package_name !== filter.workPackage) return false
      return true
    }),
    [rows, filter],
  )

  // Aggregate monthly totals and derive all chart series in a single pass
  const chartData = useMemo((): ChartPoint[] => {
    const { value_per_socket: vps, delivery_capacity_sockets_per_year: cap } = assumptions
    let cumTarget = 0
    let cumPlanned = 0

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const targetMonthly = filteredRows.reduce(
        (s, r) => s + (Number(r[`target_sockets_${m}`]) || 0), 0,
      )
      const plannedMonthly = filteredRows.reduce(
        (s, r) => s + (Number(r[`planned_sockets_${m}`]) || 0), 0,
      )
      cumTarget += targetMonthly
      cumPlanned += plannedMonthly

      return {
        label: `M${m}`,
        targetMonthly,
        plannedMonthly,
        targetCumulative: cumTarget,
        plannedCumulative: cumPlanned,
        // Graph 2: capex from target sockets × assumption values
        capexBom: targetMonthly * vps.capex_bom,
        capexInstallation: targetMonthly * vps.capex_installation,
        capexConnection: targetMonthly * vps.capex_connection,
        capexTotal: targetMonthly * vps.capex_total,
        // Graph 3: DMs from target sockets ÷ annual capacity assumption
        seniorDMs: cap.senior_delivery_manager > 0
          ? +(targetMonthly / cap.senior_delivery_manager).toFixed(3)
          : 0,
        dms: cap.delivery_manager > 0
          ? +(targetMonthly / cap.delivery_manager).toFixed(3)
          : 0,
      }
    })
  }, [filteredRows, assumptions])

  return (
    <div className="mt-6 space-y-5">
      <FilterBar rows={rows} filter={filter} onChange={setFilter} />

      {/* ── Graph 1: Monthly (bars) + Cumulative (lines), dual y-axis ── */}
      <ChartCard title="Monthly & Cumulative Sockets — Target vs Planned">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={TICK} />
            <YAxis
              yAxisId="monthly"
              orientation="left"
              tick={TICK}
              tickFormatter={v => fmtNum(Number(v))}
              label={{ value: 'Monthly sockets', angle: -90, position: 'insideLeft', style: TICK, dx: -8 }}
              width={70}
            />
            <YAxis
              yAxisId="cumulative"
              orientation="right"
              tick={TICK}
              tickFormatter={v => fmtNum(Number(v))}
              label={{ value: 'Cumulative sockets', angle: 90, position: 'insideRight', style: TICK, dx: 16 }}
              width={80}
            />
            <Tooltip
              formatter={(value: number | string, name: string) =>
                [`${fmtNum(Number(value))}`, name]
              }
            />
            <Legend wrapperStyle={LEGEND} />
            <Bar
              yAxisId="monthly" dataKey="targetMonthly" name="Target (monthly)"
              fill="#09b82f" opacity={0.75} barSize={14}
            />
            <Bar
              yAxisId="monthly" dataKey="plannedMonthly" name="Planned (monthly)"
              fill="#4016f9" opacity={0.75} barSize={14}
            />
            <Line
              yAxisId="cumulative" dataKey="targetCumulative" name="Target (cumulative)"
              stroke="#09b82f" strokeWidth={2.5} dot={false} type="monotone"
            />
            <Line
              yAxisId="cumulative" dataKey="plannedCumulative" name="Planned (cumulative)"
              stroke="#4016f9" strokeWidth={2.5} dot={false} type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Graph 2: Monthly capex breakdown (line chart) ── */}
      <ChartCard title="Monthly Capex by Component — based on Target Sockets × assumption">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={TICK} />
            <YAxis
              tick={TICK}
              tickFormatter={v => fmtCurrency(Number(v))}
              width={72}
            />
            <Tooltip
              formatter={(value: number | string, name: string) =>
                [fmtCurrency(Number(value)), name]
              }
            />
            <Legend wrapperStyle={LEGEND} />
            <Line dataKey="capexBom"          name="BOM"          stroke="#071224" strokeWidth={2} dot={false} type="monotone" />
            <Line dataKey="capexInstallation" name="Installation" stroke="#09b82f" strokeWidth={2} dot={false} type="monotone" />
            <Line dataKey="capexConnection"   name="Connection"   stroke="#4016f9" strokeWidth={2} dot={false} type="monotone" />
            <Line dataKey="capexTotal"        name="Total"        stroke="#ee5209" strokeWidth={2.5} strokeDasharray="5 3" dot={false} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Graph 3: DMs required per month ── */}
      <ChartCard title="Delivery Managers Required per Month — based on Target Sockets ÷ annual capacity">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={TICK} />
            <YAxis tick={TICK} />
            <Tooltip
              formatter={(value: number | string, name: string) =>
                [Number(value).toFixed(2), name]
              }
            />
            <Legend wrapperStyle={LEGEND} />
            <Line dataKey="seniorDMs" name="Senior Delivery Managers" stroke="#4016f9" strokeWidth={2} dot={false} type="monotone" />
            <Line dataKey="dms"       name="Delivery Managers"        stroke="#09b82f" strokeWidth={2} dot={false} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

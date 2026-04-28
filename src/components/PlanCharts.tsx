import { useState, useMemo } from 'react'
import {
  ComposedChart, LineChart,
  Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { PlanRow, Assumptions } from '../api/plansApi'
import FilterBar, { DEFAULT_FILTER } from './FilterBar'
import type { FilterState } from './FilterBar'

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
  targetCumulative: number
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

  const filteredRows = useMemo(() =>
    rows.filter(row => {
      const ALL = 'All'
      if (filter.region !== ALL && row.region_name !== filter.region) return false
      if (filter.contract !== ALL && row.contract_name !== filter.contract) return false
      if (filter.workPackage !== ALL && row.work_package_name !== filter.workPackage) return false
      return true
    }),
    [rows, filter],
  )

  const chartData = useMemo((): ChartPoint[] => {
    const { delivery_capacity_sockets_per_year: cap } = assumptions
    let cumTarget = 0

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const monthKey = `target_sockets_${m}` as keyof PlanRow

      // Chart 1: monthly target sockets (sum across filtered rows)
      const targetMonthly = filteredRows.reduce(
        (s, r) => s + (Number(r[monthKey]) || 0), 0,
      )
      cumTarget += targetMonthly

      // Chart 2: monthly capex — each row contributes its own per-socket cost
      const capexBom = filteredRows.reduce(
        (s, r) => s + (Number(r[monthKey]) || 0) * Number(r.capex_bom_per_socket), 0,
      )
      const capexInstallation = filteredRows.reduce(
        (s, r) => s + (Number(r[monthKey]) || 0) * Number(r.capex_installation_per_socket), 0,
      )
      const capexConnection = filteredRows.reduce(
        (s, r) => s + (Number(r[monthKey]) || 0) * Number(r.capex_connection_per_socket), 0,
      )

      // Chart 3: DMs required — monthly sockets ÷ (annual capacity / 12)
      const srMonthly = cap.senior_delivery_manager / 12
      const dmMonthly = cap.delivery_manager / 12

      return {
        label: `M${m}`,
        targetMonthly,
        targetCumulative: cumTarget,
        capexBom,
        capexInstallation,
        capexConnection,
        capexTotal: capexBom + capexInstallation + capexConnection,
        seniorDMs: srMonthly > 0 ? +(targetMonthly / srMonthly).toFixed(3) : 0,
        dms: dmMonthly > 0 ? +(targetMonthly / dmMonthly).toFixed(3) : 0,
      }
    })
  }, [filteredRows, assumptions])

  return (
    <div className="mt-6 space-y-5">
      <FilterBar rows={rows} filter={filter} onChange={setFilter} />

      {/* Chart 1: Monthly (bars) + Cumulative (line), dual y-axis */}
      <ChartCard title="Monthly & Cumulative Target Sockets">
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
            <Line
              yAxisId="cumulative" dataKey="targetCumulative" name="Target (cumulative)"
              stroke="#09b82f" strokeWidth={2.5} dot={false} type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 2: Monthly capex by component (line chart) */}
      <ChartCard title="Monthly Capex by Component">
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

      {/* Chart 3: DMs required per month */}
      <ChartCard title="Delivery Managers Required per Month">
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
            <Line dataKey="dms"       name="CK Delivery Managers"     stroke="#09b82f" strokeWidth={2} dot={false} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

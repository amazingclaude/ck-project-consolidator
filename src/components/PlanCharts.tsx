import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type {
  CapexIncurredData,
  CapexIncurredDetailPoint,
  CapexIncurredMonthlyPoint,
  PlanRow,
} from '../api/plansApi'
import FilterBar, { DEFAULT_FILTER } from './FilterBar'
import type { FilterState } from './FilterBar'

function fmtNum(n: number) {
  return n.toLocaleString('en-GB')
}

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `£${(n / 1_000).toFixed(1)}K`
  return `£${n.toFixed(0)}`
}

interface ChartPoint {
  label: string
  targetMonthly: number
  targetCumulative: number
}

interface CapexStackPoint {
  label: string
  month: string
  bom: number
  connection: number
  installation: number
  total_capex: number
  [key: string]: string | number
}

function ChartCard({
  description,
  title,
  children,
}: {
  description?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {description ? (
        <p className="mt-2 mb-5 text-sm text-gray-500">{description}</p>
      ) : (
        <div className="mb-5" />
      )}
      {children}
    </div>
  )
}

const TICK = { fontSize: 11, fill: '#9ca3af' }
const LEGEND = { fontSize: 12 }

const COST_TYPE_CONFIG = [
  { key: 'bom', name: 'BOM', fill: '#e67f11' },
  { key: 'connection', name: 'Connection', fill: '#4016f9' },
  { key: 'installation', name: 'Installation', fill: '#09b82f' },
]

const OFFSET_COLORS = [
  '#4016f9',
  '#09b82f',
  '#ee5209',
  '#0ea5e9',
  '#be185d',
  '#a16207',
  '#475569',
]

interface Props {
  rows: PlanRow[]
  capexIncurred: CapexIncurredData
}

function formatMonthLabel(value: string) {
  const [year, month] = value.slice(0, 7).split('-')
  return `${month}/${year.slice(2)}`
}

function sortByMonth<T extends { month: string }>(a: T, b: T) {
  return a.month.localeCompare(b.month)
}

function matchesFilter(
  row: Pick<PlanRow, 'region_name' | 'contract_name' | 'work_package_name'>,
  filter: FilterState,
) {
  const ALL = 'All'
  if (filter.region !== ALL && row.region_name !== filter.region) return false
  if (filter.contract !== ALL && row.contract_name !== filter.contract) return false
  if (filter.workPackage !== ALL && row.work_package_name !== filter.workPackage) return false
  return true
}

function buildMonthlyCapexData(rows: CapexIncurredMonthlyPoint[]): CapexStackPoint[] {
  const byMonth = new Map<string, CapexStackPoint>()

  rows.forEach(row => {
    const month = row.incurred_month
    const point = byMonth.get(month) ?? {
      month,
      label: formatMonthLabel(month),
      bom: 0,
      connection: 0,
      installation: 0,
      total_capex: 0,
    }
    point[row.cost_type] = Number(point[row.cost_type] ?? 0) + Number(row.incurred_cost || 0)
    point.total_capex = Number(point.total_capex) + Number(row.incurred_cost || 0)
    byMonth.set(month, point)
  })

  return Array.from(byMonth.values()).sort(sortByMonth)
}

function buildInstallmentCapexData(rows: CapexIncurredDetailPoint[], costType: string) {
  const costRows = rows.filter(row => row.cost_type === costType)
  const installments = Array.from(new Set(costRows.map(row => row.payment_installment))).sort((a, b) => a - b)
  const byMonth = new Map<string, CapexStackPoint>()

  costRows.forEach(row => {
    const month = row.incurred_month
    const point = byMonth.get(month) ?? {
      month,
      label: formatMonthLabel(month),
      bom: 0,
      connection: 0,
      installation: 0,
      total_capex: 0,
    }
    const key = `installment_${row.payment_installment}`
    point[key] = Number(point[key] ?? 0) + Number(row.incurred_cost || 0)
    point.total_capex = Number(point.total_capex) + Number(row.incurred_cost || 0)
    byMonth.set(month, point)
  })

  return {
    installments,
    data: Array.from(byMonth.values()).sort(sortByMonth),
  }
}

function OffsetCapexChart({
  costType,
  description,
  title,
  rows,
}: {
  costType: 'bom' | 'connection' | 'installation'
  description: string
  title: string
  rows: CapexIncurredDetailPoint[]
}) {
  const { installments, data } = useMemo(
    () => buildInstallmentCapexData(rows, costType),
    [rows, costType],
  )

  return (
    <ChartCard title={title} description={description}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="label" tick={TICK} />
          <YAxis tick={TICK} tickFormatter={v => fmtCurrency(Number(v))} width={72} />
          <Tooltip
            formatter={(value: number | string, name: string) => [
              fmtCurrency(Number(value)),
              name === 'Total' ? 'Total' : String(name).replace('installment_', 'Installment '),
            ]}
          />
          <Legend
            wrapperStyle={LEGEND}
            formatter={value => String(value).replace('installment_', 'Installment ')}
          />
          {installments.map((installment, index) => (
            <Bar
              key={installment}
              dataKey={`installment_${installment}`}
              name={`installment_${installment}`}
              stackId="capex"
              fill={OFFSET_COLORS[index % OFFSET_COLORS.length]}
              barSize={18}
            />
          ))}
          <Line
            dataKey="total_capex"
            name="Total"
            stroke="black"
            strokeWidth={0}
            dot={false}
            activeDot={false}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export default function PlanCharts({ rows, capexIncurred }: Props) {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)

  const filteredRows = useMemo(
    () => rows.filter(row => matchesFilter(row, filter)),
    [rows, filter],
  )

  const filteredCapexMonthly = useMemo(
    () => capexIncurred.monthly_by_type.filter(row => matchesFilter(row, filter)),
    [capexIncurred.monthly_by_type, filter],
  )

  const filteredCapexDetail = useMemo(
    () => capexIncurred.detail.filter(row => matchesFilter(row, filter)),
    [capexIncurred.detail, filter],
  )

  const chartData = useMemo((): ChartPoint[] => {
    let cumTarget = 0

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const monthKey = `target_sockets_${m}` as keyof PlanRow

      const targetMonthly = filteredRows.reduce(
        (s, r) => s + (Number(r[monthKey]) || 0),
        0,
      )
      cumTarget += targetMonthly

      return {
        label: `M${m}`,
        targetMonthly,
        targetCumulative: cumTarget,
      }
    })
  }, [filteredRows])

  const monthlyCapexData = useMemo(
    () => buildMonthlyCapexData(filteredCapexMonthly),
    [filteredCapexMonthly],
  )

  return (
    <div className="mt-6 space-y-5">
      <FilterBar rows={rows} filter={filter} onChange={setFilter} />

      <ChartCard 
      title="Monthly & Cumulative Target Sockets"
      // description='placeholder'
      >
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
              formatter={(value: number | string, name: string) => [
                `${fmtNum(Number(value))}`,
                name,
              ]}
            />
            <Legend wrapperStyle={LEGEND} />
            <Bar
              yAxisId="monthly"
              dataKey="targetMonthly"
              name="Target (monthly)"
              fill="#09b82f"
              opacity={0.75}
              barSize={14}
            />
            <Line
              yAxisId="cumulative"
              dataKey="targetCumulative"
              name="Target (cumulative)"
              stroke="#4f09b8"
              strokeWidth={2.5}
              dot={false}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Total Monthly CAPEX"
      description='All CAPEX costs incurred by month, combining Connection, BOM, and Installation costs across all work packages'
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={monthlyCapexData} margin={{ top: 20, right: 20, left: 10, bottom: 4 }}>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={TICK} />
            <YAxis tick={TICK} tickFormatter={v => fmtCurrency(Number(v))} width={72} />
            <Tooltip
              formatter={(value: number | string, name: string) => [
                fmtCurrency(Number(value)),
                name,
              ]}
            />
            <Legend wrapperStyle={LEGEND} />
            {COST_TYPE_CONFIG.map(item => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.name}
                stackId="capex"
                fill={item.fill}
                barSize={18}
              />
            ))}
            <Line
              dataKey="total_capex"
              name="Total"
              stroke="black"
              strokeWidth={0}
              dot={false}
              activeDot={false}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <OffsetCapexChart
        costType="bom"
        description="Costs incurred by month — Initial (66.67% of BOM cost/socket) 159 days before delivery, Final (33.33% of BOM cost/socket) 33 days before delivery."
        title="Monthly BOM Costs (CAPEX)"
        rows={filteredCapexDetail}
      />

      <OffsetCapexChart
        costType="connection"
        description="Costs incurred by month — Initial (40% of connection cost/socket) 171 days before delivery, Final (60% of connection cost/socket) 33 days before delivery."
        title="Monthly Connection Costs (CAPEX)"
        rows={filteredCapexDetail}
      />

      <OffsetCapexChart
        costType="installation"
        description="Costs incurred by month — each tranche is 25% of installation cost/socket per work package: First 56 days before delivery, Second & Third 49 days before delivery, Final 10 days before delivery."
        title="Monthly Installation Costs (CAPEX)"
        rows={filteredCapexDetail}
      />
    </div>
  )
}

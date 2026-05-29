import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type {
  Assumptions,
  CapexIncurredData,
  CapexIncurredDetailPoint,
  CapexIncurredMonthlyPoint,
  PlanRow,
} from '../api/plansApi'
import FilterBar, { DEFAULT_FILTER } from './FilterBar'
import type { FilterState } from './FilterBar'

const TARGET_SOCKET_MONTHS = 18

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
  planYear: number
  assumptions?: Assumptions | null
}

function formatMonthLabel(value: string) {
  const [year, month] = value.slice(0, 7).split('-')
  return `${month}/${year.slice(2)}`
}

function formatTargetMonthLabel(startMonth: string, monthOffset: number) {
  const [year, month] = startMonth.slice(0, 7).split('-').map(Number)
  if (!year || !month) return `M${monthOffset + 1}`

  const date = new Date(Date.UTC(year, month - 1 + monthOffset, 1))
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(date)
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

const INSTALLMENT_ORDER = ['full', 'initial_40pct', 'final_60pct', 'tranche_1', 'tranche_2', 'tranche_3', 'tranche_4']

function sortInstallments(a: string, b: string): number {
  const ai = INSTALLMENT_ORDER.indexOf(a)
  const bi = INSTALLMENT_ORDER.indexOf(b)
  if (ai === -1 && bi === -1) return a.localeCompare(b)
  if (ai === -1) return 1
  if (bi === -1) return -1
  return ai - bi
}

const INSTALLMENT_LABELS: Record<string, string> = {
  full: 'Full (100%)',
  initial_40pct: 'Initial (40%)',
  final_60pct: 'Final (60%)',
  tranche_1: 'Tranche 1 (25%)',
  tranche_2: 'Tranche 2 (25%)',
  tranche_3: 'Tranche 3 (30%)',
  tranche_4: 'Tranche 4 (20%)',
}

function formatInstallmentLabel(key: string): string {
  const raw = key.replace(/^installment_/, '')
  return INSTALLMENT_LABELS[raw] ?? raw
}

function buildInstallmentCapexData(rows: CapexIncurredDetailPoint[], costType: string) {
  const costRows = rows.filter(row => row.cost_type === costType)
  const installments = Array.from(new Set(costRows.map(row => row.payment_installment))).sort(sortInstallments)
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
              name === 'Total' ? 'Total' : formatInstallmentLabel(String(name)),
            ]}
          />
          <Legend
            wrapperStyle={LEGEND}
            formatter={value => formatInstallmentLabel(String(value))}
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

export default function PlanCharts({ rows, capexIncurred, planYear, assumptions }: Props) {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)
  const capexTiming = assumptions?.capex_timing_days ?? {
    bom_before_first_install_midpoint: 30,
    connection_initial_before_first_install_midpoint: 108,
    connection_final_after_month_midpoint: 35,
    installation_tranche_4_after_last_install_midpoint: 49,
  }

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
    const [startYear, startMonth] = capexIncurred.target_month_1.slice(0, 7).split('-').map(Number)
    const monthsUntilPlanYearEnd = startYear && startMonth
      ? (planYear - startYear) * 12 + (12 - startMonth) + 1
      : TARGET_SOCKET_MONTHS
    const visibleMonths = Math.min(TARGET_SOCKET_MONTHS, Math.max(0, monthsUntilPlanYearEnd))

    let cumTarget = 0

    return Array.from({ length: visibleMonths }, (_, i) => {
      const m = i + 1
      const monthKey = `target_sockets_${m}` as keyof PlanRow

      const targetMonthly = filteredRows.reduce(
        (s, r) => s + (Number(r[monthKey]) || 0),
        0,
      )
      cumTarget += targetMonthly

      return {
        label: formatTargetMonthLabel(capexIncurred.target_month_1, i),
        targetMonthly,
        targetCumulative: cumTarget,
      }
    })
  }, [filteredRows, capexIncurred.target_month_1, planYear])

  const monthlyCapexData = useMemo(
    () => buildMonthlyCapexData(
      filteredCapexMonthly.filter(r => r.incurred_month.slice(0, 7) <= `${planYear}-12`),
    ),
    [filteredCapexMonthly, planYear],
  )

  const truncatedCapexDetail = useMemo(
    () => filteredCapexDetail.filter(r => r.incurred_month.slice(0, 7) <= `${planYear}-12`),
    [filteredCapexDetail, planYear],
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
        description={`Full BOM cost (100% of total sockets x cost/socket) incurred ${capexTiming.bom_before_first_install_midpoint} days before the first installation month.`}
        title="Monthly BOM Costs (CAPEX)"
        rows={truncatedCapexDetail}
      />

      <OffsetCapexChart
        costType="connection"
        description={`Initial payment (40% of total connection cost) incurred ${capexTiming.connection_initial_before_first_install_midpoint} days before the midpoint of the first installation month. Final payment (60%) split across each installation month, incurred ${capexTiming.connection_final_after_month_midpoint} days after that month's midpoint, proportional to monthly sockets.`}
        title="Monthly Connection Costs (CAPEX)"
        rows={truncatedCapexDetail}
      />

      <OffsetCapexChart
        costType="installation"
        description={`Tranche 1 (25%) at month cumulative sockets reach 25%; Tranche 2 (25%) at 50%; Tranche 3 (30%) at 100%; Tranche 4 (20%) incurred ${capexTiming.installation_tranche_4_after_last_install_midpoint} days after the midpoint of the last installation month.`}
        title="Monthly Installation Costs (CAPEX)"
        rows={truncatedCapexDetail}
      />
    </div>
  )
}

import { Zap, PoundSterling, Users, TrendingUp } from 'lucide-react'
import type { PlanMetrics } from '../api/plansApi'

function formatNumber(n: number) {
  return n.toLocaleString('en-GB')
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}K`
  return `£${n.toFixed(0)}`
}

const CAPEX_SEGMENTS = [
  { key: 'bom' as const,          label: 'BOM',          bar: 'bg-blue-500',   text: 'text-blue-600',   dot: 'bg-blue-500' },
  { key: 'installation' as const, label: 'Installation', bar: 'bg-indigo-400', text: 'text-indigo-600', dot: 'bg-indigo-400' },
  { key: 'connection' as const,   label: 'Connection',   bar: 'bg-violet-400', text: 'text-violet-600', dot: 'bg-violet-400' },
]

interface Props {
  metrics: PlanMetrics
}

export default function MetricsSection({ metrics }: Props) {
  const { target_sockets, max_installer_resource_required, capex, workforce, asset_value } = metrics

  const pct = (val: number) =>
    capex.total > 0 ? (val / capex.total) * 100 : 0

  return (
    <div className="space-y-4 mb-8">
      {/* ── Row 1: Sockets + Capex ── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Target Sockets */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <Zap size={15} className="text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Target Sockets</h3>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 tabular-nums">
            {formatNumber(target_sockets)}
          </p>
        </div>

        {/* Max Installer Resource Required */}
        <div className="col-span-4 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center shrink-0">
              <Users size={15} className="text-cyan-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">
              Max Installer Resource Required (per week)
            </h3>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 tabular-nums">
            {formatNumber(max_installer_resource_required)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Peak 30 sites/wk * 1.5 resource/site/wk
          </p>
        </div>

        {/* Total Capex */}
        <div className="col-span-5 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <PoundSterling size={15} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Total Capex</h3>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 tabular-nums mb-5">
            {formatCurrency(capex.total)}
          </p>
          <div className="flex h-2 rounded-full overflow-hidden mb-4 gap-px">
            {CAPEX_SEGMENTS.map(seg => (
              <div key={seg.key} className={seg.bar} style={{ width: `${pct(capex[seg.key])}%` }} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {CAPEX_SEGMENTS.map(seg => (
              <div key={seg.key}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${seg.dot}`} />
                  <span className="text-xs text-gray-400">{seg.label}</span>
                </div>
                <p className={`text-sm font-semibold ${seg.text} tabular-nums`}>
                  {formatCurrency(capex[seg.key])}
                </p>
                <p className="text-xs text-gray-400">{pct(capex[seg.key]).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Workforce + Asset Value ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Senior Delivery Managers */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <Users size={14} className="text-orange-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Senior Delivery Managers</h3>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 tabular-nums">
            {formatNumber(workforce.senior_delivery_managers_required)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Required</p>
        </div>

        {/* CK Delivery Managers */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <Users size={14} className="text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">CK Delivery Managers</h3>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 tabular-nums">
            {formatNumber(workforce.delivery_managers_required)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Required</p>
        </div>

        {/* Asset Value */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp size={14} className="text-teal-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Asset Value</h3>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 tabular-nums">
            {formatCurrency(asset_value)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Target sockets × £1,000</p>
        </div>
      </div>
    </div>
  )
}

export function MetricsSkeleton() {
  return (
    <div className="space-y-4 mb-8 animate-pulse">
      <div className="grid grid-cols-12 gap-4">
        {['col-span-3', 'col-span-4', 'col-span-5'].map((spanClass, i) => (
          <div key={i} className={`${spanClass} bg-white border border-gray-200 rounded-xl p-6 space-y-4`}>
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
            <div className="h-2 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-10 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

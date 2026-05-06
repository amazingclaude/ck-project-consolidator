import { useMemo } from 'react'
import { Filter, X } from 'lucide-react'
import type { PlanRow } from '../api/plansApi'

const ALL = 'All'

export interface FilterState {
  region: string
  contract: string
  workPackage: string
}

export const DEFAULT_FILTER: FilterState = { region: ALL, contract: ALL, workPackage: ALL }

interface Props {
  rows: PlanRow[]
  filter: FilterState
  onChange: (f: FilterState) => void
}

function unique(vals: string[]) {
  return [ALL, ...[...new Set(vals.filter(v => v && v !== 'nan'))].sort()]
}

const selectClass =
  'border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-[160px] disabled:opacity-40 disabled:cursor-not-allowed'

export default function FilterBar({ rows, filter, onChange }: Props) {
  const regions = useMemo(
    () => unique(rows.map(r => r.region_name)),
    [rows],
  )

  const contracts = useMemo(() => {
    const src = filter.region === ALL ? rows : rows.filter(r => r.region_name === filter.region)
    return unique(src.map(r => r.contract_name))
  }, [rows, filter.region])

  const workPackages = useMemo(() => {
    let src = rows
    if (filter.region !== ALL) src = src.filter(r => r.region_name === filter.region)
    if (filter.contract !== ALL) src = src.filter(r => r.contract_name === filter.contract)
    return unique(src.map(r => r.work_package_name))
  }, [rows, filter.region, filter.contract])

  const isFiltered = filter.region !== ALL || filter.contract !== ALL || filter.workPackage !== ALL

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-6">
      <div className="flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
        <Filter size={14} />
        <span className="font-medium text-gray-600">Filter</span>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-gray-400 whitespace-nowrap">Region</label>
        <select
          value={filter.region}
          onChange={e => onChange({ region: e.target.value, contract: ALL, workPackage: ALL })}
          className={selectClass}
        >
          {regions.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-gray-400 whitespace-nowrap">Contract</label>
        <select
          value={filter.contract}
          onChange={e => onChange({ ...filter, contract: e.target.value, workPackage: ALL })}
          disabled={contracts.length <= 1}
          className={selectClass}
        >
          {contracts.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-gray-400 whitespace-nowrap">Work Package</label>
        <select
          value={filter.workPackage}
          onChange={e => onChange({ ...filter, workPackage: e.target.value })}
          disabled={workPackages.length <= 1}
          className={selectClass}
        >
          {workPackages.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {isFiltered && (
        <button
          onClick={() => onChange(DEFAULT_FILTER)}
          className="flex items-center gap-1 ml-auto text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          <X size={13} /> Clear
        </button>
      )}
    </div>
  )
}

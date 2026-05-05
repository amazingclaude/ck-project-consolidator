import { useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'
import type { Assumptions } from '../api/plansApi'

function fmt(n: number) {
  return n.toLocaleString('en-GB')
}

function Row({ label, value, notes }: { label: string; value: string; notes?: string }) {
  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2 text-sm text-gray-600">{label}</td>
      <td className="py-2 text-sm text-gray-900 font-medium text-right tabular-nums">{value}</td>
      <td className="py-2 text-sm text-gray-400 text-left pl-4">{notes ?? ''}</td>
    </tr>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={3} className="pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </td>
    </tr>
  )
}

interface Props {
  assumptions: Assumptions
}

export default function AssumptionSheet({ assumptions }: Props) {
  const [open, setOpen] = useState(false)
  const { value_per_socket: vps, delivery_capacity_sockets_per_year: cap, notes } = assumptions

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-gray-400" />
          Assumptions
        </div>
        <ChevronDown
          size={15}
          className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Assumption
                </th>
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Value
                </th>
                <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-4">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              <SectionHeader label="Value per socket (£)" />
              <Row label="BOM"          value={`£${fmt(vps.capex_bom_per_socket)}`}          notes={notes?.capex_bom_per_socket} />
              <Row label="Installation" value={`£${fmt(vps.capex_installation_per_socket)}`} notes={notes?.capex_installation_per_socket} />
              <Row label="Connection"   value={`£${fmt(vps.capex_connection_per_socket)}`}   notes={notes?.capex_connection_per_socket} />
              <SectionHeader label="Value per site (£)" />
              <Row label="Asset Value"  value={`£${fmt(vps.asset_value_per_socket*5)}`}         notes={notes?.asset_value_per_socket} />

              <SectionHeader label="Annual delivery capacity (no. of sockets)" />
              <Row label="Senior Delivery Manager" value={`${fmt(cap.senior_delivery_manager)}`} notes={notes?.senior_delivery_manager} />
              <Row label="CK Delivery Manager"     value={`${fmt(cap.delivery_manager)}`}         notes={notes?.delivery_manager} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { BookOpen, ChevronDown, Loader2, Pencil, X } from 'lucide-react'
import type { Assumptions, AssumptionsUpdate } from '../api/plansApi'

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
  onSave?: (updates: AssumptionsUpdate) => Promise<void>
}

export default function AssumptionSheet({ assumptions, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const { value_per_socket: vps, delivery_capacity_sockets_per_year: cap, notes } = assumptions
  const avgSocketsPerSite = assumptions.avg_sockets_per_sites ?? 5
  const assetValuePerSite = assumptions.asset_value_per_sites ?? vps.asset_value_per_socket * avgSocketsPerSite

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
        <div className="flex items-center gap-2">
          {onSave && open && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); setEditing(true) }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  setEditing(true)
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
            >
              <Pencil size={13} /> Modify
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
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
              <SectionHeader label="Value per socket (GBP)" />
              <Row label="BOM" value={`GBP ${fmt(vps.capex_bom_per_socket)}`} notes={notes?.capex_bom_per_socket} />
              <Row label="Installation" value={`GBP ${fmt(vps.capex_installation_per_socket)}`} notes={notes?.capex_installation_per_socket} />
              <Row label="Connection" value={`GBP ${fmt(vps.capex_connection_per_socket)}`} notes={notes?.capex_connection_per_socket} />
              <Row label="Asset Value per Socket" value={`GBP ${fmt(vps.asset_value_per_socket)}`} notes={notes?.asset_value_per_socket} />

              <SectionHeader label="Value per site (GBP)" />
              <Row label="Average Sockets per Site" value={`${fmt(avgSocketsPerSite)}`} />
              <Row label="Asset Value" value={`GBP ${fmt(assetValuePerSite)}`} />

              <SectionHeader label="Annual delivery capacity (no. of sockets)" />
              <Row label="Senior Delivery Manager" value={`${fmt(cap.senior_delivery_manager)}`} notes={notes?.senior_delivery_manager} />
              <Row label="CK Delivery Manager" value={`${fmt(cap.delivery_manager)}`} notes={notes?.delivery_manager} />

              <SectionHeader label="Installer resource" />
              <Row label="Installer Resource per Site per Week" value={`${fmt(assumptions.installer_resource_per_site_per_week)}`} />
            </tbody>
          </table>
        </div>
      )}

      {editing && onSave && (
        <AssumptionModal
          assumptions={assumptions}
          onClose={() => setEditing(false)}
          onSave={async updates => {
            await onSave(updates)
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

function AssumptionModal({
  assumptions,
  onClose,
  onSave,
}: {
  assumptions: Assumptions
  onClose: () => void
  onSave: (updates: AssumptionsUpdate) => Promise<void>
}) {
  const avgSockets = assumptions.avg_sockets_per_sites ?? 5
  const assetValue = assumptions.asset_value_per_sites
    ?? assumptions.value_per_socket.asset_value_per_socket * avgSockets

  const [form, setForm] = useState({
    senior_delivery_manager: String(assumptions.delivery_capacity_sockets_per_year.senior_delivery_manager),
    delivery_manager: String(assumptions.delivery_capacity_sockets_per_year.delivery_manager),
    installer_resource_per_site_per_week: String(assumptions.installer_resource_per_site_per_week),
    avg_sockets_per_sites: String(avgSockets),
    asset_value_per_sites: String(assetValue),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numbers = {
    senior_delivery_manager: Number(form.senior_delivery_manager),
    delivery_manager: Number(form.delivery_manager),
    installer_resource_per_site_per_week: Number(form.installer_resource_per_site_per_week),
    avg_sockets_per_sites: Number(form.avg_sockets_per_sites),
    asset_value_per_sites: Number(form.asset_value_per_sites),
  }
  const calculatedAssetValuePerSocket =
    numbers.avg_sockets_per_sites > 0
      ? numbers.asset_value_per_sites / numbers.avg_sockets_per_sites
      : 0

  const setField = (field: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (
      !Number.isFinite(numbers.senior_delivery_manager)
      || !Number.isFinite(numbers.delivery_manager)
      || !Number.isFinite(numbers.installer_resource_per_site_per_week)
      || !Number.isFinite(numbers.avg_sockets_per_sites)
      || !Number.isFinite(numbers.asset_value_per_sites)
      || numbers.senior_delivery_manager <= 0
      || numbers.delivery_manager <= 0
      || numbers.installer_resource_per_site_per_week <= 0
      || numbers.avg_sockets_per_sites <= 0
      || numbers.asset_value_per_sites < 0
    ) {
      setError('Enter positive numeric values. Asset value per site can be zero.')
      return
    }

    setSaving(true)
    try {
      await onSave(numbers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save assumptions')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-[520px] max-w-[calc(100vw-2rem)] p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Modify Assumptions</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Senior Delivery Manager"
            value={form.senior_delivery_manager}
            onChange={value => setField('senior_delivery_manager', value)}
          />
          <NumberField
            label="CK Delivery Manager"
            value={form.delivery_manager}
            onChange={value => setField('delivery_manager', value)}
          />
          <NumberField
            label="Installer Resource per Site per Week"
            value={form.installer_resource_per_site_per_week}
            onChange={value => setField('installer_resource_per_site_per_week', value)}
          />
          <NumberField
            label="Average Sockets per Site"
            value={form.avg_sockets_per_sites}
            onChange={value => setField('avg_sockets_per_sites', value)}
          />
          <NumberField
            label="Asset Value per Site"
            value={form.asset_value_per_sites}
            onChange={value => setField('asset_value_per_sites', value)}
          />
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Asset Value per Socket
            </label>
            <div className="h-10 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 tabular-nums">
              GBP {Number.isFinite(calculatedAssetValuePerSocket) ? fmt(calculatedAssetValuePerSocket) : '0'}
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      />
    </div>
  )
}

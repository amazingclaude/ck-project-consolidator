import type { Plan } from '../context/PlansContext'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ─── Plans CRUD ───────────────────────────────────────────────────────────────

export async function fetchPlans(): Promise<Plan[]> {
  return handleResponse<Plan[]>(await fetch('/api/plans'))
}

export async function createPlan(name: string, file: File): Promise<Plan> {
  const form = new FormData()
  form.append('name', name)
  form.append('file', file)
  return handleResponse<Plan>(
    await fetch('/api/plans', { method: 'POST', body: form }),
  )
}

export async function patchPlan(
  id: string,
  updates: { name?: string; status?: string; file?: File },
): Promise<Plan> {
  const form = new FormData()
  if (updates.name !== undefined) form.append('name', updates.name)
  if (updates.status !== undefined) form.append('status', updates.status)
  if (updates.file) form.append('file', updates.file)
  return handleResponse<Plan>(
    await fetch(`/api/plans/${id}`, { method: 'PATCH', body: form }),
  )
}

export async function removePlan(id: string): Promise<void> {
  return handleResponse<void>(
    await fetch(`/api/plans/${id}`, { method: 'DELETE' }),
  )
}

// ─── Assumptions ──────────────────────────────────────────────────────────────

export interface Assumptions {
  value_per_socket: {
    capex_bom_per_socket: number
    capex_installation_per_socket: number
    capex_connection_per_socket: number
    asset_value_per_socket: number
  }
  delivery_capacity_sockets_per_year: {
    senior_delivery_manager: number
    delivery_manager: number
  }
  payment_schedule: {
    cost_type: string
    cost_column: string
    offset_days: number
    payment_pct: number
  }[]
  notes: {
    capex_bom_per_socket: string
    capex_installation_per_socket: string
    capex_connection_per_socket: string
    asset_value_per_socket: string
    senior_delivery_manager: string
    delivery_manager: string
  }
}

export async function fetchAssumptions(): Promise<Assumptions> {
  return handleResponse<Assumptions>(await fetch('/api/assumptions'))
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface PlanMetrics {
  target_sockets: number
  capex: {
    total: number
    bom: number
    installation: number
    connection: number
  }
  workforce: {
    senior_delivery_managers_required: number
    delivery_managers_required: number
  }
  asset_value: number
}

export async function fetchPlanMetrics(id: string): Promise<PlanMetrics> {
  return handleResponse<PlanMetrics>(await fetch(`/api/plans/${id}/metrics`))
}

// ─── Plan rows (SQL source of truth) ─────────────────────────────────────────

export interface PlanRow {
  row_id: number
  region_name: string
  contract_name: string
  work_package_name: string
  capex_bom_per_socket: number
  capex_installation_per_socket: number
  capex_connection_per_socket: number
  total_capex_per_socket: number
  target_sockets: number
  target_sockets_1: number
  target_sockets_2: number
  target_sockets_3: number
  target_sockets_4: number
  target_sockets_5: number
  target_sockets_6: number
  target_sockets_7: number
  target_sockets_8: number
  target_sockets_9: number
  target_sockets_10: number
  target_sockets_11: number
  target_sockets_12: number
}

export async function fetchPlanRows(id: string): Promise<PlanRow[]> {
  return handleResponse<PlanRow[]>(await fetch(`/api/plans/${id}/rows`))
}

export async function updatePlanRow(
  planId: string,
  rowId: number,
  data: Partial<Omit<PlanRow, 'row_id'>>,
): Promise<void> {
  return handleResponse<void>(
    await fetch(`/api/plans/${planId}/rows/${rowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
}

import type { Plan } from '../context/PlansContext'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

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

export interface PlanMetrics {
  targets_vs_planned: {
    target_sockets: number
    planned_sockets: number
  }
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

export interface Assumptions {
  value_per_socket: {
    capex_bom: number
    capex_installation: number
    capex_connection: number
    capex_total: number
    asset_value: number
  }
  delivery_capacity_sockets_per_year: {
    senior_delivery_manager: number
    delivery_manager: number
  }
}

export async function fetchPlanMetrics(id: string): Promise<PlanMetrics> {
  return handleResponse<PlanMetrics>(await fetch(`/api/plans/${id}/metrics`))
}

export async function fetchAssumptions(): Promise<Assumptions> {
  return handleResponse<Assumptions>(await fetch('/api/assumptions'))
}

export type PlanRow = {
  custom_region_name: string
  contract_name: string
  work_package_name: string
} & Record<string, number | string>

export async function fetchPlanData(id: string): Promise<PlanRow[]> {
  return handleResponse<PlanRow[]>(await fetch(`/api/plans/${id}/data`))
}

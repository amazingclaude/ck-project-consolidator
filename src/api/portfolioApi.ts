export interface StageGateRow {
  row_id: number
  sg_plan_id: string
  plan_year: number
  work_package_name: string
  planned_gate_1: number | null
  planned_gate_2: number | null
  planned_gate_3: number | null
  planned_gate_4: number | null
  forecast_gate_1: number | null
  forecast_gate_2: number | null
  forecast_gate_3: number | null
  forecast_gate_4: number | null
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : ''
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function fetchStageGateRows(planYear: number): Promise<StageGateRow[]> {
  return handleResponse<StageGateRow[]>(
    await fetch(`/api/stage-gates/rows?plan_year=${planYear}`),
  )
}

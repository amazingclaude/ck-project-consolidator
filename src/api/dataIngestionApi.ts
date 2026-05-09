export interface MppUploadResult {
  fileName: string
  blobName: string
}

export interface SyncMppResult {
  updatedRows: number
  message: string
}

export interface StageGatesUploadResult {
  fileName: string
  planYear: number
  rowCount: number
  sgPlanId: string
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : ''
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function uploadMppFile(file: File): Promise<MppUploadResult> {
  const form = new FormData()
  form.append('file', file)
  return handleResponse<MppUploadResult>(
    await fetch('/api/data-ingestion/mpp', { method: 'POST', body: form }),
  )
}

export async function uploadStageGatesFile(file: File, planYear: number): Promise<StageGatesUploadResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('plan_year', String(planYear))
  return handleResponse<StageGatesUploadResult>(
    await fetch('/api/data-ingestion/stage-gates', { method: 'POST', body: form }),
  )
}

export async function syncForecastGatesFromMpp(planYear: number): Promise<SyncMppResult> {
  return handleResponse<SyncMppResult>(
    await fetch('/api/stage-gates/sync-mpp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_year: planYear }),
    }),
  )
}

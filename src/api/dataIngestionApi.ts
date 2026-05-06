export interface MppUploadResult {
  fileName: string
  blobName: string
}

export interface StageGatesUploadResult {
  fileName: string
  blobName: string
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

export async function uploadStageGatesFile(file: File): Promise<StageGatesUploadResult> {
  const form = new FormData()
  form.append('file', file)
  return handleResponse<StageGatesUploadResult>(
    await fetch('/api/data-ingestion/stage-gates', { method: 'POST', body: form }),
  )
}

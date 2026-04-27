export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `HTTP ${res.status}`

  try {
    const parsed = JSON.parse(text) as { detail?: unknown }
    if (typeof parsed.detail === 'string') return parsed.detail
  } catch {
    // Fall through to raw text.
  }

  return text
}

export async function sendAssistantMessage(
  messages: ChatMessage[],
): Promise<string> {
  const res = await fetch('/api/ai-assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  if (!res.ok) {
    throw new Error(await readError(res))
  }

  const data = (await res.json()) as { message?: string }
  if (!data.message) {
    throw new Error('Assistant response was empty')
  }

  return data.message
}

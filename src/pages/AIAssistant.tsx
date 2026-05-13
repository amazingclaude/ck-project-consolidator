import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Bot, Loader2, Send, User } from 'lucide-react'
import {
  sendAssistantMessage,
  type ChatMessage,
} from '../api/aiAssistantApi'

const starterPrompts = [
  'Tell me the number of sockets being delivered in a particular Work Package',
  'What is the CAPEX plan for delivering planned sockets in a particular Work Package?',
  'What is the impact on the CAPEX plan, if my delivery of sockets under a particular Work Package is delayed by 2 months?',
]

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hi, I can help with planning analysis, portfolio trade-offs, report drafting, and delivery questions. What would you like to explore?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const canSend = input.trim().length > 0 && !loading

  const historyForApi = useMemo(
    () => messages.filter((message) => message.content.trim().length > 0),
    [messages],
  )

  const submitMessage = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || loading) return

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: trimmed },
    ]

    setMessages(nextMessages)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const reply = await sendAssistantMessage([
        ...historyForApi,
        { role: 'user', content: trimmed },
      ])
      setMessages([...nextMessages, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assistant request failed')
      setMessages(nextMessages)
    } finally {
      setLoading(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitMessage(input)
  }

  return (
    <div className="px-8 py-8 min-h-full flex flex-col">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            AI Assistant
          </h1>
          <p className="mt-2 text-sm text-gray-500 max-w-2xl">
            Ask planning questions, generate summaries, and work through EV
            infrastructure delivery decisions with the connected AI Foundry
            model.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-6 flex-1 min-h-[620px]">
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {messages.map((message, index) => {
              const isAssistant = message.role === 'assistant'
              const Icon = isAssistant ? Bot : User

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex gap-3 ${isAssistant ? '' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </span>
                  )}
                  <div
                    className={`max-w-[78%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      isAssistant
                        ? 'bg-gray-50 text-gray-700 border border-gray-100'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {message.content}
                  </div>
                  {!isAssistant && (
                    <span className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </span>
                  )}
                </div>
              )
            })}

            {loading && (
              <div className="flex gap-3">
                <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Bot size={18} />
                </span>
                <div className="rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-500 border border-gray-100 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-5 mb-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-200 p-4 flex items-end gap-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submitMessage(input)
                }
              }}
              placeholder="Ask about delivery risks, cost assumptions, schedules, or reporting..."
              rows={2}
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-45 disabled:hover:bg-emerald-600 transition-colors"
              aria-label="Send message"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </section>

        <aside className="space-y-4 xl:block">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">
              Start with
            </h2>
            <div className="space-y-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitMessage(prompt)}
                  disabled={loading}
                  className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

        </aside>
      </div>
    </div>
  )
}

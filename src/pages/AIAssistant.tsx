import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Bot, Loader2, MessageSquarePlus, Send, Trash2, User } from 'lucide-react'
import {
  sendAssistantMessage,
  type ChatMessage,
} from '../api/aiAssistantApi'

const STORAGE_KEY = 'ai-assistant-sessions'
const MAX_SESSIONS = 20

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    'Hi, I can help with planning analysis, portfolio trade-offs, report drafting, and delivery questions. What would you like to explore?',
}

const starterPrompts = [
  'Tell me the number of sockets being delivered in a particular Work Package',
  'What is the CAPEX plan for delivering planned sockets in a particular Work Package?',
  'What is the impact on the CAPEX plan, if my delivery of sockets under a particular Work Package is delayed by 2 months?',
]

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChatSession[]) : []
  } catch {
    return []
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // storage quota exceeded or unavailable
  }
}

function formatAge(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export default function AIAssistant() {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const canSend = input.trim().length > 0 && !loading

  const historyForApi = useMemo(
    () => messages.filter((message) => message.content.trim().length > 0),
    [messages],
  )

  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const startNewChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE])
    setCurrentSessionId(null)
    setInput('')
    setError(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const loadSession = useCallback((session: ChatSession) => {
    setMessages(session.messages)
    setCurrentSessionId(session.id)
    setInput('')
    setError(null)
  }, [])

  const deleteSession = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (currentSessionId === sessionId) {
        setMessages([INITIAL_MESSAGE])
        setCurrentSessionId(null)
      }
    },
    [currentSessionId],
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
      const finalMessages: ChatMessage[] = [
        ...nextMessages,
        { role: 'assistant', content: reply },
      ]
      setMessages(finalMessages)

      const now = Date.now()
      if (currentSessionId) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? { ...s, messages: finalMessages, updatedAt: now }
              : s,
          ),
        )
      } else {
        const newSession: ChatSession = {
          id: crypto.randomUUID(),
          title:
            trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed,
          messages: finalMessages,
          createdAt: now,
          updatedAt: now,
        }
        setCurrentSessionId(newSession.id)
        setSessions((prev) =>
          [newSession, ...prev].slice(0, MAX_SESSIONS),
        )
      }
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
        <button
          type="button"
          onClick={startNewChat}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors shrink-0"
        >
          <MessageSquarePlus size={16} />
          New chat
        </button>
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
            <div ref={messagesEndRef} />
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

        <aside className="space-y-4 xl:block flex flex-col">
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

          {sessions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col min-h-0">
              <h2 className="text-sm font-bold text-gray-900 mb-3 shrink-0">
                History
              </h2>
              <div className="space-y-1 overflow-y-auto max-h-72">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className={`group flex items-start gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      currentSessionId === session.id
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate leading-snug">
                        {session.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatAge(session.updatedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteSession(session.id, e)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all mt-0.5"
                      aria-label="Delete chat"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

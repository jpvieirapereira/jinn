"use client"
import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useGateway } from '@/hooks/use-gateway'
import { PageLayout } from '@/components/page-layout'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { ChatMessages } from '@/components/chat/chat-messages'
import { ChatInput } from '@/components/chat/chat-input'
import type { Message, MediaAttachment } from '@/lib/conversations'

const ONBOARDING_PROMPT = `This is your first time being activated. The user just set up Jimmy and opened the web dashboard for the first time.

Read your CLAUDE.md instructions and the onboarding skill at ~/.jimmy/skills/onboarding/SKILL.md, then follow the onboarding flow:
- Greet the user warmly and introduce yourself as Jimmy
- Briefly explain what you can do (manage cron jobs, hire AI employees, connect to Slack, etc.)
- Check if ~/.openclaw/ exists and mention migration if so
- Ask the user what they'd like to set up first`

export default function ChatPageWrapper() {
  return (
    <Suspense fallback={
      <PageLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
          Loading...
        </div>
      </PageLayout>
    }>
      <ChatPage />
    </Suspense>
  )
}

function ChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar')
  const { events } = useGateway()
  const searchParams = useSearchParams()
  const onboardingTriggered = useRef(false)
  const streamingRef = useRef(false)

  // Auto-trigger onboarding on first visit
  useEffect(() => {
    if (onboardingTriggered.current) return

    const shouldOnboard = searchParams.get('onboarding') === '1'

    if (shouldOnboard) {
      onboardingTriggered.current = true
      triggerOnboarding()
    } else {
      api.getOnboarding().then((data) => {
        if (data.needed && !onboardingTriggered.current) {
          onboardingTriggered.current = true
          triggerOnboarding()
        }
      }).catch(() => {})
    }
  }, [searchParams])

  function triggerOnboarding() {
    setMessages([{
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Starting up for the first time...',
      timestamp: Date.now(),
    }])
    setLoading(true)

    api.createSession({
      source: 'web',
      prompt: ONBOARDING_PROMPT,
    }).then((session) => {
      const id = String((session as Record<string, unknown>).id)
      setSelectedId(id)
      setRefreshKey((k) => k + 1)
    }).catch((err) => {
      setLoading(false)
      setMessages([{
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Failed to start onboarding: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      }])
    })
  }

  // Listen for session:delta and session:completed events
  useEffect(() => {
    if (events.length === 0) return
    const latest = events[events.length - 1]
    const payload = latest.payload as Record<string, unknown>

    const matchesSession = selectedId && payload.sessionId === selectedId
    const isOnboarding = !selectedId && onboardingTriggered.current
    if (!matchesSession && !isOnboarding) return

    if (latest.event === 'session:delta') {
      const deltaType = String(payload.type || 'text')
      const content = String(payload.content || '')

      if (deltaType === 'text') {
        if (!content) return
        if (!streamingRef.current) {
          streamingRef.current = true
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content,
              timestamp: Date.now(),
              isStreaming: true,
            },
          ])
        } else {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + content,
              }
            }
            return updated
          })
        }
      } else if (deltaType === 'tool_use') {
        const toolName = String(payload.toolName || 'tool')
        // If we have a streaming text message, finalize it before adding tool call
        if (streamingRef.current) {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === 'assistant' && last.isStreaming) {
              updated[updated.length - 1] = { ...last, isStreaming: false }
            }
            return updated
          })
          streamingRef.current = false
        }
        // Add tool call as a separate message
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: `Using ${toolName}`,
            timestamp: Date.now(),
            toolCall: toolName,
          },
        ])
      } else if (deltaType === 'tool_result') {
        // Mark the tool call message as completed
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant' && last.toolCall) {
            updated[updated.length - 1] = { ...last, content: `Used ${last.toolCall}`, toolStatus: undefined }
          }
          return updated
        })
      }
    }

    if (latest.event === 'session:completed') {
      if (isOnboarding && payload.sessionId) {
        setSelectedId(String(payload.sessionId))
      }
      streamingRef.current = false
      setLoading(false)

      if (payload.result) {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.content) {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...last,
              content: String(payload.result),
              isStreaming: false,
            }
            return updated
          }
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: String(payload.result),
              timestamp: Date.now(),
            },
          ]
        })
      }
      if (payload.error && !payload.result) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: `Error: ${payload.error}`,
            timestamp: Date.now(),
          },
        ])
      }
      setRefreshKey((k) => k + 1)
    }
  }, [events, selectedId])

  const loadSession = useCallback(async (id: string) => {
    try {
      const session = (await api.getSession(id)) as Record<string, unknown>
      const history = session.messages || session.history || []
      if (Array.isArray(history)) {
        setMessages(
          history.map((m: Record<string, unknown>) => ({
            id: crypto.randomUUID(),
            role: (m.role as 'user' | 'assistant') || 'assistant',
            content: String(m.content || m.text || ''),
            timestamp: m.timestamp ? Number(m.timestamp) : Date.now(),
          }))
        )
      }
      if (session.status === 'running') {
        setLoading(true)
      }
    } catch {
      setMessages([])
    }
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id)
      setMessages([])
      setLoading(false)
      streamingRef.current = false
      setMobileView('chat')
      loadSession(id)
    },
    [loadSession]
  )

  const handleNewChat = useCallback(() => {
    setSelectedId(null)
    setMessages([])
    setLoading(false)
    streamingRef.current = false
    setMobileView('chat')
  }, [])

  const handleSend = useCallback(
    async (message: string, media?: MediaAttachment[]) => {
      const isOnboardingMsg = message === ONBOARDING_PROMPT
      if (!isOnboardingMsg) {
        const userMsg: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
          timestamp: Date.now(),
          media,
        }
        setMessages((prev) => [...prev, userMsg])
      }
      setLoading(true)
      streamingRef.current = false

      try {
        let sessionId = selectedId

        if (!sessionId) {
          const session = (await api.createSession({
            source: 'web',
            prompt: message,
          })) as Record<string, unknown>
          sessionId = String(session.id)
          setSelectedId(sessionId)
          setRefreshKey((k) => k + 1)
        } else {
          await api.sendMessage(sessionId, { message })
          setRefreshKey((k) => k + 1)
        }
      } catch (err) {
        setLoading(false)
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: `Error: ${err instanceof Error ? err.message : 'Failed to send message'}`,
            timestamp: Date.now(),
          },
        ])
      }
    },
    [selectedId]
  )

  const handleStatusRequest = useCallback(async () => {
    if (!selectedId) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: 'No active session. Send a message to start one.',
          timestamp: Date.now(),
        },
      ])
      return
    }

    try {
      const session = (await api.getSession(selectedId)) as Record<string, unknown>
      const info = [
        '**Session Info**',
        `ID: \`${session.id}\``,
        `Status: ${session.status || 'unknown'}`,
        session.employee ? `Employee: ${session.employee}` : null,
        session.engine ? `Engine: ${session.engine}` : null,
        session.model ? `Model: ${session.model}` : null,
        session.createdAt ? `Created: ${session.createdAt}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: info,
          timestamp: Date.now(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: 'Failed to fetch session status.',
          timestamp: Date.now(),
        },
      ])
    }
  }, [selectedId])

  return (
    <PageLayout>
      <div style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
      }}>
        {/* Desktop sidebar — always visible on md+ */}
        <div className="hidden md:block" style={{ width: 280, flexShrink: 0, height: '100%' }}>
          <ChatSidebar
            selectedId={selectedId}
            onSelect={handleSelect}
            onNewChat={handleNewChat}
            refreshKey={refreshKey}
          />
        </div>

        {/* Mobile: sidebar view */}
        <div
          className="md:hidden"
          style={{
            width: '100%',
            height: '100%',
            display: mobileView === 'sidebar' ? 'block' : 'none',
          }}
        >
          <ChatSidebar
            selectedId={selectedId}
            onSelect={handleSelect}
            onNewChat={handleNewChat}
            refreshKey={refreshKey}
          />
        </div>

        {/* Chat area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'var(--bg)',
            minWidth: 0,
          }}
          className={mobileView === 'sidebar' ? 'hidden md:flex' : 'flex'}
        >
          {/* Header */}
          <div style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            padding: '0 var(--space-4)',
            borderBottom: '1px solid var(--separator)',
            background: 'var(--material-thick)',
            flexShrink: 0,
          }}>
            {/* Mobile back button */}
            <button
              className="md:hidden"
              onClick={() => setMobileView('sidebar')}
              aria-label="Back to sessions"
              style={{
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                marginRight: 'var(--space-2)',
                fontSize: 'var(--text-subheadline)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>

            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'var(--text-subheadline)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                letterSpacing: '-0.2px',
              }}>
                {selectedId ? `Session ${selectedId.slice(0, 8)}...` : 'New Chat'}
              </div>
            </div>
          </div>

          {/* Messages */}
          <ChatMessages messages={messages} loading={loading} />

          {/* Input */}
          <ChatInput
            disabled={loading}
            onSend={handleSend}
            onNewSession={handleNewChat}
            onStatusRequest={handleStatusRequest}
          />
        </div>
      </div>
    </PageLayout>
  )
}

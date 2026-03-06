"use client"
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Session {
  id: string
  employee?: string
  status?: string
  source?: string
  lastActivity?: string
  createdAt?: string
  [key: string]: unknown
}

interface ChatSidebarProps {
  selectedId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  refreshKey: number
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusColor(status?: string): string {
  switch (status) {
    case 'running': return 'var(--system-yellow)'
    case 'idle':
    case 'completed': return 'var(--system-green)'
    case 'error': return 'var(--system-red)'
    default: return 'var(--text-quaternary)'
  }
}

export function ChatSidebar({
  selectedId,
  onSelect,
  onNewChat,
  refreshKey,
}: ChatSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    api
      .getSessions()
      .then((data) => {
        const filtered = (data as Session[]).filter(
          (s) => s.source === 'web' || !s.source
        )
        filtered.sort((a, b) => {
          const ta = a.lastActivity || a.createdAt || ''
          const tb = b.lastActivity || b.createdAt || ''
          return tb.localeCompare(ta)
        })
        setSessions(filtered)
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [refreshKey])

  const displayed = search.trim()
    ? sessions.filter((s) => {
        const q = search.toLowerCase()
        return (
          s.id.toLowerCase().includes(q) ||
          (s.employee && s.employee.toLowerCase().includes(q))
        )
      })
    : sessions

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--separator)',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-4) var(--space-4) var(--space-3)',
        borderBottom: '1px solid var(--separator)',
        background: 'var(--material-thick)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
        }}>
          <h2 style={{
            fontSize: 'var(--text-title3)',
            fontWeight: 'var(--weight-bold)',
            letterSpacing: '-0.5px',
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            Chats
          </h2>
          <button
            onClick={onNewChat}
            aria-label="New chat"
            style={{
              padding: 'var(--space-1) var(--space-3)',
              fontSize: 'var(--text-footnote)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--accent-contrast)',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>

        {/* Search */}
        <div style={{
          background: 'var(--fill-tertiary)',
          borderRadius: 'var(--radius-md)',
          padding: '7px var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            aria-label="Search sessions"
            style={{
              flex: 1,
              fontSize: 'var(--text-footnote)',
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              margin: 0,
              lineHeight: 1.4,
            }}
          />
          {search.trim() && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              style={{
                padding: 2,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-1) 0' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)' }}>
              Loading sessions...
            </span>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)' }}>
              {search.trim() ? 'No matching sessions' : 'No conversations yet'}
            </span>
          </div>
        ) : (
          displayed.map((session) => {
            const isActive = session.id === selectedId
            const timeLabel = formatTime(session.lastActivity || session.createdAt)

            return (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: isActive ? 'var(--fill-secondary)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {/* Status indicator */}
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: statusColor(session.status),
                  flexShrink: 0,
                }} />

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 2,
                  }}>
                    <span style={{
                      fontSize: 'var(--text-footnote)',
                      fontWeight: 'var(--weight-semibold)',
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 140,
                    }}>
                      {session.employee || 'Jimmy'}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-caption2)',
                      color: 'var(--text-tertiary)',
                      flexShrink: 0,
                      marginLeft: 'var(--space-1)',
                    }}>
                      {timeLabel}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 'var(--text-caption1)',
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {session.id.slice(0, 12)}...
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

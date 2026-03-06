"use client"
import React, { useEffect, useRef, useState } from 'react'
import type { Message, MediaAttachment } from '@/lib/conversations'
import { parseMedia } from '@/lib/conversations'
import { FileAttachment } from './file-attachment'
import { VoiceMessage } from './voice-message'

/* ── Markdown rendering ─────────────────────────────────── */

function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  // URLs, bold, inline code, italic — in priority order
  const regex = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])|(\*\*(.+?)\*\*)|(`([^`]+)`)|\*([^*]+)\*/g
  let last = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1]) {
      parts.push(
        <a
          key={match.index}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--system-blue)', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          {match[1]}
        </a>
      )
    } else if (match[2]) {
      parts.push(<strong key={match.index} style={{ fontWeight: 'var(--weight-bold)' }}>{match[3]}</strong>)
    } else if (match[4]) {
      parts.push(
        <code key={match.index} style={{
          background: 'var(--fill-secondary)',
          border: '1px solid var(--separator)',
          borderRadius: 5,
          padding: '1px 5px',
          fontSize: '0.88em',
          fontFamily: '"SF Mono", Menlo, monospace',
          color: 'var(--accent)',
        }}>{match[5]}</code>
      )
    } else if (match[6]) {
      parts.push(<em key={match.index} style={{ fontStyle: 'italic', opacity: 0.85 }}>{match[6]}</em>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function CodeBlock({ code, keyProp }: { code: string; keyProp: number }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div key={keyProp} style={{ position: 'relative', margin: '8px 0' }}>
      <button
        onClick={handleCopy}
        aria-label="Copy code"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          padding: '2px 8px',
          fontSize: 11,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--fill-secondary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--separator)',
          cursor: 'pointer',
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre style={{
        background: 'var(--fill-tertiary)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        overflowX: 'auto',
        fontSize: 13,
        lineHeight: 1.5,
        fontFamily: '"SF Mono", Menlo, monospace',
        color: 'var(--text-primary)',
      }}><code>{code}</code></pre>
    </div>
  )
}

function formatMessage(content: string): React.ReactNode {
  if (!content) return null
  const lines = content.split('\n')
  const result: React.ReactNode[] = []
  let inCodeBlock = false
  let codeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLines = []
      } else {
        inCodeBlock = false
        result.push(<CodeBlock key={i} keyProp={i} code={codeLines.join('\n')} />)
        codeLines = []
      }
      continue
    }
    if (inCodeBlock) { codeLines.push(line); continue }
    if (line.trim() === '') { result.push(<div key={`space-${i}`} style={{ height: 6 }} />); continue }
    if (line.match(/^[-*] /)) {
      result.push(
        <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 2 }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>&bull;</span>
          <span>{inlineFormat(line.slice(2))}</span>
        </div>
      )
      continue
    }
    if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)?.[1]
      result.push(
        <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 2 }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, fontWeight: 'var(--weight-semibold)', minWidth: 16 }}>{num}.</span>
          <span>{inlineFormat(line.replace(/^\d+\. /, ''))}</span>
        </div>
      )
      continue
    }
    if (line.startsWith('### ')) {
      result.push(
        <div key={i} style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-footnote)', marginTop: 'var(--space-2)', marginBottom: 2 }}>
          {inlineFormat(line.slice(4))}
        </div>
      )
      continue
    }
    if (line.startsWith('## ')) {
      result.push(
        <div key={i} style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-subheadline)', marginTop: 'var(--space-3)', marginBottom: 3 }}>
          {inlineFormat(line.slice(3))}
        </div>
      )
      continue
    }
    if (line.startsWith('# ')) {
      result.push(
        <div key={i} style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', marginTop: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
          {inlineFormat(line.slice(2))}
        </div>
      )
      continue
    }
    result.push(<div key={i} style={{ marginBottom: 1 }}>{inlineFormat(line)}</div>)
  }

  // Close unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    result.push(<CodeBlock key="trailing-code" keyProp={999} code={codeLines.join('\n')} />)
  }

  return <>{result}</>
}

/* ── Timestamp formatting ──────────────────────────────── */

function formatTimestamp(ts: number): string {
  const now = new Date()
  const date = new Date(ts)
  const isToday = now.toDateString() === date.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = yesterday.toDateString() === date.toDateString()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  if (isToday) return `Today ${time}`
  if (isYesterday) return `Yesterday ${time}`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`
}

function shouldShowTimestamp(messages: Message[], index: number): boolean {
  if (index === 0) return true
  const gap = messages[index].timestamp - messages[index - 1].timestamp
  return gap > 5 * 60 * 1000
}

/* ── Render media helpers ─────────────────────────────── */

function renderMedia(media: MediaAttachment[], isUser: boolean) {
  const images = media.filter(m => m.type === 'image')
  const audio = media.filter(m => m.type === 'audio')
  const files = media.filter(m => m.type === 'file')

  return (
    <>
      {images.map((m, mi) => (
        <div key={`img-${mi}`} style={{
          marginTop: 'var(--space-2)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          maxWidth: 280,
        }}>
          <img
            src={m.url}
            alt={m.name || 'Image'}
            style={{ width: '100%', display: 'block', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}
            onClick={() => window.open(m.url, '_blank')}
          />
        </div>
      ))}
      {audio.map((m, mi) => (
        <div key={`audio-${mi}`} style={{ marginTop: 'var(--space-2)' }}>
          <VoiceMessage
            src={m.url}
            duration={m.duration || 0}
            waveform={m.waveform || []}
            isUser={isUser}
          />
        </div>
      ))}
      {files.map((m, mi) => (
        <div key={`file-${mi}`} style={{ marginTop: 'var(--space-2)' }}>
          <FileAttachment
            name={m.name || 'File'}
            size={m.size}
            mimeType={m.mimeType}
            url={m.url}
            isUser={isUser}
          />
        </div>
      ))}
    </>
  )
}

/* ── Component ──────────────────────────────────────────── */

interface ChatMessagesProps {
  messages: Message[]
  loading: boolean
}

export function ChatMessages({ messages, loading }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  if (messages.length === 0 && !loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--text-title3)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-tertiary)',
          }}>
            Start a conversation
          </div>
          <div style={{
            fontSize: 'var(--text-footnote)',
            color: 'var(--text-quaternary)',
            marginTop: 'var(--space-2)',
          }}>
            Send a message or use /new to begin
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--space-5) 0 var(--space-8) 0',
      background: 'var(--bg)',
    }}>
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user'
        const showTimestamp = shouldShowTimestamp(messages, i)
        const isLastAssistant = !isUser && i === messages.length - 1 && (loading || msg.isStreaming)
        const showTypingDots = isLastAssistant && !msg.content
        const media = msg.media || parseMedia(msg.content)

        // Strip media URLs from text for display
        let textContent = msg.content
        if (media.length > 0 && !msg.media) {
          media.forEach(m => {
            textContent = textContent.replace(m.url, '')
            textContent = textContent.replace(/!\[[^\]]*\]\([^)]+\)/g, '')
          })
          textContent = textContent.trim()
        }
        // Hide auto-generated content labels for media-only messages
        if (msg.media && msg.media.length > 0) {
          const isAutoLabel = textContent.startsWith('[') && textContent.endsWith(']')
          if (isAutoLabel) textContent = ''
        }

        return (
          <div key={msg.id || i}>
            {/* Timestamp divider */}
            {showTimestamp && (
              <div style={{
                textAlign: 'center',
                padding: 'var(--space-3) 0',
                fontSize: 'var(--text-caption2)',
                color: 'var(--text-tertiary)',
              }}>
                {formatTimestamp(msg.timestamp)}
              </div>
            )}

            {/* Spacing between role switches */}
            {!showTimestamp && i > 0 && (
              <div style={{ height: messages[i - 1].role !== msg.role ? 'var(--space-4)' : 'var(--space-1)' }} />
            )}

            {/* User message */}
            {isUser && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                padding: '0 var(--space-4)',
                marginBottom: 'var(--space-1)',
              }}>
                {textContent && (
                  <div style={{
                    maxWidth: '75%',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)',
                    background: 'var(--accent)',
                    color: 'var(--accent-contrast)',
                    fontSize: 'var(--text-subheadline)',
                    lineHeight: 'var(--leading-relaxed)',
                    fontWeight: 'var(--weight-medium)',
                    boxShadow: 'var(--shadow-subtle)',
                  }}>
                    {textContent}
                  </div>
                )}
                {media.length > 0 && (
                  <div style={{ maxWidth: '75%' }}>
                    {renderMedia(media, true)}
                  </div>
                )}
              </div>
            )}

            {/* Assistant message */}
            {!isUser && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                padding: '0 var(--space-4)',
                marginBottom: 'var(--space-1)',
              }}>
                <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column' }}>
                  {/* Typing indicator */}
                  {showTypingDots && (
                    <div style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
                      background: 'var(--material-thin)',
                      border: '1px solid var(--separator)',
                    }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--text-quaternary)',
                          animation: 'jimmy-pulse 1.4s infinite',
                          animationDelay: '0ms',
                        }} />
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--text-quaternary)',
                          animation: 'jimmy-pulse 1.4s infinite',
                          animationDelay: '200ms',
                        }} />
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--text-quaternary)',
                          animation: 'jimmy-pulse 1.4s infinite',
                          animationDelay: '400ms',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Text bubble */}
                  {textContent && (
                    <div style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
                      background: 'var(--material-thin)',
                      border: '1px solid var(--separator)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-subheadline)',
                      lineHeight: 'var(--leading-relaxed)',
                    }}>
                      {formatMessage(textContent)}
                      {/* Streaming cursor */}
                      {isLastAssistant && textContent && (
                        <span style={{
                          display: 'inline-block',
                          width: 2,
                          height: '1.1em',
                          background: 'var(--accent)',
                          marginLeft: 2,
                          animation: 'jimmy-blink 1s step-end infinite',
                          verticalAlign: 'text-bottom',
                        }} />
                      )}
                    </div>
                  )}

                  {/* Media attachments */}
                  {media.length > 0 && renderMedia(media, false)}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Global loading indicator when no messages are streaming yet */}
      {loading && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && messages[messages.length - 1]?.role === 'user' && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          padding: '0 var(--space-4)',
          marginTop: 'var(--space-2)',
        }}>
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
            background: 'var(--material-thin)',
            border: '1px solid var(--separator)',
          }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--text-quaternary)',
                animation: 'jimmy-pulse 1.4s infinite',
                animationDelay: '0ms',
              }} />
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--text-quaternary)',
                animation: 'jimmy-pulse 1.4s infinite',
                animationDelay: '200ms',
              }} />
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--text-quaternary)',
                animation: 'jimmy-pulse 1.4s infinite',
                animationDelay: '400ms',
              }} />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      {/* Keyframe animations */}
      <style>{`
        @keyframes jimmy-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes jimmy-blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

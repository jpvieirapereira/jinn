"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Copy, Minimize2, X } from "lucide-react"
import { api } from "@/lib/api"
import { useGateway } from "@/hooks/use-gateway"
import { parseLogLine } from "@/components/activity/log-browser"
import type { ParsedLogEntry } from "@/components/activity/log-browser"

/* ── Constants ────────────────────────────────────────────────── */

const MAX_LINES = 500
const WIDGET_EVENT = "open-live-stream"

const LEVEL_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  info: { bg: "rgba(48,209,88,0.12)", color: "var(--system-green)", label: "INF" },
  warn: { bg: "rgba(255,159,10,0.12)", color: "var(--system-orange)", label: "WRN" },
  error: { bg: "rgba(255,69,58,0.12)", color: "var(--system-red)", label: "ERR" },
  debug: { bg: "var(--fill-secondary)", color: "var(--text-tertiary)", label: "DBG" },
}

function formatTime(ts: string): string {
  if (!ts) return ""
  // Already formatted as "2026-03-07 12:00:00", show just the time portion
  const parts = ts.split(" ")
  return parts.length > 1 ? parts[1] : ts
}

function formatCopyLine(entry: ParsedLogEntry): string {
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`
}

/* ── Visual states ────────────────────────────────────────────── */

type WidgetState = "hidden" | "collapsed" | "expanded"

/* ── LogRow ───────────────────────────────────────────────────── */

function LogRow({ entry }: { entry: ParsedLogEntry }) {
  const [open, setOpen] = useState(false)
  const lvl = LEVEL_STYLE[entry.level] ?? LEVEL_STYLE.debug
  const isLong = entry.message.length > 100

  return (
    <div
      style={{
        borderBottom: "1px solid var(--separator)",
        background:
          entry.level === "error" ? "rgba(255,69,58,0.03)" : undefined,
      }}
    >
      <button
        onClick={() => isLong && setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "5px 12px",
          gap: 8,
          border: "none",
          background: "transparent",
          cursor: isLong ? "pointer" : "default",
          textAlign: "left",
        }}
      >
        {/* Expand chevron */}
        {isLong ? (
          <span
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              flexShrink: 0,
              transition: "transform 150ms var(--ease-smooth)",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              display: "inline-block",
            }}
          >
            &#8250;
          </span>
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}

        {/* Time */}
        <span
          className="font-mono"
          style={{
            color: "var(--text-tertiary)",
            fontSize: 10,
            flexShrink: 0,
            minWidth: 58,
          }}
        >
          {formatTime(entry.timestamp)}
        </span>

        {/* Level pill */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.5px",
            padding: "1px 5px",
            borderRadius: 3,
            background: lvl.bg,
            color: lvl.color,
            flexShrink: 0,
            lineHeight: "14px",
          }}
        >
          {lvl.label}
        </span>

        {/* Message (truncated) */}
        <span
          className="font-mono"
          style={{
            color:
              entry.level === "error"
                ? "var(--system-red)"
                : "var(--text-secondary)",
            fontSize: 10,
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {entry.message}
        </span>
      </button>

      {/* Expanded detail */}
      {open && isLong && (
        <div
          style={{
            padding: "6px 12px 8px 30px",
            borderTop: "1px solid var(--separator)",
            background: "var(--fill-secondary)",
          }}
        >
          <pre
            className="font-mono"
            style={{
              fontSize: 9,
              lineHeight: 1.5,
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}
          >
            {entry.message}
          </pre>
        </div>
      )}
    </div>
  )
}

/* ── Component ────────────────────────────────────────────────── */

export function LiveStreamWidget() {
  const [state, setState] = useState<WidgetState>("hidden")
  const [entries, setEntries] = useState<ParsedLogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const logIndexRef = useRef(0)

  const { events } = useGateway()

  /* ── Auto-scroll ──────────────────────────────────────────── */

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, autoScroll])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    if (!atBottom) setAutoScroll(false)
    else setAutoScroll(true)
  }, [])

  /* ── Fetch initial logs when expanded ─────────────────────── */

  useEffect(() => {
    if (state !== "expanded") return
    api
      .getLogs(50)
      .then((data) => {
        const parsed = (data.lines ?? []).map(parseLogLine)
        setEntries(parsed)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load logs")
      })
  }, [state])

  /* ── Listen for WebSocket events ──────────────────────────── */

  useEffect(() => {
    if (state === "hidden" || events.length === 0) return
    const latest = events[events.length - 1]
    if (latest.event === "log" && typeof latest.payload === "object" && latest.payload !== null) {
      const p = latest.payload as Record<string, unknown>
      const line = (p.line as string) || (p.message as string) || JSON.stringify(latest.payload)
      const newEntry = parseLogLine(line, logIndexRef.current++)
      setEntries((prev) => [...prev, newEntry].slice(-MAX_LINES))
    }
  }, [events, state])

  /* ── Actions ──────────────────────────────────────────────── */

  const handleClose = useCallback(() => {
    setState("hidden")
  }, [])

  const handleCopy = useCallback(async () => {
    const text = entries.map(formatCopyLine).join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [entries])

  /* ── DOM event listener ───────────────────────────────────── */

  useEffect(() => {
    function onOpen() {
      setState("expanded")
    }
    window.addEventListener(WIDGET_EVENT, onOpen)
    return () => window.removeEventListener(WIDGET_EVENT, onOpen)
  }, [])

  /* ── Hidden ───────────────────────────────────────────────── */

  if (state === "hidden") return null

  /* ── Collapsed pill ───────────────────────────────────────── */

  if (state === "collapsed") {
    return (
      <button
        onClick={() => setState("expanded")}
        className="focus-ring flex items-center"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 50,
          padding: "8px 14px",
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--separator)",
          background: "var(--material-regular)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          cursor: "pointer",
          gap: 8,
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--system-green)",
            animation: "lsw-pulse 2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "var(--text-caption1)",
            color: "var(--text-secondary)",
            fontWeight: "var(--weight-medium)",
          }}
        >
          Live Stream
        </span>
        {entries.length > 0 && (
          <span
            style={{
              fontSize: "var(--text-caption2)",
              color: "var(--text-tertiary)",
              background: "var(--fill-secondary)",
              padding: "1px 6px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {entries.length}
          </span>
        )}
        <style>{`@keyframes lsw-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </button>
    )
  }

  /* ── Expanded panel ───────────────────────────────────────── */

  return (
    <div
      className="panel-slide-in"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 50,
        width: 440,
        height: 400,
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--separator)",
        background: "var(--material-regular)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--separator)",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--system-green)",
            animation: "lsw-pulse 2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "var(--text-footnote)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-primary)",
          }}
        >
          Live Stream
        </span>
        {entries.length > 0 && (
          <span
            style={{
              fontSize: "var(--text-caption2)",
              color: "var(--text-tertiary)",
            }}
          >
            {entries.length} line{entries.length !== 1 ? "s" : ""}
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button
            onClick={handleCopy}
            className="focus-ring"
            title="Copy all logs"
            disabled={entries.length === 0}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: copied ? "var(--accent-fill)" : "transparent",
              color: copied ? "var(--accent)" : "var(--text-tertiary)",
              cursor: entries.length === 0 ? "default" : "pointer",
              opacity: entries.length === 0 ? 0.3 : 1,
              transition: "all 150ms var(--ease-smooth)",
            }}
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => setState("collapsed")}
            className="focus-ring"
            title="Minimize"
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              transition: "color 150ms var(--ease-smooth)",
            }}
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={handleClose}
            className="focus-ring"
            title="Close"
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              transition: "color 150ms var(--ease-smooth)",
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: "6px 14px",
            background: "rgba(255,69,58,0.06)",
            borderBottom: "1px solid rgba(255,69,58,0.15)",
            fontSize: "var(--text-caption2)",
            color: "var(--system-red)",
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* Log area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {entries.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center"
            style={{
              height: "100%",
              color: "var(--text-secondary)",
              gap: "var(--space-2)",
              padding: "var(--space-4)",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--text-tertiary)" }}
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span
              style={{
                fontSize: "var(--text-caption1)",
                fontWeight: "var(--weight-medium)",
              }}
            >
              Waiting for log data...
            </span>
          </div>
        ) : (
          <div>
            {entries.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--separator)",
          gap: 8,
        }}
      >
        {!autoScroll && entries.length > 0 && (
          <button
            onClick={() => setAutoScroll(true)}
            className="focus-ring"
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--text-caption2)",
              fontWeight: "var(--weight-medium)",
              background: "var(--fill-secondary)",
              color: "var(--text-secondary)",
            }}
          >
            Scroll to bottom
          </button>
        )}
      </div>

      <style>{`@keyframes lsw-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}

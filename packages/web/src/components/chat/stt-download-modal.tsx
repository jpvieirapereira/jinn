"use client"
import React from "react"

interface SttDownloadModalProps {
  open: boolean
  progress: number | null
  onDownload: () => void
  onCancel: () => void
}

export function SttDownloadModal({ open, progress, onDownload, onCancel }: SttDownloadModalProps) {
  if (!open) return null

  const isDownloading = progress !== null

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={isDownloading ? undefined : onCancel}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-6)",
          maxWidth: 400,
          width: "90%",
          boxShadow: "var(--shadow-overlay)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: 48,
          height: 48,
          borderRadius: "var(--radius-md)",
          background: "var(--fill-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "var(--space-4)",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>

        <h3 style={{
          fontSize: "var(--text-headline)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
          marginBottom: "var(--space-2)",
        }}>
          Enable voice input?
        </h3>

        <p style={{
          fontSize: "var(--text-body)",
          color: "var(--text-secondary)",
          marginBottom: "var(--space-5)",
          lineHeight: "var(--leading-relaxed)",
        }}>
          This will download a speech recognition model (~500MB). Transcription runs locally on your server — no data leaves your network.
        </p>

        {isDownloading && (
          <div style={{ marginBottom: "var(--space-5)" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "var(--space-2)",
              fontSize: "var(--text-footnote)",
              color: "var(--text-tertiary)",
            }}>
              <span>Downloading model…</span>
              <span>{progress}%</span>
            </div>
            <div style={{
              height: 6,
              borderRadius: 3,
              background: "var(--fill-tertiary)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                borderRadius: 3,
                background: "var(--accent)",
                transition: "width 300ms ease",
              }} />
            </div>
          </div>
        )}

        <div style={{
          display: "flex",
          gap: "var(--space-3)",
          justifyContent: "flex-end",
        }}>
          {!isDownloading && (
            <button
              onClick={onCancel}
              style={{
                padding: "var(--space-2) var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: "var(--fill-tertiary)",
                color: "var(--text-primary)",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--text-body)",
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={onDownload}
            disabled={isDownloading}
            style={{
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-md)",
              background: isDownloading ? "var(--fill-tertiary)" : "var(--accent)",
              color: isDownloading ? "var(--text-tertiary)" : "#000",
              border: "none",
              cursor: isDownloading ? "default" : "pointer",
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
            }}
          >
            {isDownloading ? "Downloading…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  )
}

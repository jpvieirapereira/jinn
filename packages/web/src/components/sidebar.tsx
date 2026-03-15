"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Sun,
  Moon,
  Palette,
} from "lucide-react"
import { useTheme } from "@/app/providers"
import { useSettings } from "@/app/settings-provider"
import { THEMES } from "@/lib/themes"
import { NAV_ITEMS } from "@/lib/nav"
import type { ThemeId } from "@/lib/themes"

// ---------------------------------------------------------------------------
// Theme icon helper
// ---------------------------------------------------------------------------

function ThemeIcon({ theme }: { theme: ThemeId }) {
  switch (theme) {
    case "light":
      return <Sun size={18} />
    case "dark":
      return <Moon size={18} />
    default:
      return <Palette size={18} />
  }
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { settings } = useSettings()
  const [hovered, setHovered] = useState(false)

  const emoji = settings.portalEmoji ?? "\u{1F916}"
  const portalName = settings.portalName ?? "Jinn"

  function cycleTheme() {
    const ids = THEMES.map((t) => t.id)
    const idx = ids.indexOf(theme)
    const next = ids[(idx + 1) % ids.length]
    setTheme(next)
  }

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: hovered ? 200 : 56,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--separator)",
        flexDirection: "column",
        zIndex: 50,
        transition: "width 200ms var(--ease-smooth)",
        overflow: "hidden",
      }}
      className="hidden lg:flex"
    >
      {/* App icon + title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 14px 12px",
          minHeight: 56,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 24,
            lineHeight: 1,
            flexShrink: 0,
            width: 28,
            textAlign: "center",
          }}
        >
          {emoji}
        </span>
        <span
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            opacity: hovered ? 1 : 0,
            transition: "opacity 200ms var(--ease-smooth)",
          }}
        >
          {portalName}
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item"
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                height: 40,
                padding: "0 12px",
                textDecoration: "none",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: isActive ? "var(--accent-fill)" : "transparent",
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              <Icon
                size={18}
                style={{
                  flexShrink: 0,
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                }}
              />
              <span
                style={{
                  opacity: hovered ? 1 : 0,
                  transition: "opacity 200ms var(--ease-smooth)",
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Theme toggle at bottom */}
      <div style={{ padding: "8px 8px 12px", flexShrink: 0 }}>
        <button
          onClick={cycleTheme}
          className="nav-item"
          aria-label={`Theme: ${theme}. Click to cycle.`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 40,
            padding: "0 12px",
            width: "100%",
            border: "none",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ flexShrink: 0 }}>
            <ThemeIcon theme={theme} />
          </span>
          <span
            style={{
              opacity: hovered ? 1 : 0,
              transition: "opacity 200ms var(--ease-smooth)",
              textTransform: "capitalize",
            }}
          >
            {theme}
          </span>
        </button>
      </div>
    </aside>
  )
}

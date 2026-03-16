# Command Center — Design Spec

**Date**: 2026-03-16
**Status**: Draft
**Author**: Jimbo + Hristo (brainstorm)
**Scope**: New top-level page in Jinn web UI for project-centric operational focus

## Problem

The current chat sidebar is a flat chronological list of 172+ sessions grouped by Direct/Employee/Cron. As sessions accumulate from web conversations, cron jobs, Slack, and employee delegations, the list becomes overwhelming. There is no concept of "projects," no priority system, no way to distinguish what needs attention from noise. The COO (Jimbo) handles complexity behind the scenes, but Hristo still needs a way to see what matters at a glance and act on it.

## Solution

A new **Command Center** page (`/command`) with three complementary views — Graph, Dashboard, and Timeline — organized around **projects** (not employees or sources). A per-session attention and priority system ensures only what matters surfaces. A smart decay filter hides old noise automatically.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Views | 3 tabs: Graph, Dashboard, Timeline | Each serves a different mental mode: spatial overview, operational detail, temporal context |
| Organization | Flexible project tags | Sessions can belong to multiple projects; projects are user-defined, not locked to departments |
| Session → Project mapping | Auto-tag (employee dept + parent/child inheritance + keyword inference) + manual override | Covers COO sessions that are cross-cutting; manual override as escape hatch |
| Time management | Smart decay with adjustable filter | Auto-hides old sessions; attention-required items always visible |
| Attention system | Per-session `attentionRequired` flag + `priority` (urgent/normal/low) + auto-escalation on errors | Cron jobs set attention at definition time; COO sets it at delegation time; user can always toggle |
| Graph library | React Flow | Handles drag/zoom/persist/animated-edges out of the box; ~45KB bundle |
| Dashboard & Timeline | Custom React components (CSS Grid) | Simple enough to not need libraries; full control over rendering |
| Click-through | Slide-over panel (mini-Kanban + filtered session list) → click session → `/chat` | Keeps you in Command Center while drilling down |
| Location | Separate top-level page, not replacing /chat | /chat keeps its sidebar for direct conversations; Command Center is for operational overview |
| Kanban replacement | Per-project mini-Kanban in slide-over replaces /kanban | Old /kanban was disconnected from sessions and too granular |

## Data Model

### Project

```typescript
interface Project {
  id: string              // e.g. "pravko", "homy", "tax-tool"
  name: string            // "Pravko", "Homy", "Tax Declaration Tool"
  color: string           // hex color for graph node + badges
  icon?: string           // emoji or icon identifier
  parentId?: string       // optional nesting (e.g. "tax-tool" → parent "pravko")
  archived?: boolean      // hidden from views but data preserved
  createdAt: string       // ISO timestamp
  updatedAt: string       // ISO timestamp
}
```

### Task

```typescript
interface Task {
  id: string
  projectId: string               // belongs to a project
  title: string                   // "Localize blog to German"
  status: 'todo' | 'in_progress' | 'done' | 'blocked'
  priority: 'urgent' | 'normal' | 'low'
  sessionIds: string[]            // linked sessions that work on this task
  attentionRequired: boolean      // bubbles up from linked sessions or set manually
  createdAt: string
  updatedAt: string
}
```

### Session Extensions

Three new fields on the existing Session model:

```typescript
interface Session {
  // ...existing fields
  projects: string[]                                    // NEW — flexible project tag IDs
  attentionRequired: boolean                            // NEW — does this need Hristo's eyes?
  priority: 'urgent' | 'normal' | 'low' | null         // NEW — manual priority override
}
```

### Cron Job Extensions

Two new fields in `jobs.json` entries:

```typescript
interface CronJob {
  // ...existing fields
  attentionRequired: boolean         // NEW — inherited by spawned sessions
  defaultPriority: 'urgent' | 'normal' | 'low' | null  // NEW — inherited by spawned sessions
}
```

### Auto-Tagging Logic

Runs on session create/update via a `project-tagger` module:

1. If session has manual project tags → skip (manual takes precedence)
2. Look up `session.employee` → find employee's department in org registry → map department to project
3. Check parent session's project tags → inherit
4. Check child sessions' project tags → inherit (reverse: COO session gets tagged from its children)
5. Scan `session.title` for known project name keywords → auto-tag matches
6. If no match after all steps → tag as `"general"` (the catch-all Inbox project)

Priority: manual > child inheritance > parent inheritance > employee dept > keyword inference

## Views

### 1. Graph View (React Flow)

A living, spatial map of the operation. Each project is an interactive node.

**Nodes:**
- Shape: Rounded rectangle with project color as border/accent
- Content: Project icon + name, compact status line ("2 active · 1 blocked · 3 attention")
- Size: Scales with activity volume (more active sessions = larger node)
- Animations:
  - Pulsing orange glow: any session has `attentionRequired: true`
  - Red glow: any session has `status: error`
  - Spinning ring: any session is `status: running`
  - Dim/faded: all sessions completed/idle and within decay range (node stays as landmark)
- Special: "General/Inbox" node has dashed border to distinguish from real projects

**Edges:**
- Connect projects that share sessions (a session tagged both "Pravko" and "Tax Tool" creates an edge)
- Animated dash when a shared session is running
- Thickness proportional to number of shared sessions
- Color inherits from the more active project

**Interaction:**
- Drag nodes to arrange spatially — positions persist in localStorage (`jinn-graph-positions`)
- Zoom/pan with scroll wheel and trackpad (React Flow built-in)
- Click node → opens slide-over panel (tasks + filtered sessions)
- Hover node → tooltip with full breakdown (sessions by status, task summary)
- Minimap in bottom-right corner

**Attention counter:** Floating badge in top-left of graph showing total attention-required items across all projects.

### 2. Dashboard View (Custom CSS Grid)

Operational card grid — one card per project.

**Project cards:**
- Header: Project icon + name + color accent strip
- Status indicators: Small dots/badges — running (blue pulse), errors (red), attention (orange)
- Task summary: Compact line — "3 todo · 2 in progress · 1 blocked"
- Recent activity: Last 2-3 session titles with relative timestamps
- Priority badge: If any task/session is `urgent`, card gets priority border/glow

**Layout:**
- Responsive CSS grid: 1 col mobile, 2 col tablet, 3-4 col desktop
- Sort order: Attention-required cards float to top → most recent activity → idle/empty sink to bottom
- "General/Inbox" card: Always last unless it has attention items; styled with dashed border

**Click behavior:** Same as graph — slide-over panel.

**Empty state:** "All quiet. Adjust the time filter to see older sessions."

### 3. Timeline View (Custom CSS Grid)

Temporal perspective — what happened when, across all projects.

**Layout:**
- Y-axis: Swimlanes — one horizontal lane per project, labeled on left with icon + name
- X-axis: Time — scrollable, with zoom levels (hours / days / weeks)
- Lane ordering: Attention-required projects at top, then by most recent activity

**Session bars:**
- Horizontal bar spanning `createdAt` to `lastActivity` (or "now" if running)
- Color by status: blue (running), green (completed), red (error), gray (idle)
- Attention marker: Orange diamond on bar if `attentionRequired: true`
- Priority: Urgent sessions get thicker bar + subtle glow
- Hover: Tooltip with session title, employee, status, duration

**Task overlays:**
- Translucent overlay bars spanning across linked sessions' time range
- Shows workstream duration visually (e.g. "German localization lasted Mon–Wed, 3 sessions")

**Interaction:**
- Scroll horizontally to move through time
- Zoom with pinch/scroll to switch hour/day/week granularity
- Click session bar → navigates to `/chat?session=<id>`
- Click task overlay → opens slide-over panel with task detail
- "Now" marker: Vertical red line at current time, auto-scrolled to on load

**Smart decay:** Older sessions fade in opacity. Outside filter window, lanes collapse to just the project label.

## Slide-Over Panel (Project Detail)

Opens from right on project click in any view. 40% width desktop, full width mobile.

**Header:** Project icon + name + color accent + close button + action buttons (edit, archive, delete)

**Mini-Kanban (top half):**
- 4 columns: Todo | In Progress | Done | Blocked
- Task cards: title, priority badge, linked session count, attention indicator
- Drag tasks between columns to update status
- Click task → expands to show linked sessions inline
- "+ Add Task" button in Todo column

**Filtered Session List (bottom half):**
- Only this project's sessions
- Sort: attention-required → running → errors → recent idle
- Each row: status dot, title/employee, relative time, priority badge, attention toggle
- Right-click context menu: set priority, toggle attention, remove from project, delete
- Click session → navigates to `/chat?session=<id>`

## Smart Decay Filter

Global adjustable filter, persisted in localStorage (`jinn-decay-filter`):

```typescript
interface DecayFilter {
  showCompleted: '24h' | '3d' | '7d' | '30d' | 'all'    // default: '3d'
  showIdle: '3d' | '7d' | '30d' | 'all'                  // default: '7d'
  showErrors: '7d' | '30d' | 'all'                        // default: 'all'
  showRunning: 'always'                                    // always visible
  showAttentionRequired: 'always'                          // always visible
}
```

Key rule: Anything with `attentionRequired: true` or `priority: 'urgent'` is **always visible** regardless of decay settings.

UI: Dropdown or popover in the Command Center top bar, right-aligned. Quick presets ("Last 24h", "Last week", "Everything") plus granular controls.

## Attention & Priority Rendering

| Signal | Graph | Dashboard | Timeline |
|--------|-------|-----------|----------|
| Urgent | Node throbs with accent glow | Card gets priority border, floats to top | Thicker bar + glow |
| Attention required | Node pulses orange | Orange badge on card | Orange diamond marker |
| Error | Red glow on node | Red badge | Red bar |
| Running | Spinning ring on node | Blue pulse dot | Blue bar with animated edge |
| Low priority | Normal / slightly dimmed | Normal, sinks in sort order | Thinner bar |
| Silent (no attention) | Present, no animation | Normal card, sorted by recency | Normal bar |

## API Endpoints

### Projects

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/projects` | GET | — | `Project[]` |
| `/api/projects` | POST | `{name, color, icon?, parentId?}` | `Project` |
| `/api/projects/:id` | PUT | `{name?, color?, icon?, parentId?, archived?}` | `Project` |
| `/api/projects/:id` | DELETE | — | `204` |

### Tasks

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/projects/:id/tasks` | GET | — | `Task[]` |
| `/api/projects/:id/tasks` | POST | `{title, priority?, sessionIds?}` | `Task` |
| `/api/tasks/:id` | PUT | `{title?, status?, priority?, sessionIds?, attentionRequired?}` | `Task` |
| `/api/tasks/:id` | DELETE | — | `204` |

### Session Extensions

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/sessions/:id` | PATCH | `{projects?, priority?, attentionRequired?}` | `Session` |

### WebSocket Events

New events for real-time Command Center updates:
- `project:created`, `project:updated`, `project:deleted`
- `task:created`, `task:updated`, `task:deleted`
- `session:priority-changed`, `session:attention-changed`

## Storage

| Data | Storage | Rationale |
|------|---------|-----------|
| Projects | Server-side (JSON or SQLite) | Shared truth, survives browser clear |
| Tasks | Server-side (same store) | Linked to sessions server-side |
| Graph node positions | localStorage `jinn-graph-positions` | Per-user visual preference |
| Decay filter settings | localStorage `jinn-decay-filter` | Per-user preference |
| Active tab | localStorage `jinn-command-tab` | Remember last view |
| Collapsed swimlanes | localStorage `jinn-timeline-collapsed` | Per-user preference |

## Navigation Changes

- New nav item: `{ href: "/command", label: "Command Center", icon: Radar }` — positioned second (after Home)
- Attention badge on nav icon: red pill with count of `attentionRequired` sessions
- Remove `/kanban` from nav (replaced by per-project Kanban in Command Center)
- `/sessions` page stays as lower-level admin view
- `/chat` page keeps its existing sidebar unchanged

## Technology

- **Graph**: React Flow (MIT, ~45KB) — handles drag, zoom, minimap, animated edges, custom nodes, persistent positions
- **Dashboard**: Custom React + CSS Grid
- **Timeline**: Custom React + CSS Grid with horizontal scroll/zoom
- **Slide-over panel**: Custom React component with Framer Motion or CSS transitions
- **State management**: React hooks + SWR or similar for server state (follows existing patterns in the codebase)

## Out of Scope

- Replacing the /chat page or its sidebar
- Mobile-first optimization (desktop-first, responsive as secondary concern)
- Collaborative multi-user features
- External integrations (Slack notifications for attention items — future enhancement)
- AI-powered auto-prioritization (future enhancement)

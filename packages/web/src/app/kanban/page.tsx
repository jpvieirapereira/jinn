"use client"

import { useEffect, useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { api } from '@/lib/api'
import type { Employee, OrgData } from '@/lib/api'
import type { KanbanTicket, TicketStatus, TicketPriority } from '@/lib/kanban/types'
import {
  loadTickets,
  saveTickets,
  createTicket,
  updateTicket,
  moveTicket,
  deleteTicket,
  type KanbanStore,
} from '@/lib/kanban/store'
import { PageLayout } from '@/components/page-layout'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { CreateTicketModal } from '@/components/kanban/create-ticket-modal'
import { TicketDetailPanel } from '@/components/kanban/ticket-detail-panel'

/** Delete confirmation dialog */
function DeleteConfirmDialog({
  ticket,
  onConfirm,
  onCancel,
}: {
  ticket: KanbanTicket
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent
        showCloseButton={false}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--separator)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          maxWidth: 400,
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontSize: 'var(--text-title3)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
            }}
          >
            Delete Ticket
          </DialogTitle>
          <DialogDescription
            style={{
              fontSize: 'var(--text-footnote)',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            Are you sure you want to delete &ldquo;{ticket.title}&rdquo;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            onClick={onCancel}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--separator)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-footnote)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--system-red)',
              color: '#fff',
              fontSize: 'var(--text-footnote)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function KanbanPage() {
  const [tickets, setTickets] = useState<KanbanStore>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<KanbanTicket | null>(null)
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<KanbanTicket | null>(null)

  /** Sync tickets to the gateway API, grouped by department */
  const syncToApi = useCallback(async (store: KanbanStore) => {
    // Group tickets by department
    const byDept: Record<string, Array<{
      id: string
      title: string
      description?: string
      status: string
      priority: string
      assignee?: string
      createdAt: string
      updatedAt: string
    }>> = {}

    for (const ticket of Object.values(store)) {
      const dept = ticket.department
      if (!dept) continue
      if (!byDept[dept]) byDept[dept] = []
      byDept[dept].push({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description || undefined,
        status: ticket.status,
        priority: ticket.priority,
        assignee: ticket.assigneeId || undefined,
        createdAt: new Date(ticket.createdAt).toISOString(),
        updatedAt: new Date(ticket.updatedAt).toISOString(),
      })
    }

    // PUT each department's board (including empty arrays to clear deleted tickets)
    const allDepts = new Set([...Object.keys(byDept), ...departments])
    const promises = Array.from(allDepts).map(async (dept) => {
      try {
        await api.updateDepartmentBoard(dept, byDept[dept] || [])
      } catch {
        // API unavailable — localStorage is the fallback
      }
    })

    await Promise.all(promises)
  }, [departments])

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)

    // Load employees from API, then load board data from department boards
    api
      .getOrg()
      .then(async (data: OrgData) => {
        const details = await Promise.all(
          data.employees.map(async (name) => {
            try {
              return await api.getEmployee(name)
            } catch {
              return {
                name,
                displayName: name,
                department: '',
                rank: 'employee' as const,
                engine: 'unknown',
                model: 'unknown',
                persona: '',
              }
            }
          }),
        )
        setEmployees(details)
        setDepartments(data.departments)

        // Load board tickets from all departments
        const boardTickets: KanbanStore = {}
        for (const dept of data.departments) {
          try {
            const board = await api.getDepartmentBoard(dept) as unknown as Array<{
              id: string
              title: string
              description?: string
              status: string
              priority?: string
              assignee?: string
              createdAt?: string
              updatedAt?: string
            }>
            if (Array.isArray(board)) {
              for (const item of board) {
                // Map board.json status to kanban statuses
                const statusMap: Record<string, TicketStatus> = {
                  todo: 'todo',
                  'in_progress': 'in-progress',
                  'in-progress': 'in-progress',
                  done: 'done',
                  backlog: 'backlog',
                  review: 'review',
                }
                const status = statusMap[item.status] || 'todo'
                const priorityMap: Record<string, TicketPriority> = {
                  low: 'low',
                  medium: 'medium',
                  high: 'high',
                }
                const priority = priorityMap[item.priority || 'medium'] || 'medium'
                boardTickets[item.id] = {
                  id: item.id,
                  title: item.title,
                  description: item.description || '',
                  status,
                  priority,
                  assigneeId: item.assignee || null,
                  department: dept,
                  workState: 'idle',
                  createdAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
                  updatedAt: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now(),
                }
              }
            }
          } catch {
            // Department may not have a board.json, that's fine
          }
        }

        // Merge: API board data takes precedence, then localStorage for any extras
        const localTickets = loadTickets()
        setTickets({ ...localTickets, ...boardTickets })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Persist tickets whenever they change
  useEffect(() => {
    if (!loading) {
      saveTickets(tickets)
    }
  }, [tickets, loading])

  // Keep selectedTicket in sync with store
  useEffect(() => {
    if (selectedTicket && tickets[selectedTicket.id]) {
      const current = tickets[selectedTicket.id]
      if (current.updatedAt !== selectedTicket.updatedAt) {
        setSelectedTicket(current)
      }
    }
  }, [tickets, selectedTicket])

  function handleCreateTicket(data: {
    title: string
    description: string
    priority: TicketPriority
    assigneeId: string | null
  }) {
    // Infer department from assignee, fallback to 'platform'
    const emp = data.assigneeId ? employees.find(e => e.name === data.assigneeId) : null
    const department = emp?.department || departments[0] || 'platform'

    setTickets((prev) => {
      const next = createTicket(prev, {
        ...data,
        status: 'backlog',
        department,
      })
      syncToApi(next)
      return next
    })
  }

  function handleMoveTicket(ticketId: string, status: TicketStatus) {
    setTickets((prev) => {
      const next = moveTicket(prev, ticketId, status)
      syncToApi(next)
      return next
    })
  }

  function handleDeleteTicket(ticketId: string) {
    setTickets((prev) => {
      const next = deleteTicket(prev, ticketId)
      syncToApi(next)
      return next
    })
    setSelectedTicket(null)
    setDeleteConfirm(null)
  }

  function handleAssigneeChange(ticketId: string, assigneeId: string | null) {
    // Update department when assignee changes
    const emp = assigneeId ? employees.find(e => e.name === assigneeId) : null
    const updates: Partial<Omit<KanbanTicket, 'id' | 'createdAt'>> = { assigneeId }
    if (emp?.department) {
      updates.department = emp.department
    }
    setTickets((prev) => {
      const next = updateTicket(prev, ticketId, updates)
      syncToApi(next)
      return next
    })
  }

  function handleTicketClick(ticket: KanbanTicket) {
    setSelectedTicket(ticket)
  }

  if (error) {
    return (
      <PageLayout>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 'var(--space-4)',
            color: 'var(--text-tertiary)',
          }}
        >
          <div
            style={{
              borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--system-red) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--system-red) 30%, transparent)',
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--text-body)',
              color: 'var(--system-red)',
            }}
          >
            Failed to load employees: {error}
          </div>
          <button
            onClick={loadData}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-body)',
              fontWeight: 'var(--weight-semibold)',
            }}
          >
            Retry
          </button>
        </div>
      </PageLayout>
    )
  }

  const ticketCount = Object.keys(tickets).length

  // Employees that have at least one ticket assigned
  const assignedEmployeeNames = new Set(
    Object.values(tickets)
      .map((t) => t.assigneeId)
      .filter(Boolean),
  )
  const assignedEmployees = employees.filter((e) => assignedEmployeeNames.has(e.name))

  return (
    <PageLayout>
      <div className="flex h-full relative" style={{ background: 'var(--bg)' }}>
        {/* Board area */}
        <div className="flex-1 h-full flex flex-col" style={{ minWidth: 0 }}>
          {/* Header */}
          <div
            style={{
              padding: 'var(--space-4) var(--space-5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              borderBottom: '1px solid var(--separator)',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 'var(--text-title2)',
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.3px',
                }}
              >
                Kanban Board
              </h1>
              <p
                style={{
                  fontSize: 'var(--text-caption1)',
                  color: 'var(--text-tertiary)',
                  margin: '2px 0 0',
                }}
              >
                {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
              </p>
            </div>

            <button
              onClick={() => setCreateOpen(true)}
              style={{
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                fontSize: 'var(--text-footnote)',
                fontWeight: 'var(--weight-semibold)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                background: 'var(--accent)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              New Ticket
            </button>
          </div>

          {/* Employee filter bar */}
          {assignedEmployees.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-5)',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setFilterEmployeeId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontSize: 'var(--text-caption1)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterEmployeeId === null ? 'var(--accent)' : 'var(--fill-tertiary)',
                  color: filterEmployeeId === null ? 'white' : 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >
                All
              </button>
              {assignedEmployees.map((emp) => (
                <button
                  key={emp.name}
                  onClick={() =>
                    setFilterEmployeeId(filterEmployeeId === emp.name ? null : emp.name)
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    fontSize: 'var(--text-caption1)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background:
                      filterEmployeeId === emp.name
                        ? 'var(--accent)'
                        : 'var(--fill-tertiary)',
                    color:
                      filterEmployeeId === emp.name
                        ? 'white'
                        : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  {emp.displayName}
                </button>
              ))}
            </div>
          )}

          {/* Board */}
          <div style={{ flex: 1, padding: '0 var(--space-3)', minHeight: 0 }}>
            {loading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-tertiary)',
                  fontSize: 'var(--text-caption1)',
                }}
              >
                Loading...
              </div>
            ) : (
              <KanbanBoard
                tickets={tickets}
                employees={employees}
                onTicketClick={handleTicketClick}
                onMoveTicket={handleMoveTicket}
                onCreateTicket={() => setCreateOpen(true)}
                onDeleteTicket={(ticket) => setDeleteConfirm(ticket)}
                filterEmployeeId={filterEmployeeId}
              />
            )}
          </div>
        </div>

        {/* Mobile backdrop */}
        {selectedTicket && (
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSelectedTicket(null)}
          />
        )}

        {/* Detail panel */}
        {selectedTicket && (
          <TicketDetailPanel
            ticket={selectedTicket}
            employees={employees}
            onClose={() => setSelectedTicket(null)}
            onStatusChange={(status) => handleMoveTicket(selectedTicket.id, status)}
            onAssigneeChange={(name) => handleAssigneeChange(selectedTicket.id, name)}
            onDelete={() => setDeleteConfirm(selectedTicket)}
          />
        )}

        {/* Delete confirmation dialog */}
        {deleteConfirm && (
          <DeleteConfirmDialog
            ticket={deleteConfirm}
            onConfirm={() => handleDeleteTicket(deleteConfirm.id)}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}

        {/* Create ticket modal */}
        <CreateTicketModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          employees={employees}
          onSubmit={handleCreateTicket}
        />
      </div>
    </PageLayout>
  )
}

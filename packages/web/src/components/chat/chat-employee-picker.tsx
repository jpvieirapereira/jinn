"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { EmployeeAvatar } from '@/components/ui/employee-avatar'
import { cn } from '@/lib/utils'
import type { Employee } from '@/lib/api'

type PickerEmployee = Pick<Employee, 'name' | 'displayName' | 'department' | 'rank'>

interface ChatEmployeePickerProps {
  employees: PickerEmployee[]
  selectedEmployee: string | null
  onSelect: (employeeName: string | null) => void
  portalName: string
}

const RANK_LABELS: Record<string, string> = {
  executive: 'Exec',
  manager: 'Mgr',
  senior: 'Sr',
  employee: '',
}

export function ChatEmployeePicker({
  employees,
  selectedEmployee,
  onSelect,
  portalName,
}: ChatEmployeePickerProps) {
  const [search, setSearch] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(-1) // -1 = COO
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Filter employees by search query
  const filtered = useMemo(() => {
    if (!search.trim()) return employees
    const q = search.toLowerCase()
    return employees.filter(
      e =>
        e.name.toLowerCase().includes(q) ||
        e.displayName.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    )
  }, [employees, search])

  // Group filtered employees by department (preserving insertion order)
  const groups = useMemo(() => {
    const map = new Map<string, PickerEmployee[]>()
    for (const emp of filtered) {
      const dept = emp.department || 'other'
      if (!map.has(dept)) map.set(dept, [])
      map.get(dept)!.push(emp)
    }
    return map
  }, [filtered])

  // Flat list of filtered employees for keyboard navigation
  const flatList = useMemo(() => {
    const result: PickerEmployee[] = []
    for (const emps of groups.values()) {
      result.push(...emps)
    }
    return result
  }, [groups])

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightIdx(-1)
  }, [search])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-picker-option]')
    // highlightIdx -1 = COO (index 0 in DOM), employee indices shift by 1
    const domIdx = highlightIdx + 1
    const item = items[domIdx]
    if (item && typeof item.scrollIntoView === 'function') item.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIdx(i => Math.min(i + 1, flatList.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIdx(i => Math.max(i - 1, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (highlightIdx === -1) {
          onSelect(null)
        } else if (flatList[highlightIdx]) {
          onSelect(flatList[highlightIdx].name)
        }
      }
    },
    [highlightIdx, flatList, onSelect]
  )

  return (
    <div className="flex flex-col items-center gap-3 px-4 w-full max-w-md mx-auto">
      <p className="text-sm text-[var(--text-secondary)]">
        Who do you want to talk to?
      </p>

      {/* Search */}
      <div className="w-full">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full py-2 px-3 text-[length:var(--text-footnote)] border border-[var(--separator)] rounded-[var(--radius-md)] bg-[var(--fill-tertiary)] text-[var(--text-primary)] outline-none font-[inherit] placeholder:text-[var(--text-tertiary)]"
        />
      </div>

      {/* Scrollable list */}
      <div
        ref={listRef}
        role="listbox"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="w-full max-h-[360px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--separator)] bg-[var(--fill-quaternary)]"
      >
        {/* COO row — always visible */}
        <div
          role="option"
          aria-selected={selectedEmployee === null}
          aria-label={portalName}
          data-picker-option
          onClick={() => onSelect(null)}
          onMouseEnter={() => setHighlightIdx(-1)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-[var(--separator)]',
            highlightIdx === -1 && 'bg-[var(--fill-secondary)]',
            selectedEmployee === null
              ? 'bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]'
              : ''
          )}
        >
          <span className="text-xl shrink-0">🧞</span>
          <div className="flex-1 min-w-0">
            <span className="text-[length:var(--text-footnote)] font-[var(--weight-semibold)] text-[var(--text-primary)]">
              {portalName}
            </span>
          </div>
          <span className="text-[length:var(--text-caption2)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] rounded-[var(--radius-sm)] px-1.5 py-px font-[var(--weight-medium)] shrink-0">
            COO
          </span>
        </div>

        {/* Department groups */}
        {Array.from(groups.entries()).map(([dept, emps]) => (
          <div key={dept}>
            {/* Department header */}
            <div className="px-3 py-1.5 text-[length:var(--text-caption2)] font-[var(--weight-semibold)] text-[var(--text-tertiary)] uppercase tracking-wider bg-[var(--fill-tertiary)]">
              {dept}
            </div>

            {/* Employee rows */}
            {emps.map(emp => {
              const empIdx = flatList.indexOf(emp)
              const isSelected = selectedEmployee === emp.name
              const isHighlighted = highlightIdx === empIdx

              return (
                <div
                  key={emp.name}
                  role="option"
                  aria-selected={isSelected}
                  data-picker-option
                  onClick={() => onSelect(emp.name)}
                  onMouseEnter={() => setHighlightIdx(empIdx)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
                    isHighlighted && 'bg-[var(--fill-secondary)]',
                    isSelected && 'bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]'
                  )}
                >
                  <EmployeeAvatar name={emp.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[length:var(--text-footnote)] font-[var(--weight-medium)] text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap block">
                      {emp.displayName}
                    </span>
                  </div>
                  {RANK_LABELS[emp.rank] && (
                    <span className="text-[length:var(--text-caption2)] text-[var(--text-tertiary)] bg-[var(--fill-secondary)] rounded-[var(--radius-sm)] px-1.5 py-px shrink-0">
                      {RANK_LABELS[emp.rank]}
                    </span>
                  )}
                  {isSelected && (
                    <span className="text-[var(--accent)] text-[13px] shrink-0">&#10003;</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="p-4 text-center text-[length:var(--text-footnote)] text-[var(--text-tertiary)]">
            No employees match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </div>
  )
}

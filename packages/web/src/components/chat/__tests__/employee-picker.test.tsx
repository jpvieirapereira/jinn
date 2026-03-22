import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatEmployeePicker } from '../chat-employee-picker'

// Mock EmployeeAvatar since it depends on settings context
vi.mock('@/components/ui/employee-avatar', () => ({
  EmployeeAvatar: ({ name, size }: { name: string; size?: number }) => (
    <span data-testid={`avatar-${name}`} style={{ width: size, height: size }}>
      {name.charAt(0).toUpperCase()}
    </span>
  ),
}))

const mockEmployees = [
  { name: 'jimmy-dev', displayName: 'Jimmy Dev', department: 'platform', rank: 'senior' as const },
  { name: 'pravko-lead', displayName: 'Pravko Lead', department: 'pravko', rank: 'manager' as const },
  { name: 'pravko-writer', displayName: 'Pravko Writer', department: 'pravko', rank: 'employee' as const },
  { name: 'homy-lead', displayName: 'Homy Lead', department: 'homy', rank: 'manager' as const },
  { name: 'homy-writer', displayName: 'Homy Writer', department: 'homy', rank: 'employee' as const },
  { name: 'sqlnoir-lead', displayName: 'SQLNoir Lead', department: 'sqlnoir', rank: 'manager' as const },
  { name: 'spycam-lead', displayName: 'SpyCam Lead', department: 'spycam', rank: 'manager' as const },
  { name: 'movekit-lead', displayName: 'MoveKit Lead', department: 'movekit', rank: 'senior' as const },
  { name: 'reddit-scout', displayName: 'Reddit Scout', department: 'marketing', rank: 'employee' as const },
]

describe('ChatEmployeePicker', () => {
  let onChange: ReturnType<typeof vi.fn<(name: string | null) => void>>

  beforeEach(() => {
    onChange = vi.fn<(name: string | null) => void>()
  })

  // --- COO rendering ---

  it('renders COO at the top, highlighted as default', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    const cooRow = screen.getByRole('option', { name: /jinn/i })
    expect(cooRow).toBeDefined()
    expect(cooRow.getAttribute('aria-selected')).toBe('true')
  })

  it('calls onSelect(null) when COO row is clicked', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee="jimmy-dev"
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    fireEvent.click(screen.getByRole('option', { name: /jinn/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  // --- Department grouping ---

  it('groups employees by department with section headers', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    // Department headers should be present
    expect(screen.getByText('platform')).toBeDefined()
    expect(screen.getByText('pravko')).toBeDefined()
    expect(screen.getByText('homy')).toBeDefined()
    expect(screen.getByText('sqlnoir')).toBeDefined()
    expect(screen.getByText('marketing')).toBeDefined()
  })

  it('renders employees within their department groups', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    // All employees should be visible (no more/less toggle)
    expect(screen.getByText('Jimmy Dev')).toBeDefined()
    expect(screen.getByText('Pravko Lead')).toBeDefined()
    expect(screen.getByText('Pravko Writer')).toBeDefined()
    expect(screen.getByText('Homy Lead')).toBeDefined()
    expect(screen.getByText('Reddit Scout')).toBeDefined()
  })

  // --- Selection ---

  it('calls onSelect with employee name when row is clicked', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    fireEvent.click(screen.getByText('Jimmy Dev'))
    expect(onChange).toHaveBeenCalledWith('jimmy-dev')
  })

  it('shows selected state on the chosen employee', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee="jimmy-dev"
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    // COO should NOT be selected
    const cooRow = screen.getByRole('option', { name: /jinn/i })
    expect(cooRow.getAttribute('aria-selected')).toBe('false')

    // Jimmy Dev should be selected
    const jimmyRow = screen.getAllByRole('option').find(
      el => el.textContent?.includes('Jimmy Dev')
    )
    expect(jimmyRow).toBeDefined()
    expect(jimmyRow!.getAttribute('aria-selected')).toBe('true')
  })

  // --- Search / filter ---

  it('has a search input that filters employees by name', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    const searchInput = screen.getByPlaceholderText(/search/i)
    expect(searchInput).toBeDefined()

    fireEvent.change(searchInput, { target: { value: 'jimmy' } })
    // Only Jimmy Dev should be visible
    expect(screen.getByText('Jimmy Dev')).toBeDefined()
    expect(screen.queryByText('Pravko Lead')).toBeNull()
    expect(screen.queryByText('Homy Lead')).toBeNull()
  })

  it('filters employees by department name', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'pravko' } })

    // Both pravko employees should be visible
    expect(screen.getByText('Pravko Lead')).toBeDefined()
    expect(screen.getByText('Pravko Writer')).toBeDefined()
    // Others should not
    expect(screen.queryByText('Jimmy Dev')).toBeNull()
  })

  it('shows empty state when search matches nothing', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'zzzzzzz' } })

    expect(screen.getByText(/no employees/i)).toBeDefined()
  })

  it('COO row is always visible regardless of search', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'jimmy' } })

    // COO always visible
    expect(screen.getByRole('option', { name: /jinn/i })).toBeDefined()
  })

  // --- Scrollable container ---

  it('renders a scrollable list container', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeDefined()
    // Should have overflow-y-auto for scrolling
    expect(listbox.className).toContain('overflow-y-auto')
  })

  // --- Rank badges ---

  it('displays rank badges for managers and seniors', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    // Managers get "Mgr" badge, seniors get "Sr"
    const badges = screen.getAllByText(/^(Mgr|Sr)$/)
    expect(badges.length).toBeGreaterThan(0)
  })

  // --- Avatars ---

  it('renders avatars for employees', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees.slice(0, 3)}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    expect(screen.getByTestId('avatar-jimmy-dev')).toBeDefined()
    expect(screen.getByTestId('avatar-pravko-lead')).toBeDefined()
  })

  // --- Keyboard navigation ---

  it('navigates with arrow keys and selects with Enter', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    const listbox = screen.getByRole('listbox')

    // Arrow down once from COO → first employee
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('jimmy-dev')
  })

  it('ArrowUp from first employee goes to COO', () => {
    render(
      <ChatEmployeePicker
        employees={mockEmployees}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    const listbox = screen.getByRole('listbox')

    // Move down then up → back to COO
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'ArrowUp' })
    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  // --- Empty state ---

  it('renders only COO when employees array is empty', () => {
    render(
      <ChatEmployeePicker
        employees={[]}
        selectedEmployee={null}
        onSelect={onChange}
        portalName="Jinn"
      />
    )
    expect(screen.getByRole('option', { name: /jinn/i })).toBeDefined()
    const allOptions = screen.getAllByRole('option')
    expect(allOptions).toHaveLength(1)
  })
})

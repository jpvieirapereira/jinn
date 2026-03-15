"use client";
import React, { useState } from "react";

interface Employee {
  name: string;
  displayName?: string;
  rank?: string;
  engine?: string;
  department?: string;
}

interface OrgData {
  departments: string[];
  employees: Employee[];
}

const rankStyles: Record<string, React.CSSProperties> = {
  executive: { background: 'color-mix(in srgb, var(--system-purple) 15%, transparent)', color: 'var(--system-purple)' },
  manager: { background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' },
  senior: { background: 'color-mix(in srgb, var(--system-green) 15%, transparent)', color: 'var(--system-green)' },
  employee: { background: 'var(--fill-tertiary)', color: 'var(--text-tertiary)' },
};

const engineIcons: Record<string, string> = {
  claude: "C",
  codex: "X",
};

function RankBadge({ rank }: { rank: string }) {
  const style = rankStyles[rank] || rankStyles.employee;
  return (
    <span
      style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 999, ...style }}
    >
      {rank}
    </span>
  );
}

function EngineIcon({ engine }: { engine: string }) {
  return (
    <span
      style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--fill-tertiary)', color: 'var(--text-tertiary)', padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}
    >
      {engineIcons[engine] || engine?.charAt(0)?.toUpperCase() || "?"}
    </span>
  );
}

function EmployeeNode({
  employee,
  selected,
  onSelect,
}: {
  employee: Employee;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(employee.name)}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-subheadline)',
        background: selected ? 'var(--accent-fill)' : 'transparent',
        color: selected ? 'var(--accent)' : 'var(--text-secondary)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 150ms ease, color 150ms ease',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--fill-tertiary)' }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {employee.displayName || employee.name}
      </span>
      {employee.rank && <RankBadge rank={employee.rank} />}
      {employee.engine && <EngineIcon engine={employee.engine} />}
    </button>
  );
}

function DepartmentNode({
  name,
  employees,
  selectedEmployee,
  onSelectEmployee,
  onSelectDepartment,
  selectedDepartment,
}: {
  name: string;
  employees: Employee[];
  selectedEmployee: string | null;
  onSelectEmployee: (name: string) => void;
  onSelectDepartment: (name: string) => void;
  selectedDepartment: string | null;
}) {
  const [expanded, setExpanded] = useState(true);

  const isSelected = selectedDepartment === name;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-quaternary)', fontSize: 12, flexShrink: 0,
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          {expanded ? "\u25BC" : "\u25B6"}
        </button>
        <button
          onClick={() => onSelectDepartment(name)}
          style={{
            flex: 1, textAlign: 'left', padding: '6px 8px', borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-subheadline)', fontWeight: 500,
            background: isSelected ? 'var(--accent-fill)' : 'transparent',
            color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
            border: 'none', cursor: 'pointer', transition: 'background 150ms ease, color 150ms ease',
          }}
          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--fill-tertiary)' }}
          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
        >
          {name}
          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)', marginLeft: 6 }}>
            ({employees.length})
          </span>
        </button>
      </div>
      {expanded && (
        <div style={{ marginLeft: 20, borderLeft: '1px solid var(--separator)', paddingLeft: 8, marginTop: 2 }}>
          {employees.map((emp) => (
            <EmployeeNode
              key={emp.name}
              employee={emp}
              selected={selectedEmployee === emp.name}
              onSelect={onSelectEmployee}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgTree({
  data,
  selectedEmployee,
  selectedDepartment,
  onSelectEmployee,
  onSelectDepartment,
}: {
  data: OrgData;
  selectedEmployee: string | null;
  selectedDepartment: string | null;
  onSelectEmployee: (name: string) => void;
  onSelectDepartment: (name: string) => void;
}) {
  // Group employees by department
  const byDept: Record<string, Employee[]> = {};
  const ungrouped: Employee[] = [];

  for (const emp of data.employees) {
    if (emp.department) {
      if (!byDept[emp.department]) byDept[emp.department] = [];
      byDept[emp.department].push(emp);
    } else {
      ungrouped.push(emp);
    }
  }

  // Include departments from data.departments even if no employees
  for (const dept of data.departments) {
    if (!byDept[dept]) byDept[dept] = [];
  }

  // Find the executive (COO) to show at top
  const executive = data.employees.find(
    (e) => e.rank === "executive",
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {executive && (
        <div style={{ marginBottom: 8 }}>
          <EmployeeNode
            employee={executive}
            selected={selectedEmployee === executive.name}
            onSelect={onSelectEmployee}
          />
        </div>
      )}

      {Object.entries(byDept)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dept, employees]) => (
          <DepartmentNode
            key={dept}
            name={dept}
            employees={employees.filter((e) => e.name !== executive?.name)}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={onSelectEmployee}
            onSelectDepartment={onSelectDepartment}
            selectedDepartment={selectedDepartment}
          />
        ))}

      {ungrouped
        .filter((e) => e.name !== executive?.name)
        .map((emp) => (
          <EmployeeNode
            key={emp.name}
            employee={emp}
            selected={selectedEmployee === emp.name}
            onSelect={onSelectEmployee}
          />
        ))}
    </div>
  );
}

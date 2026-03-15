"use client";
import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Task {
  id?: string;
  title: string;
  assignee?: string;
  priority?: string;
  status: string;
  [key: string]: unknown;
}

interface BoardData {
  name?: string;
  columns?: Record<string, Task[]>;
  tasks?: Task[];
  [key: string]: unknown;
}

const priorityStyles: Record<string, React.CSSProperties> = {
  high: { background: 'color-mix(in srgb, var(--system-red) 12%, transparent)', color: 'var(--system-red)', borderColor: 'color-mix(in srgb, var(--system-red) 25%, transparent)' },
  medium: { background: 'color-mix(in srgb, var(--system-orange) 12%, transparent)', color: 'var(--system-orange)', borderColor: 'color-mix(in srgb, var(--system-orange) 25%, transparent)' },
  low: { background: 'var(--fill-tertiary)', color: 'var(--text-tertiary)', borderColor: 'var(--separator)' },
};

const columnLabels: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  inProgress: "In Progress",
  done: "Done",
};

function TaskCard({ task }: { task: Task }) {
  const pStyle = priorityStyles[task.priority || "low"] || priorityStyles.low;

  return (
    <div style={{
      borderRadius: 'var(--radius-md)', border: '1px solid var(--separator)',
      background: 'var(--material-regular)', padding: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    }}>
      <p style={{ fontSize: 'var(--text-subheadline)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>{task.title}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {task.assignee && (
          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>{task.assignee}</span>
        )}
        {task.priority && (
          <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 999, border: '1px solid', ...pStyle }}>
            {task.priority}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h4 style={{ fontSize: 'var(--text-caption1)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)' }}>
          {title}
        </h4>
        <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)' }}>{tasks.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map((task, idx) => (
          <TaskCard key={task.id || idx} task={task} />
        ))}
        {tasks.length === 0 && (
          <p style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)', textAlign: 'center', padding: '16px 0' }}>
            No tasks
          </p>
        )}
      </div>
    </div>
  );
}

export function BoardView({ department }: { department: string }) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    api
      .getDepartmentBoard(department)
      .then((data) => setBoard(data as BoardData))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [department]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, color: 'var(--text-quaternary)', fontSize: 'var(--text-subheadline)' }}>
        Loading board...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ borderRadius: 'var(--radius-md)', background: 'var(--fill-tertiary)', border: '1px solid var(--separator)', padding: '32px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 'var(--text-subheadline)', color: 'var(--text-tertiary)' }}>
          No board found for {department}.
        </p>
        <p style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)', marginTop: 4 }}>
          Tasks will appear here when the department has a board set up.
        </p>
      </div>
    );
  }

  if (!board) return null;

  // Support both { columns: { todo: [], ... } } and { tasks: [] } shapes
  let columns: Record<string, Task[]>;

  if (board.columns && typeof board.columns === "object") {
    columns = board.columns;
  } else if (Array.isArray(board.tasks)) {
    columns = {
      todo: board.tasks.filter((t) => t.status === "todo"),
      in_progress: board.tasks.filter(
        (t) => t.status === "in_progress" || t.status === "inProgress",
      ),
      done: board.tasks.filter((t) => t.status === "done"),
    };
  } else {
    columns = { todo: [], in_progress: [], done: [] };
  }

  const orderedKeys = ["todo", "in_progress", "inProgress", "done"];
  const displayColumns = orderedKeys
    .filter((key) => columns[key] !== undefined)
    .map((key) => ({
      key,
      title: columnLabels[key] || key,
      tasks: columns[key],
    }));

  // If no ordered keys found, show whatever columns exist
  if (displayColumns.length === 0) {
    for (const [key, tasks] of Object.entries(columns)) {
      displayColumns.push({
        key,
        title: columnLabels[key] || key,
        tasks,
      });
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 'var(--text-title2)', fontWeight: 600, letterSpacing: '-0.3px', marginBottom: 4, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
        {department}
      </h2>
      <p style={{ fontSize: 'var(--text-subheadline)', color: 'var(--text-tertiary)', marginBottom: 24 }}>Department board</p>

      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
        {displayColumns.map((col) => (
          <Column key={col.key} title={col.title} tasks={col.tasks} />
        ))}
      </div>
    </div>
  );
}

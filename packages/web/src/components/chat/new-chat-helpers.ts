/**
 * Build the params object for creating a new session via POST /api/sessions.
 * When an employee is selected, include the employee field.
 * When COO is selected (null), omit the employee field entirely.
 */
export function buildNewSessionParams(opts: {
  message: string
  selectedEmployee: string | null
  attachmentIds?: string[]
}): Record<string, unknown> {
  const params: Record<string, unknown> = {
    source: 'web',
    prompt: opts.message,
  }

  if (opts.selectedEmployee) {
    params.employee = opts.selectedEmployee
  }

  if (opts.attachmentIds && opts.attachmentIds.length > 0) {
    params.attachments = opts.attachmentIds
  }

  return params
}

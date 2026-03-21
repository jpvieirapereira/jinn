import { describe, it, expect } from 'vitest'

/**
 * Tests the logic for building session creation params based on employee selection.
 * This is the pure function extracted from ChatPane's handleSend.
 */
import { buildNewSessionParams } from '../new-chat-helpers'

describe('buildNewSessionParams', () => {
  it('creates session without employee field when COO is selected (null)', () => {
    const params = buildNewSessionParams({
      message: 'Hello',
      selectedEmployee: null,
    })
    expect(params).toEqual({
      source: 'web',
      prompt: 'Hello',
    })
    expect(params).not.toHaveProperty('employee')
  })

  it('includes employee field when an employee is selected', () => {
    const params = buildNewSessionParams({
      message: 'Fix the bug',
      selectedEmployee: 'jimmy-dev',
    })
    expect(params).toEqual({
      source: 'web',
      prompt: 'Fix the bug',
      employee: 'jimmy-dev',
    })
  })

  it('includes attachments when provided', () => {
    const params = buildNewSessionParams({
      message: 'Check this',
      selectedEmployee: 'pravko-lead',
      attachmentIds: ['file-1', 'file-2'],
    })
    expect(params).toEqual({
      source: 'web',
      prompt: 'Check this',
      employee: 'pravko-lead',
      attachments: ['file-1', 'file-2'],
    })
  })

  it('does not include attachments key when none provided', () => {
    const params = buildNewSessionParams({
      message: 'Hello',
      selectedEmployee: null,
    })
    expect(params).not.toHaveProperty('attachments')
  })
})

import { describe, it, expect } from 'vitest'
import { WorkspaceSchema } from '@symphony/shared'

describe('@symphony/shared smoke test', () => {
  it('parses a valid workspace and returns the correct label', () => {
    const result = WorkspaceSchema.parse({
      id: 'ws-1',
      label: 'Work',
      vivaldiWorkspaceId: 1,
    })
    expect(result.label).toBe('Work')
  })
})

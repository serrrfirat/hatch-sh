import { describe, expect, it } from 'vitest'
import { formatPRDForAgent } from '../prdFormatter'
import type { PRDDocument } from '../types'

function makePRD(overrides: Partial<PRDDocument> = {}): PRDDocument {
  return {
    id: 'prd-1',
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    plan: {
      type: 'plan',
      id: 'plan-1',
      summary: 'Build a task management app',
      requirements: ['User auth with OAuth', 'CRUD for tasks', 'Real-time sync'],
      sourceIdeaIds: ['idea-1'],
    },
    dependencyGraph: [],
    contradictions: [],
    scopeExclusions: [],
    acceptanceCriteria: [],
    metadata: {
      sourceMoodboardId: 'mb-1',
      generatedFrom: 'plan-1',
      nodeCount: 5,
      connectionCount: 3,
    },
    ...overrides,
  }
}

describe('formatPRDForAgent', () => {
  it('produces header and summary', () => {
    const result = formatPRDForAgent(makePRD())
    expect(result).toContain('## Product Requirements Document')
    expect(result).toContain('**Summary**: Build a task management app')
  })

  it('lists all requirements', () => {
    const result = formatPRDForAgent(makePRD())
    expect(result).toContain('### Requirements')
    expect(result).toContain('1. User auth with OAuth')
    expect(result).toContain('2. CRUD for tasks')
    expect(result).toContain('3. Real-time sync')
  })

  it('includes design notes when present', () => {
    const result = formatPRDForAgent(
      makePRD({
        plan: {
          type: 'plan',
          id: 'plan-1',
          summary: 'Test',
          requirements: [],
          designNotes: 'Use Material Design',
          sourceIdeaIds: [],
        },
      })
    )
    expect(result).toContain('**Design Notes**: Use Material Design')
  })

  it('includes technical approach when present', () => {
    const result = formatPRDForAgent(
      makePRD({
        plan: {
          type: 'plan',
          id: 'plan-1',
          summary: 'Test',
          requirements: [],
          technicalApproach: 'Use React + Supabase',
          sourceIdeaIds: [],
        },
      })
    )
    expect(result).toContain('**Technical Approach**: Use React + Supabase')
  })

  it('includes dependency graph when non-empty', () => {
    const result = formatPRDForAgent(
      makePRD({
        dependencyGraph: [
          { fromId: 'auth', toId: 'tasks', reasoning: 'Tasks require authenticated user' },
          { fromId: 'tasks', toId: 'sync' },
        ],
      })
    )
    expect(result).toContain('### Dependencies')
    expect(result).toContain('- auth → tasks (Tasks require authenticated user)')
    expect(result).toContain('- tasks → sync')
  })

  it('includes contradictions when non-empty', () => {
    const result = formatPRDForAgent(
      makePRD({
        contradictions: [
          { nodeAId: 'simple-ui', nodeBId: 'power-features', reasoning: 'Complexity conflict' },
        ],
      })
    )
    expect(result).toContain('### Contradictions to Resolve')
    expect(result).toContain('- simple-ui vs power-features: Complexity conflict')
  })

  it('includes scope exclusions when non-empty', () => {
    const result = formatPRDForAgent(
      makePRD({
        scopeExclusions: [
          { ideaId: 'mobile', reason: 'alternative', description: 'Native mobile app' },
        ],
      })
    )
    expect(result).toContain('### Do NOT Build (Out of Scope)')
    expect(result).toContain('- Native mobile app (alternative)')
  })

  it('includes acceptance criteria when non-empty', () => {
    const result = formatPRDForAgent(
      makePRD({
        acceptanceCriteria: [
          {
            id: 'ac-1',
            description: 'Users can sign in with GitHub',
            sourceNodeId: 'auth-node',
            critiqueType: 'User',
          },
        ],
      })
    )
    expect(result).toContain('### Acceptance Criteria')
    expect(result).toContain('- [ ] Users can sign in with GitHub')
  })

  it('omits empty sections', () => {
    const result = formatPRDForAgent(makePRD())
    expect(result).not.toContain('### Dependencies')
    expect(result).not.toContain('### Contradictions')
    expect(result).not.toContain('### Do NOT Build')
    expect(result).not.toContain('### Acceptance Criteria')
  })

  it('includes all sections when all populated', () => {
    const prd = makePRD({
      dependencyGraph: [{ fromId: 'a', toId: 'b' }],
      contradictions: [{ nodeAId: 'x', nodeBId: 'y' }],
      scopeExclusions: [{ ideaId: 'z', reason: 'rejected', description: 'Dropped feature' }],
      acceptanceCriteria: [
        { id: 'ac-1', description: 'It works', sourceNodeId: 'n1', critiqueType: 'Skeptic' },
      ],
    })
    const result = formatPRDForAgent(prd)
    expect(result).toContain('### Requirements')
    expect(result).toContain('### Dependencies')
    expect(result).toContain('### Contradictions to Resolve')
    expect(result).toContain('### Do NOT Build (Out of Scope)')
    expect(result).toContain('### Acceptance Criteria')
  })
})

import { describe, it, expect } from 'vitest'
import type {
  PRDDocument,
  PRDMetadata,
  DependencyEdge,
  Contradiction,
  ScopeExclusion,
  AcceptanceCriterion,
} from '../types'
import type { PlanContent } from '../../ideaMaze/types'

describe('PRDDocument types', () => {
  it('constructs a valid PRDDocument with all required fields', () => {
    const plan: PlanContent = {
      type: 'plan',
      id: 'plan-1',
      summary: 'Test plan',
      requirements: ['req1', 'req2'],
      sourceIdeaIds: ['idea-1'],
    }

    const metadata: PRDMetadata = {
      sourceMoodboardId: 'moodboard-1',
      generatedFrom: 'node-1',
      nodeCount: 5,
      connectionCount: 3,
    }

    const doc: PRDDocument = {
      id: 'prd-1',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plan,
      dependencyGraph: [],
      contradictions: [],
      scopeExclusions: [],
      acceptanceCriteria: [],
      metadata,
    }

    expect(doc.id).toBe('prd-1')
    expect(doc.version).toBe(1)
    expect(doc.plan).toEqual(plan)
    expect(doc.metadata).toEqual(metadata)
  })

  it('verifies plan field is exactly PlanContent shape (not spread/modified)', () => {
    const plan: PlanContent = {
      type: 'plan',
      id: 'plan-2',
      summary: 'Another plan',
      requirements: ['req1'],
      designNotes: 'Some notes',
      technicalApproach: 'Approach',
      sourceIdeaIds: ['idea-1', 'idea-2'],
    }

    const doc: PRDDocument = {
      id: 'prd-2',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plan,
      dependencyGraph: [],
      contradictions: [],
      scopeExclusions: [],
      acceptanceCriteria: [],
      metadata: {
        sourceMoodboardId: 'moodboard-2',
        generatedFrom: 'node-2',
        nodeCount: 3,
        connectionCount: 2,
      },
    }

    // Verify plan is not spread/modified
    expect(doc.plan.type).toBe('plan')
    expect(doc.plan.id).toBe('plan-2')
    expect(doc.plan.summary).toBe('Another plan')
    expect(doc.plan.requirements).toEqual(['req1'])
    expect(doc.plan.designNotes).toBe('Some notes')
    expect(doc.plan.technicalApproach).toBe('Approach')
    expect(doc.plan.sourceIdeaIds).toEqual(['idea-1', 'idea-2'])
  })

  it('allows empty arrays for dependencyGraph, contradictions, scopeExclusions, acceptanceCriteria', () => {
    const doc: PRDDocument = {
      id: 'prd-3',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plan: {
        type: 'plan',
        id: 'plan-3',
        summary: 'Empty arrays plan',
        requirements: [],
        sourceIdeaIds: [],
      },
      dependencyGraph: [],
      contradictions: [],
      scopeExclusions: [],
      acceptanceCriteria: [],
      metadata: {
        sourceMoodboardId: 'moodboard-3',
        generatedFrom: 'node-3',
        nodeCount: 0,
        connectionCount: 0,
      },
    }

    expect(doc.dependencyGraph).toEqual([])
    expect(doc.contradictions).toEqual([])
    expect(doc.scopeExclusions).toEqual([])
    expect(doc.acceptanceCriteria).toEqual([])
  })

  it('verifies PRDMetadata fields are all present', () => {
    const metadata: PRDMetadata = {
      sourceMoodboardId: 'moodboard-4',
      generatedFrom: 'node-4',
      nodeCount: 10,
      connectionCount: 15,
    }

    expect(metadata).toHaveProperty('sourceMoodboardId')
    expect(metadata).toHaveProperty('generatedFrom')
    expect(metadata).toHaveProperty('nodeCount')
    expect(metadata).toHaveProperty('connectionCount')
    expect(metadata.sourceMoodboardId).toBe('moodboard-4')
    expect(metadata.generatedFrom).toBe('node-4')
    expect(metadata.nodeCount).toBe(10)
    expect(metadata.connectionCount).toBe(15)
  })

  it('constructs DependencyEdge with all fields', () => {
    const edge: DependencyEdge = {
      fromId: 'node-1',
      toId: 'node-2',
      reasoning: 'Node 2 depends on Node 1',
    }

    expect(edge.fromId).toBe('node-1')
    expect(edge.toId).toBe('node-2')
    expect(edge.reasoning).toBe('Node 2 depends on Node 1')
  })

  it('constructs Contradiction with all fields', () => {
    const contradiction: Contradiction = {
      nodeAId: 'node-1',
      nodeBId: 'node-2',
      reasoning: 'These ideas conflict',
    }

    expect(contradiction.nodeAId).toBe('node-1')
    expect(contradiction.nodeBId).toBe('node-2')
    expect(contradiction.reasoning).toBe('These ideas conflict')
  })

  it('constructs ScopeExclusion with all fields', () => {
    const exclusion: ScopeExclusion = {
      ideaId: 'idea-1',
      reason: 'rejected',
      description: 'Out of scope for MVP',
    }

    expect(exclusion.ideaId).toBe('idea-1')
    expect(exclusion.reason).toBe('rejected')
    expect(exclusion.description).toBe('Out of scope for MVP')
  })

  it('constructs AcceptanceCriterion with all fields', () => {
    const criterion: AcceptanceCriterion = {
      id: 'ac-1',
      description: 'System must handle 1000 requests per second',
      sourceNodeId: 'node-1',
      critiqueType: 'Skeptic',
    }

    expect(criterion.id).toBe('ac-1')
    expect(criterion.description).toBe('System must handle 1000 requests per second')
    expect(criterion.sourceNodeId).toBe('node-1')
    expect(criterion.critiqueType).toBe('Skeptic')
  })

  it('allows optional reasoning fields in DependencyEdge and Contradiction', () => {
    const edgeNoReasoning: DependencyEdge = {
      fromId: 'node-1',
      toId: 'node-2',
    }

    const contradictionNoReasoning: Contradiction = {
      nodeAId: 'node-1',
      nodeBId: 'node-2',
    }

    expect(edgeNoReasoning.reasoning).toBeUndefined()
    expect(contradictionNoReasoning.reasoning).toBeUndefined()
  })

  it('supports populated arrays in PRDDocument', () => {
    const doc: PRDDocument = {
      id: 'prd-4',
      version: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plan: {
        type: 'plan',
        id: 'plan-4',
        summary: 'Complex plan',
        requirements: ['req1', 'req2'],
        sourceIdeaIds: ['idea-1'],
      },
      dependencyGraph: [{ fromId: 'node-1', toId: 'node-2', reasoning: 'depends' }],
      contradictions: [{ nodeAId: 'node-1', nodeBId: 'node-3', reasoning: 'conflict' }],
      scopeExclusions: [{ ideaId: 'idea-2', reason: 'alternative', description: 'Future phase' }],
      acceptanceCriteria: [
        {
          id: 'ac-1',
          description: 'Must be fast',
          sourceNodeId: 'node-1',
          critiqueType: 'User',
        },
      ],
      metadata: {
        sourceMoodboardId: 'moodboard-4',
        generatedFrom: 'node-4',
        nodeCount: 5,
        connectionCount: 4,
      },
    }

    expect(doc.dependencyGraph).toHaveLength(1)
    expect(doc.contradictions).toHaveLength(1)
    expect(doc.scopeExclusions).toHaveLength(1)
    expect(doc.acceptanceCriteria).toHaveLength(1)
  })
})

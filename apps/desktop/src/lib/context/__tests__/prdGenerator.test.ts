import { describe, expect, it } from 'vitest'
import type {
  IdeaConnection,
  IdeaNode,
  Moodboard,
  NodeCritique,
  PlanContent,
} from '../../ideaMaze/types'
import { generatePRD } from '../prdGenerator'

function makePlanContent(id: string): PlanContent {
  return {
    type: 'plan',
    id,
    summary: 'Plan summary',
    requirements: ['Requirement 1'],
    designNotes: 'Design note',
    technicalApproach: 'Technical approach',
    sourceIdeaIds: ['idea-1', 'idea-2'],
  }
}

function makeNode(id: string, title?: string, critiques?: NodeCritique[]): IdeaNode {
  const now = new Date('2026-02-24T00:00:00.000Z')
  return {
    id,
    position: { x: 0, y: 0 },
    dimensions: { width: 280, height: 160 },
    content: [{ type: 'text', id: `text-${id}`, text: `Node ${id}` }],
    title,
    tags: [],
    zIndex: 1,
    critiques,
    createdAt: now,
    updatedAt: now,
  }
}

function makeConnection(
  id: string,
  sourceId: string,
  targetId: string,
  relationship: IdeaConnection['relationship'],
  reasoning?: string
): IdeaConnection {
  return {
    id,
    sourceId,
    targetId,
    type: 'solid',
    relationship,
    reasoning,
  }
}

function makeMoodboard(nodes: IdeaNode[], connections: IdeaConnection[]): Moodboard {
  const now = new Date('2026-02-24T00:00:00.000Z')
  return {
    id: 'moodboard-1',
    name: 'Test moodboard',
    nodes,
    connections,
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now,
  }
}

describe('generatePRD', () => {
  it('extracts correct counts from a rich maze topology', () => {
    const critiques: NodeCritique[] = [
      {
        id: 'crit-1',
        critique: 'Critique A',
        suggestions: ['Use cache'],
        severity: 'warning',
        dismissed: true,
        createdAt: new Date('2026-02-24T00:00:00.000Z'),
      },
      {
        id: 'crit-2',
        critique: 'Critique B',
        suggestions: ['Add retry'],
        severity: 'critical',
        createdAt: new Date('2026-02-24T00:00:00.000Z'),
      },
      {
        id: 'crit-3',
        critique: 'FYI',
        suggestions: ['Info only'],
        severity: 'info',
        createdAt: new Date('2026-02-24T00:00:00.000Z'),
      },
      {
        id: 'crit-4',
        critique: 'Critique C',
        suggestions: ['Limit scope'],
        severity: 'warning',
        dismissed: true,
        createdAt: new Date('2026-02-24T00:00:00.000Z'),
      },
    ]

    const nodes = Array.from({ length: 9 }, (_, i) => makeNode(`node-${i + 1}`, `Node ${i + 1}`))
    nodes[0].critiques = [critiques[0], critiques[1]]
    nodes[1].critiques = [critiques[2], critiques[3]]

    const planContent = makePlanContent('plan-content-1')
    const planNode: IdeaNode = {
      ...makeNode('plan-node', 'Plan Node'),
      content: [planContent],
    }

    const allNodes = [...nodes, planNode]
    const connections = [
      makeConnection('c1', 'node-1', 'node-2', 'depends-on', 'A depends on B'),
      makeConnection('c2', 'node-2', 'node-3', 'depends-on', 'B depends on C'),
      makeConnection('c3', 'node-3', 'node-4', 'depends-on', 'C depends on D'),
      makeConnection('c4', 'node-4', 'node-5', 'depends-on', 'D depends on E'),
      makeConnection('c5', 'node-5', 'node-6', 'depends-on', 'E depends on F'),
      makeConnection('c6', 'node-1', 'node-7', 'contradicts', 'Not compatible'),
      makeConnection('c7', 'node-2', 'node-8', 'contradicts', 'Conflicting assumptions'),
      makeConnection('c8', 'node-3', 'node-9', 'alternative', 'Alternative approach 1'),
      makeConnection('c9', 'node-4', 'node-8', 'alternative', 'Alternative approach 2'),
      makeConnection('c10', 'node-5', 'node-7', 'alternative', 'Alternative approach 3'),
    ]

    const moodboard = makeMoodboard(allNodes, connections)

    const prd = generatePRD(moodboard, planNode)

    expect(prd.dependencyGraph).toHaveLength(5)
    expect(prd.contradictions).toHaveLength(2)
    expect(prd.scopeExclusions).toHaveLength(5)
    expect(prd.acceptanceCriteria).toHaveLength(1)
    expect(prd.metadata.nodeCount).toBe(10)
    expect(prd.metadata.connectionCount).toBe(10)
  })

  it('returns empty arrays for an empty maze without crashing', () => {
    const planContent = makePlanContent('plan-content-empty')
    const planNode: IdeaNode = {
      ...makeNode('plan-node', 'Plan Node'),
      content: [planContent],
    }
    const moodboard = makeMoodboard([planNode], [])

    const prd = generatePRD(moodboard, planNode)

    expect(prd.dependencyGraph).toEqual([])
    expect(prd.contradictions).toEqual([])
    expect(prd.scopeExclusions).toEqual([])
    expect(prd.acceptanceCriteria).toEqual([])
  })

  it('maps dismissed critiques to scopeExclusions only', () => {
    const dismissed: NodeCritique = {
      id: 'crit-dismissed',
      critique: 'Out of scope concern',
      suggestions: ['Skip for MVP'],
      severity: 'warning',
      dismissed: true,
      createdAt: new Date('2026-02-24T00:00:00.000Z'),
    }
    const node = makeNode('node-1', 'Node 1', [dismissed])
    const planContent = makePlanContent('plan-content-2')
    const planNode: IdeaNode = { ...makeNode('plan-node', 'Plan Node'), content: [planContent] }
    const moodboard = makeMoodboard([node, planNode], [])

    const prd = generatePRD(moodboard, planNode)

    expect(prd.scopeExclusions).toContainEqual({
      ideaId: 'node-1',
      reason: 'dismissed-critique',
      description: 'Out of scope concern',
    })
    expect(prd.acceptanceCriteria).toHaveLength(0)
  })

  it('maps undismissed non-info critiques to acceptanceCriteria', () => {
    const activeCritique: NodeCritique = {
      id: 'crit-active',
      critique: 'Need better fault tolerance',
      suggestions: ['Retry failed jobs', 'Add timeout handling'],
      severity: 'critical',
      createdAt: new Date('2026-02-24T00:00:00.000Z'),
    }
    const node = makeNode('node-1', 'Node 1', [activeCritique])
    const planContent = makePlanContent('plan-content-3')
    const planNode: IdeaNode = { ...makeNode('plan-node', 'Plan Node'), content: [planContent] }
    const moodboard = makeMoodboard([node, planNode], [])

    const prd = generatePRD(moodboard, planNode)

    expect(prd.acceptanceCriteria).toHaveLength(1)
    expect(prd.acceptanceCriteria[0].description).toBe('Retry failed jobs; Add timeout handling')
    expect(prd.acceptanceCriteria[0].sourceNodeId).toBe('node-1')
    expect(prd.acceptanceCriteria[0].critiqueType).toBe('General')
    expect(prd.scopeExclusions).toHaveLength(0)
  })

  it('embeds PlanContent as-is by object reference', () => {
    const planContent = makePlanContent('plan-content-4')
    const planNode: IdeaNode = { ...makeNode('plan-node', 'Plan Node'), content: [planContent] }
    const moodboard = makeMoodboard([planNode], [])

    const prd = generatePRD(moodboard, planNode)

    expect(prd.plan).toBe(planContent)
  })

  it('does not mutate moodboard input (pure function)', () => {
    const planContent = makePlanContent('plan-content-5')
    const planNode: IdeaNode = { ...makeNode('plan-node', 'Plan Node'), content: [planContent] }
    const node = makeNode('node-1', 'Node 1', [
      {
        id: 'crit-5',
        critique: 'Potential issue',
        suggestions: ['Adjust flow'],
        severity: 'warning',
        createdAt: new Date('2026-02-24T00:00:00.000Z'),
      },
    ])
    const moodboard = makeMoodboard(
      [node, planNode],
      [makeConnection('cx', 'node-1', 'plan-node', 'depends-on', 'Needed first')]
    )
    const before = structuredClone(moodboard)

    generatePRD(moodboard, planNode)

    expect(moodboard).toEqual(before)
  })

  it('maps dependency graph edges with correct fromId and toId', () => {
    const planContent = makePlanContent('plan-content-6')
    const planNode: IdeaNode = { ...makeNode('plan-node', 'Plan Node'), content: [planContent] }
    const nodeA = makeNode('node-a', 'A')
    const nodeB = makeNode('node-b', 'B')
    const moodboard = makeMoodboard(
      [nodeA, nodeB, planNode],
      [makeConnection('dep-1', 'node-a', 'node-b', 'depends-on', 'A depends on B')]
    )

    const prd = generatePRD(moodboard, planNode)

    expect(prd.dependencyGraph).toEqual([
      { fromId: 'node-a', toId: 'node-b', reasoning: 'A depends on B' },
    ])
  })

  it('maps contradictions with correct nodeAId and nodeBId', () => {
    const planContent = makePlanContent('plan-content-7')
    const planNode: IdeaNode = { ...makeNode('plan-node', 'Plan Node'), content: [planContent] }
    const nodeA = makeNode('node-a', 'A')
    const nodeB = makeNode('node-b', 'B')
    const moodboard = makeMoodboard(
      [nodeA, nodeB, planNode],
      [makeConnection('ctr-1', 'node-a', 'node-b', 'contradicts', 'A conflicts with B')]
    )

    const prd = generatePRD(moodboard, planNode)

    expect(prd.contradictions).toEqual([
      { nodeAId: 'node-a', nodeBId: 'node-b', reasoning: 'A conflicts with B' },
    ])
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  IdeaConnection,
  IdeaNode,
  Moodboard,
  NodeCritique,
  PlanContent,
} from '../../../apps/desktop/src/lib/ideaMaze/types'
import type { PRDDocument } from '../../../apps/desktop/src/lib/context/types'

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  BaseDirectory: { AppLocalData: 'AppLocalData' },
}))

const coreMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: fsMocks.mkdir,
  readTextFile: fsMocks.readTextFile,
  writeTextFile: fsMocks.writeTextFile,
  BaseDirectory: fsMocks.BaseDirectory,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: coreMocks.invoke,
}))

import { generatePRD } from '../../../apps/desktop/src/lib/context/prdGenerator'
import {
  savePRDToAppData,
  loadPRDFromAppData,
  copyPRDToWorkspace,
} from '../../../apps/desktop/src/lib/context/prdStorage'
import { formatPRDForAgent } from '../../../apps/desktop/src/lib/context/prdFormatter'

function makePlanContent(id: string, overrides: Partial<PlanContent> = {}): PlanContent {
  return {
    type: 'plan',
    id,
    summary: 'Ship Living PRD pipeline',
    requirements: ['Generate PRD', 'Persist PRD', 'Inject PRD context'],
    designNotes: 'Keep state transitions explicit',
    technicalApproach: 'Type-safe pipeline with deterministic formatting',
    sourceIdeaIds: ['idea-1', 'idea-2'],
    ...overrides,
  }
}

function makeNode(id: string, title: string, critiques?: NodeCritique[]): IdeaNode {
  const now = new Date('2026-02-24T00:00:00.000Z')
  return {
    id,
    position: { x: 0, y: 0 },
    dimensions: { width: 280, height: 160 },
    content: [{ type: 'text', id: `text-${id}`, text: `${title} content` }],
    title,
    tags: [],
    zIndex: 1,
    critiques,
    createdAt: now,
    updatedAt: now,
  }
}

function makePlanNode(id: string, plan: PlanContent): IdeaNode {
  const now = new Date('2026-02-24T00:00:00.000Z')
  return {
    id,
    position: { x: 100, y: 100 },
    dimensions: { width: 320, height: 240 },
    content: [plan],
    title: 'Plan Node',
    tags: ['plan'],
    zIndex: 1,
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

function makeMoodboard(id: string, nodes: IdeaNode[], connections: IdeaConnection[]): Moodboard {
  const now = new Date('2026-02-24T00:00:00.000Z')
  return {
    id,
    name: 'Living PRD moodboard',
    nodes,
    connections,
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now,
  }
}

describe('Living PRD pipeline integration', () => {
  const fileStore = new Map<string, string>()

  beforeEach(() => {
    vi.clearAllMocks()
    fileStore.clear()

    fsMocks.mkdir.mockResolvedValue(undefined)
    fsMocks.writeTextFile.mockImplementation(async (path: string, content: string) => {
      fileStore.set(path, content)
    })
    fsMocks.readTextFile.mockImplementation(async (path: string) => {
      const content = fileStore.get(path)
      if (!content) {
        throw new Error('File not found')
      }
      return content
    })
    coreMocks.invoke.mockResolvedValue(undefined)
  })

  it('generates PRD from maze topology with dependencies, contradictions, exclusions, acceptance criteria, and plan reference', () => {
    const critiques: NodeCritique[] = [
      {
        id: 'crit-1',
        critique: 'This branch should not ship now',
        suggestions: ['Delay this feature'],
        severity: 'warning',
        dismissed: true,
        createdAt: new Date('2026-02-24T00:00:00.000Z'),
      },
      {
        id: 'crit-2',
        critique: 'Recovery path is missing',
        suggestions: ['Add retry strategy', 'Add fallback behavior'],
        severity: 'critical',
        createdAt: new Date('2026-02-24T00:00:00.000Z'),
      },
    ]

    const nodeA = makeNode('node-a', 'Source A', critiques)
    const nodeB = makeNode('node-b', 'Dependency B')
    const nodeC = makeNode('node-c', 'Contradiction C')
    const nodeD = makeNode('node-d', 'Alternative D')

    const planContent = makePlanContent('plan-content-1')
    const planNode = makePlanNode('plan-node', planContent)

    const moodboard = makeMoodboard(
      'mb-rich',
      [nodeA, nodeB, nodeC, nodeD, planNode],
      [
        makeConnection('dep-1', 'node-a', 'node-b', 'depends-on', 'A must complete before B'),
        makeConnection('ctr-1', 'node-b', 'node-c', 'contradicts', 'Mutually exclusive behavior'),
        makeConnection(
          'alt-1',
          'node-a',
          'node-d',
          'alternative',
          'Alternative implementation path'
        ),
      ]
    )

    const prd = generatePRD(moodboard, planNode)

    expect(prd.dependencyGraph).toHaveLength(1)
    expect(prd.contradictions).toHaveLength(1)
    expect(prd.scopeExclusions).toHaveLength(2)
    expect(prd.acceptanceCriteria).toHaveLength(1)
    expect(prd.plan).toBe(planContent)
  })

  it('stores and loads PRD from AppLocalData with mocked Tauri filesystem APIs', async () => {
    const planContent = makePlanContent('plan-content-storage')
    const planNode = makePlanNode('plan-node-storage', planContent)
    const moodboard = makeMoodboard('mb-storage', [planNode], [])
    const prd = generatePRD(moodboard, planNode)

    await savePRDToAppData('mb-storage', prd)
    const loaded = await loadPRDFromAppData('mb-storage')

    expect(fsMocks.mkdir).toHaveBeenCalledWith('idea-maze/prd', {
      baseDir: fsMocks.BaseDirectory.AppLocalData,
      recursive: true,
    })
    expect(fsMocks.writeTextFile).toHaveBeenCalledWith(
      'idea-maze/prd/mb-storage.json',
      JSON.stringify(prd, null, 2),
      { baseDir: fsMocks.BaseDirectory.AppLocalData }
    )
    expect(loaded).toEqual(prd)
  })

  it('copies PRD into workspace context path via write_project_files invoke', async () => {
    const planContent = makePlanContent('plan-content-copy')
    const planNode = makePlanNode('plan-node-copy', planContent)
    const moodboard = makeMoodboard('mb-copy', [planNode], [])
    const prd = generatePRD(moodboard, planNode)

    await copyPRDToWorkspace(prd, '/test/workspace')

    expect(coreMocks.invoke).toHaveBeenCalledWith('write_project_files', {
      baseDir: '/test/workspace',
      files: [{ path: '.hatch/context/prd.json', content: JSON.stringify(prd, null, 2) }],
    })
  })

  it('formats PRD for agent context injection as readable markdown sections', () => {
    const prd: PRDDocument = {
      id: 'prd-format-1',
      version: 1,
      createdAt: '2026-02-24T00:00:00.000Z',
      updatedAt: '2026-02-24T00:00:00.000Z',
      plan: makePlanContent('plan-content-format', {
        summary: 'Build end-to-end Living PRD pipeline',
        requirements: ['Extract topology', 'Persist PRD', 'Inject context into agent'],
      }),
      dependencyGraph: [{ fromId: 'node-a', toId: 'node-b', reasoning: 'A before B' }],
      contradictions: [
        { nodeAId: 'node-b', nodeBId: 'node-c', reasoning: 'Incompatible assumptions' },
      ],
      scopeExclusions: [
        { ideaId: 'node-d', reason: 'alternative', description: 'Legacy implementation' },
      ],
      acceptanceCriteria: [
        {
          id: 'ac-1',
          description: 'Pipeline writes PRD to workspace context path',
          sourceNodeId: 'node-a',
          critiqueType: 'Maintainer',
        },
      ],
      metadata: {
        sourceMoodboardId: 'mb-format',
        generatedFrom: 'plan-node-format',
        nodeCount: 4,
        connectionCount: 2,
      },
    }

    const context = formatPRDForAgent(prd)

    expect(context).toContain('## Product Requirements Document')
    expect(context).toContain('**Summary**: Build end-to-end Living PRD pipeline')
    expect(context).toContain('### Requirements')
    expect(context).toContain('### Dependencies')
    expect(context).toContain('### Contradictions to Resolve')
    expect(context).toContain('### Do NOT Build (Out of Scope)')
    expect(context).toContain('### Acceptance Criteria')
    expect(context).not.toContain('"dependencyGraph"')
    expect(context).not.toContain('{"id":')
  })

  it('handles empty maze by generating a PRD with empty derived arrays', () => {
    const planContent = makePlanContent('plan-content-empty', {
      requirements: ['Only requirement from plan'],
    })
    const planNode = makePlanNode('plan-node-empty', planContent)
    const moodboard = makeMoodboard('mb-empty', [planNode], [])

    const prd = generatePRD(moodboard, planNode)

    expect(prd.dependencyGraph).toEqual([])
    expect(prd.contradictions).toEqual([])
    expect(prd.scopeExclusions).toEqual([])
    expect(prd.acceptanceCriteria).toEqual([])
  })

  it('extracts contradiction edges from a maze with conflicting branches', () => {
    const planContent = makePlanContent('plan-content-ctr')
    const planNode = makePlanNode('plan-node-ctr', planContent)
    const nodeA = makeNode('node-a', 'Branch A')
    const nodeB = makeNode('node-b', 'Branch B')
    const nodeC = makeNode('node-c', 'Branch C')
    const moodboard = makeMoodboard(
      'mb-ctr',
      [planNode, nodeA, nodeB, nodeC],
      [
        makeConnection('ctr-1', 'node-a', 'node-b', 'contradicts', 'Different consistency models'),
        makeConnection('ctr-2', 'node-b', 'node-c', 'contradicts', 'Opposite rollout assumptions'),
      ]
    )

    const prd = generatePRD(moodboard, planNode)

    expect(prd.contradictions).toEqual([
      { nodeAId: 'node-a', nodeBId: 'node-b', reasoning: 'Different consistency models' },
      { nodeAId: 'node-b', nodeBId: 'node-c', reasoning: 'Opposite rollout assumptions' },
    ])
  })

  it('regenerates PRD after maze changes and updates metadata nodeCount', () => {
    const planContent = makePlanContent('plan-content-regen')
    const planNode = makePlanNode('plan-node-regen', planContent)
    const nodeA = makeNode('node-a', 'Initial branch')

    const initialMoodboard = makeMoodboard('mb-regen', [planNode, nodeA], [])
    const initialPRD = generatePRD(initialMoodboard, planNode)

    const nodeB = makeNode('node-b', 'New branch after iteration')
    const updatedMoodboard = makeMoodboard('mb-regen', [planNode, nodeA, nodeB], [])
    const regeneratedPRD = generatePRD(updatedMoodboard, planNode)

    expect(initialPRD.metadata.nodeCount).toBe(2)
    expect(regeneratedPRD.metadata.nodeCount).toBe(3)
  })
})

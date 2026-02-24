import { describe, it, expect, beforeEach } from 'vitest'
import { useIdeaMazeStore } from '../ideaMazeStore'
import type { PRDDocument } from '../../lib/context/types'

function makeFakePRD(overrides?: Partial<PRDDocument>): PRDDocument {
  return {
    id: 'prd-1',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    plan: {
      type: 'plan',
      id: 'plan-content-1',
      summary: 'Build a widget',
      requirements: ['Req 1', 'Req 2'],
      sourceIdeaIds: ['node-1'],
    },
    dependencyGraph: [],
    contradictions: [],
    scopeExclusions: [],
    acceptanceCriteria: [],
    metadata: {
      sourceMoodboardId: 'mb-1',
      generatedFrom: 'node-plan-1',
      nodeCount: 3,
      connectionCount: 1,
    },
    ...overrides,
  }
}

describe('ideaMazeStore - currentPRD', () => {
  beforeEach(() => {
    useIdeaMazeStore.setState({ currentPRD: null })
  })

  it('initializes currentPRD as null', () => {
    const { currentPRD } = useIdeaMazeStore.getState()
    expect(currentPRD).toBeNull()
  })

  it('setCurrentPRD sets a PRD document', () => {
    const prd = makeFakePRD()

    useIdeaMazeStore.getState().setCurrentPRD(prd)

    expect(useIdeaMazeStore.getState().currentPRD).toEqual(prd)
  })

  it('setCurrentPRD can clear back to null', () => {
    const prd = makeFakePRD()
    useIdeaMazeStore.getState().setCurrentPRD(prd)
    expect(useIdeaMazeStore.getState().currentPRD).not.toBeNull()

    useIdeaMazeStore.getState().setCurrentPRD(null)

    expect(useIdeaMazeStore.getState().currentPRD).toBeNull()
  })

  it('setCurrentPRD replaces previous PRD', () => {
    const prd1 = makeFakePRD({ id: 'prd-1' })
    const prd2 = makeFakePRD({ id: 'prd-2' })

    useIdeaMazeStore.getState().setCurrentPRD(prd1)
    expect(useIdeaMazeStore.getState().currentPRD?.id).toBe('prd-1')

    useIdeaMazeStore.getState().setCurrentPRD(prd2)
    expect(useIdeaMazeStore.getState().currentPRD?.id).toBe('prd-2')
  })
})

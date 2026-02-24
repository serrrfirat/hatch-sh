import { describe, it, expect, beforeEach, afterEach } from 'vitest'
// React is needed for JSX transform
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { PrdCard } from '../PrdCard'
import type { PRDDocument } from '../../../lib/context/types'

function makeFakePRD(overrides?: Partial<PRDDocument>): PRDDocument {
  return {
    id: 'prd-1',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    plan: {
      type: 'plan',
      id: 'plan-content-1',
      summary: 'Build a widget that does cool things',
      requirements: ['Must be fast', 'Must be reliable', 'Must be accessible'],
      sourceIdeaIds: ['node-1'],
    },
    dependencyGraph: [
      { fromId: 'node-a', toId: 'node-b', reasoning: 'A depends on B' },
    ],
    contradictions: [
      { nodeAId: 'node-x', nodeBId: 'node-y', reasoning: 'X contradicts Y' },
    ],
    scopeExclusions: [
      { ideaId: 'idea-z', reason: 'rejected', description: 'Too complex' },
    ],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        description: 'Widget loads in under 2s',
        sourceNodeId: 'node-1',
        critiqueType: 'User',
      },
      {
        id: 'ac-2',
        description: 'Widget handles errors gracefully',
        sourceNodeId: 'node-1',
        critiqueType: 'Skeptic',
      },
    ],
    metadata: {
      sourceMoodboardId: 'mb-1',
      generatedFrom: 'node-plan-1',
      nodeCount: 3,
      connectionCount: 1,
    },
    ...overrides,
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

describe('PrdCard', () => {
  it('renders nothing when prd is null', () => {
    act(() => {
      root.render(<PrdCard prd={null} />)
    })
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when prd is undefined', () => {
    act(() => {
      root.render(<PrdCard prd={undefined as unknown as null} />)
    })
    expect(container.innerHTML).toBe('')
  })

  it('renders header with PRD label when prd provided', () => {
    const prd = makeFakePRD()
    act(() => {
      root.render(<PrdCard prd={prd} />)
    })
    const header = container.querySelector('[data-testid="prd-card-header"]')
    expect(header).not.toBeNull()
    expect(header?.textContent).toContain('PRD')
  })

  it('renders summary when PRD provided', () => {
    const prd = makeFakePRD()
    act(() => {
      root.render(<PrdCard prd={prd} />)
    })
    // Expand first
    const toggle = container.querySelector('[data-testid="prd-card-header"]')
    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.textContent).toContain('Build a widget that does cool things')
  })

  it('shows requirements count', () => {
    const prd = makeFakePRD()
    act(() => {
      root.render(<PrdCard prd={prd} />)
    })
    // Expand first
    const toggle = container.querySelector('[data-testid="prd-card-header"]')
    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    // Should show 3 requirements
    const reqSection = container.querySelector('[data-testid="prd-requirements"]')
    expect(reqSection).not.toBeNull()
    expect(reqSection?.textContent).toContain('3')
  })

  it('is collapsed by default (header visible, content hidden)', () => {
    const prd = makeFakePRD()
    act(() => {
      root.render(<PrdCard prd={prd} />)
    })
    const header = container.querySelector('[data-testid="prd-card-header"]')
    expect(header).not.toBeNull()
    const body = container.querySelector('[data-testid="prd-card-body"]')
    expect(body).toBeNull()
  })

  it('expands on click to show body content', () => {
    const prd = makeFakePRD()
    act(() => {
      root.render(<PrdCard prd={prd} />)
    })
    // Verify collapsed
    expect(container.querySelector('[data-testid="prd-card-body"]')).toBeNull()

    // Click to expand
    const toggle = container.querySelector('[data-testid="prd-card-header"]')
    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Verify expanded
    const body = container.querySelector('[data-testid="prd-card-body"]')
    expect(body).not.toBeNull()
  })

  it('shows dependency graph info when expanded', () => {
    const prd = makeFakePRD()
    act(() => {
      root.render(<PrdCard prd={prd} />)
    })
    const toggle = container.querySelector('[data-testid="prd-card-header"]')
    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const depSection = container.querySelector('[data-testid="prd-dependencies"]')
    expect(depSection).not.toBeNull()
    expect(depSection?.textContent).toContain('1')
  })

  it('shows contradictions when expanded', () => {
    const prd = makeFakePRD()
    act(() => {
      root.render(<PrdCard prd={prd} />)
    })
    const toggle = container.querySelector('[data-testid="prd-card-header"]')
    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const section = container.querySelector('[data-testid="prd-contradictions"]')
    expect(section).not.toBeNull()
    expect(section?.textContent).toContain('1')
  })

  it('shows acceptance criteria when expanded', () => {
    const prd = makeFakePRD()
    act(() => {
      root.render(<PrdCard prd={prd} />)
    })
    const toggle = container.querySelector('[data-testid="prd-card-header"]')
    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const section = container.querySelector('[data-testid="prd-acceptance-criteria"]')
    expect(section).not.toBeNull()
    expect(section?.textContent).toContain('Widget loads in under 2s')
    expect(section?.textContent).toContain('Widget handles errors gracefully')
  })

  it('collapses when clicked again', () => {
    const prd = makeFakePRD()
    act(() => {
      root.render(<PrdCard prd={prd} />)
    })
    const toggle = container.querySelector('[data-testid="prd-card-header"]')

    // Expand
    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('[data-testid="prd-card-body"]')).not.toBeNull()

    // Collapse
    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('[data-testid="prd-card-body"]')).toBeNull()
  })
})

import type { PlanContent } from '../ideaMaze/types'

export interface DependencyEdge {
  fromId: string // sourceId of the depends-on connection
  toId: string // targetId of the depends-on connection
  reasoning?: string
}

export interface Contradiction {
  nodeAId: string
  nodeBId: string
  reasoning?: string
}

export interface ScopeExclusion {
  ideaId: string
  reason: 'rejected' | 'alternative' | 'dismissed-critique'
  description: string
}

export interface AcceptanceCriterion {
  id: string
  description: string
  sourceNodeId: string // which node's critique this came from
  critiqueType: string // e.g. 'Skeptic', 'User', etc.
}

export interface PRDMetadata {
  sourceMoodboardId: string
  generatedFrom: string // plan node id
  nodeCount: number
  connectionCount: number
}

export interface PRDDocument {
  id: string
  version: number
  createdAt: string // ISO string
  updatedAt: string // ISO string
  plan: PlanContent // WRAPS, never modifies
  dependencyGraph: DependencyEdge[]
  contradictions: Contradiction[]
  scopeExclusions: ScopeExclusion[]
  acceptanceCriteria: AcceptanceCriterion[]
  metadata: PRDMetadata
}

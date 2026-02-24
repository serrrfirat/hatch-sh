import type { IdeaNode, Moodboard, NodeCritique, PlanContent } from '../ideaMaze/types'
import type { PRDDocument } from './types'

type NodeCritiqueWithPerspective = NodeCritique & { perspective?: string }

function getCritiquePerspective(critique: NodeCritique): string {
  const maybeWithPerspective = critique as NodeCritiqueWithPerspective
  return maybeWithPerspective.perspective ?? 'General'
}

export function generatePRD(moodboard: Moodboard, planNode: IdeaNode): PRDDocument {
  const dependencyGraph = moodboard.connections
    .filter((connection) => connection.relationship === 'depends-on')
    .map((connection) => ({
      fromId: connection.sourceId,
      toId: connection.targetId,
      reasoning: connection.reasoning,
    }))

  const contradictions = moodboard.connections
    .filter((connection) => connection.relationship === 'contradicts')
    .map((connection) => ({
      nodeAId: connection.sourceId,
      nodeBId: connection.targetId,
      reasoning: connection.reasoning,
    }))

  const alternativeExclusions = moodboard.connections
    .filter((connection) => connection.relationship === 'alternative')
    .map((connection) => {
      const alternativeNode = moodboard.nodes.find((node) => node.id === connection.targetId)
      return {
        ideaId: connection.targetId,
        reason: 'alternative' as const,
        description: alternativeNode?.title ?? 'Alternative approach',
      }
    })

  const dismissedCritiqueExclusions = moodboard.nodes.flatMap((node) =>
    (node.critiques ?? [])
      .filter((critique) => critique.dismissed === true)
      .map((critique) => ({
        ideaId: node.id,
        reason: 'dismissed-critique' as const,
        description: critique.critique,
      }))
  )

  const scopeExclusions = [...alternativeExclusions, ...dismissedCritiqueExclusions]

  const acceptanceCriteria = moodboard.nodes.flatMap((node) =>
    (node.critiques ?? [])
      .filter((critique) => critique.dismissed !== true && critique.severity !== 'info')
      .map((critique) => ({
        id: crypto.randomUUID(),
        description:
          critique.suggestions.length > 0 ? critique.suggestions.join('; ') : critique.critique,
        sourceNodeId: node.id,
        critiqueType: getCritiquePerspective(critique),
      }))
  )

  const planContent = planNode.content.find(
    (content): content is PlanContent => content.type === 'plan'
  )
  if (!planContent) {
    throw new Error('Plan node does not contain plan content')
  }

  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: now,
    updatedAt: now,
    plan: planContent,
    dependencyGraph,
    contradictions,
    scopeExclusions,
    acceptanceCriteria,
    metadata: {
      sourceMoodboardId: moodboard.id,
      generatedFrom: planNode.id,
      nodeCount: moodboard.nodes.length,
      connectionCount: moodboard.connections.length,
    },
  }
}

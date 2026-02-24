import type { PRDDocument } from './types'

export function formatPRDForAgent(prd: PRDDocument): string {
  const lines: string[] = [
    '## Product Requirements Document',
    '',
    `**Summary**: ${prd.plan.summary}`,
    '',
  ]

  if (prd.plan.designNotes) {
    lines.push(`**Design Notes**: ${prd.plan.designNotes}`, '')
  }

  if (prd.plan.technicalApproach) {
    lines.push(`**Technical Approach**: ${prd.plan.technicalApproach}`, '')
  }

  if (prd.plan.requirements.length > 0) {
    lines.push('### Requirements')
    prd.plan.requirements.forEach((r, i) => {
      lines.push(`${i + 1}. ${r}`)
    })
  }

  if (prd.dependencyGraph.length > 0) {
    lines.push('', '### Dependencies')
    prd.dependencyGraph.forEach((dep) => {
      lines.push(`- ${dep.fromId} → ${dep.toId}${dep.reasoning ? ` (${dep.reasoning})` : ''}`)
    })
  }

  if (prd.contradictions.length > 0) {
    lines.push('', '### Contradictions to Resolve')
    prd.contradictions.forEach((c) => {
      lines.push(`- ${c.nodeAId} vs ${c.nodeBId}${c.reasoning ? `: ${c.reasoning}` : ''}`)
    })
  }

  if (prd.scopeExclusions.length > 0) {
    lines.push('', '### Do NOT Build (Out of Scope)')
    prd.scopeExclusions.forEach((e) => {
      lines.push(`- ${e.description} (${e.reason})`)
    })
  }

  if (prd.acceptanceCriteria.length > 0) {
    lines.push('', '### Acceptance Criteria')
    prd.acceptanceCriteria.forEach((ac) => {
      lines.push(`- [ ] ${ac.description}`)
    })
  }

  return lines.join('\n')
}

import type { PlanContent } from './types'

export function formatPlanAsMarkdown(plan: PlanContent): string {
  const sections: string[] = []

  sections.push(`## Plan Summary\n\n${plan.summary}`)

  if (plan.requirements.length > 0) {
    sections.push(`## Requirements\n\n${plan.requirements.map(r => `- ${r}`).join('\n')}`)
  }

  if (plan.designNotes) {
    sections.push(`## Design Notes\n\n${plan.designNotes}`)
  }

  if (plan.technicalApproach) {
    sections.push(`## Technical Approach\n\n${plan.technicalApproach}`)
  }

  if (plan.sourceIdeaIds.length > 0) {
    sections.push(`## Source Ideas\n\nDerived from ideas: ${plan.sourceIdeaIds.join(', ')}`)
  }

  return sections.join('\n\n')
}

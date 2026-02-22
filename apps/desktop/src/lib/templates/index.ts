export interface ProjectTemplate {
  id: string
  name: string
  description: string
  initialPrompt: string
  tags?: string[]
}

export { landingPageTemplate } from './landing-page'

// Template registry
import { landingPageTemplate } from './landing-page'

export const templates: ProjectTemplate[] = [
  landingPageTemplate,
]

export function getTemplate(id: string): ProjectTemplate | undefined {
  return templates.find(t => t.id === id)
}

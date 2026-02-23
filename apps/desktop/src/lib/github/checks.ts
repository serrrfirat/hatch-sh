export interface WorkflowRun {
  name: string
  status: string
  conclusion: string | null
  databaseId: number
  headBranch: string
}

function isWorkflowRun(value: unknown): value is WorkflowRun {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.name === 'string' &&
    typeof record.status === 'string' &&
    (typeof record.conclusion === 'string' || record.conclusion === null) &&
    typeof record.databaseId === 'number' &&
    typeof record.headBranch === 'string'
  )
}

export function parseWorkflowRuns(json: string): WorkflowRun[] {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isWorkflowRun)
  } catch {
    return []
  }
}

export function getStatusIcon(status: string, conclusion: string | null): string {
  if (status === 'completed') {
    return conclusion === 'success' ? '✅' : '❌'
  }

  if (status === 'queued') {
    return '⏸'
  }

  return '🔄'
}

export function buildRerunCommand(runId: number): string {
  return `gh run rerun ${runId}`
}

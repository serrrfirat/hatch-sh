import { invoke } from '@tauri-apps/api/core'

interface FileContent {
  content: string
}

interface WriteProjectFileInput {
  path: string
  content: string
}

interface WriteProjectFileResult {
  path: string
  success: boolean
  size: number
  error: string | null
}

const DECISION_PREFIX = '- Decision:'
const REQUEST_PREFIX = '- Request:'

function truncateInline(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 3)}...`
}

function extractDecisionSummary(assistantResponse: string): string {
  const lines = assistantResponse
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const candidates = lines.filter(
    (line) =>
      !line.startsWith('```') &&
      !line.startsWith('#') &&
      (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line))
  )

  if (candidates.length > 0) {
    return truncateInline(candidates[0].replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''), 220)
  }

  return truncateInline(lines[0] ?? '', 220)
}

export function buildProjectMemoryEntry(
  userRequest: string,
  assistantResponse: string
): string | null {
  const request = truncateInline(userRequest, 180)
  const decision = extractDecisionSummary(assistantResponse)

  if (!request || !decision) {
    return null
  }

  const timestamp = new Date().toISOString()
  return `### ${timestamp}\n${REQUEST_PREFIX} ${request}\n${DECISION_PREFIX} ${decision}`
}

export async function readProjectMemory(workspacePath: string): Promise<string | null> {
  try {
    const result = await invoke<FileContent>('read_file', {
      filePath: `${workspacePath}/.hatch/context.md`,
    })
    return result.content
  } catch {
    return null
  }
}

export async function writeProjectMemory(workspacePath: string, content: string): Promise<void> {
  const files: WriteProjectFileInput[] = [
    {
      path: '.hatch/context.md',
      content,
    },
  ]

  const results = await invoke<WriteProjectFileResult[]>('write_project_files', {
    files,
    baseDir: workspacePath,
  })

  const failed = results.filter((result) => !result.success)
  if (failed.length > 0) {
    const reason = failed
      .map((result) => `${result.path} (${result.error || 'unknown error'})`)
      .join(', ')
    throw new Error(`Failed to write project memory: ${reason}`)
  }
}

export async function appendProjectMemoryDecision(
  workspacePath: string,
  userRequest: string,
  assistantResponse: string
): Promise<void> {
  const entry = buildProjectMemoryEntry(userRequest, assistantResponse)
  if (!entry) {
    return
  }

  const entryBody = entry.split('\n').slice(1).join('\n')

  const existing = (await readProjectMemory(workspacePath)) ?? '# Workspace Memory'
  const normalizedExisting = existing.trim()

  if (entryBody && normalizedExisting.includes(entryBody)) {
    return
  }

  const nextContent = normalizedExisting
    ? `${normalizedExisting}\n\n${entry}`
    : `# Workspace Memory\n\n${entry}`

  await writeProjectMemory(workspacePath, `${nextContent}\n`)
}

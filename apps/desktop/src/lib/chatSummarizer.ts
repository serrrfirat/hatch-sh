import type { Message } from '../stores/chatStore'

const MAX_SUMMARY_LENGTH = 500

const FILE_PATH_PATTERN =
  /(?:(?:[\w.-]+\/)+[\w.-]+|[\w.-]+)\.(?:ts|tsx|js|jsx|css|json|md|html|yaml|yml|toml|rs|go|py|sh|sql|graphql|prisma|env)(?=[\s,;)"']|$)/g

function extractUserTopics(messages: Message[]): string[] {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => {
      const firstLine = m.content.split('\n')[0].trim()
      return firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine
    })
}

function extractFilePaths(messages: Message[]): string[] {
  const paths = new Set<string>()
  for (const msg of messages) {
    const matches = msg.content.match(FILE_PATH_PATTERN)
    if (matches) {
      for (const match of matches) {
        paths.add(match)
      }
    }
  }
  return [...paths]
}

function extractToolNames(messages: Message[]): string[] {
  const tools = new Set<string>()
  for (const msg of messages) {
    if (msg.toolUses) {
      for (const tool of msg.toolUses) {
        tools.add(tool.name)
      }
    }
  }
  return [...tools]
}

export function summarizeDroppedMessages(messages: Message[]): string {
  if (messages.length === 0) return ''

  const topics = extractUserTopics(messages)
  const filePaths = extractFilePaths(messages)
  const toolNames = extractToolNames(messages)

  if (topics.length === 0 && filePaths.length === 0 && toolNames.length === 0) return ''

  const lines: string[] = ['[Context from earlier conversation]']

  if (topics.length > 0) {
    lines.push(`- User asked about: ${topics.join(', ')}`)
  }

  if (filePaths.length > 0) {
    lines.push(`- Code discussed: ${filePaths.join(', ')}`)
  }

  if (toolNames.length > 0) {
    lines.push(`- Tools used: ${toolNames.join(', ')}`)
  }

  const summary = lines.join('\n')

  if (summary.length <= MAX_SUMMARY_LENGTH) return summary

  return summary.slice(0, MAX_SUMMARY_LENGTH - 3) + '...'
}

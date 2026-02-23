// Slash command result types
export type SlashCommandResult =
  | { type: 'clear' }
  | { type: 'review'; scope?: string }
  | { type: 'restart' }
  | { type: 'help'; commands: SlashCommandDef[] }
  | { type: 'error'; message: string }
  | null // not a slash command

export interface SlashCommandDef {
  name: string
  description: string
  usage: string
}

// Registry of all built-in commands
export const SLASH_COMMANDS: SlashCommandDef[] = [
  { name: '/clear', description: 'Clear all messages in current workspace chat', usage: '/clear' },
  {
    name: '/review',
    description: 'AI code review of current workspace changes',
    usage: '/review [file-path]',
  },
  {
    name: '/restart',
    description: 'Restart the agent process for current workspace',
    usage: '/restart',
  },
  { name: '/help', description: 'Show available commands', usage: '/help' },
]

// Parse a message string as a potential slash command
// Returns null if not a slash command
// Returns SlashCommandResult if it is a slash command
export function parseSlashCommand(
  input: string,
  context: { isStreaming: boolean }
): SlashCommandResult {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const parts = trimmed.slice(1).split(/\s+/)
  const commandName = `/${parts[0].toLowerCase()}`
  const args = parts.slice(1)

  switch (commandName) {
    case '/clear':
      if (context.isStreaming) {
        return { type: 'error', message: 'Cannot clear while agent is streaming' }
      }
      return { type: 'clear' }

    case '/review':
      return { type: 'review', scope: args[0] }

    case '/restart':
      return { type: 'restart' }

    case '/help':
      return { type: 'help', commands: SLASH_COMMANDS }

    default:
      return {
        type: 'error',
        message: `Unknown command: ${commandName}. Type /help for available commands.`,
      }
  }
}

// Check if a string starts with / (for autocomplete triggering)
export function isSlashInput(input: string): boolean {
  return input.trimStart().startsWith('/')
}

// Get matching commands for autocomplete
export function getCommandSuggestions(partial: string): SlashCommandDef[] {
  const lower = partial.toLowerCase()
  return SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(lower))
}

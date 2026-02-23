import { describe, expect, it } from 'vitest'
import {
  parseSlashCommand,
  isSlashInput,
  getCommandSuggestions,
  SLASH_COMMANDS,
} from '../slashCommands'

describe('parseSlashCommand', () => {
  it('returns null for non-command input', () => {
    const result = parseSlashCommand('hello world', { isStreaming: false })
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parseSlashCommand('', { isStreaming: false })
    expect(result).toBeNull()
  })

  it('returns null for whitespace only', () => {
    const result = parseSlashCommand('   ', { isStreaming: false })
    expect(result).toBeNull()
  })

  it('returns { type: "clear" } when /clear with isStreaming: false', () => {
    const result = parseSlashCommand('/clear', { isStreaming: false })
    expect(result).toEqual({ type: 'clear' })
  })

  it('returns error when /clear with isStreaming: true', () => {
    const result = parseSlashCommand('/clear', { isStreaming: true })
    expect(result).toEqual({
      type: 'error',
      message: 'Cannot clear while agent is streaming',
    })
  })

  it('returns { type: "review", scope: undefined } for /review without args', () => {
    const result = parseSlashCommand('/review', { isStreaming: false })
    expect(result).toEqual({ type: 'review', scope: undefined })
  })

  it('returns { type: "review", scope: "src/file.ts" } for /review with file path', () => {
    const result = parseSlashCommand('/review src/file.ts', { isStreaming: false })
    expect(result).toEqual({ type: 'review', scope: 'src/file.ts' })
  })

  it('returns { type: "restart" } for /restart', () => {
    const result = parseSlashCommand('/restart', { isStreaming: false })
    expect(result).toEqual({ type: 'restart' })
  })

  it('returns { type: "help", commands: [...] } for /help', () => {
    const result = parseSlashCommand('/help', { isStreaming: false })
    expect(result).toEqual({
      type: 'help',
      commands: SLASH_COMMANDS,
    })
  })

  it('returns error for unknown command /foobar', () => {
    const result = parseSlashCommand('/foobar', { isStreaming: false })
    expect(result).toEqual({
      type: 'error',
      message: 'Unknown command: /foobar. Type /help for available commands.',
    })
  })

  it('is case-insensitive: /CLEAR works same as /clear', () => {
    const result = parseSlashCommand('/CLEAR', { isStreaming: false })
    expect(result).toEqual({ type: 'clear' })
  })

  it('is case-insensitive: /REVIEW works same as /review', () => {
    const result = parseSlashCommand('/REVIEW src/file.ts', { isStreaming: false })
    expect(result).toEqual({ type: 'review', scope: 'src/file.ts' })
  })

  it('handles leading whitespace before slash', () => {
    const result = parseSlashCommand('  /clear', { isStreaming: false })
    expect(result).toEqual({ type: 'clear' })
  })

  it('handles multiple spaces between command and args', () => {
    const result = parseSlashCommand('/review   src/file.ts', { isStreaming: false })
    expect(result).toEqual({ type: 'review', scope: 'src/file.ts' })
  })
})

describe('isSlashInput', () => {
  it('returns true for "/"', () => {
    expect(isSlashInput('/')).toBe(true)
  })

  it('returns true for "/clear"', () => {
    expect(isSlashInput('/clear')).toBe(true)
  })

  it('returns false for "hello"', () => {
    expect(isSlashInput('hello')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isSlashInput('')).toBe(false)
  })

  it('returns true for leading whitespace then slash', () => {
    expect(isSlashInput('  /clear')).toBe(true)
  })

  it('returns false for slash not at start', () => {
    expect(isSlashInput('hello /clear')).toBe(false)
  })
})

describe('getCommandSuggestions', () => {
  it('returns [/clear] for partial "/cl"', () => {
    const result = getCommandSuggestions('/cl')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('/clear')
  })

  it('returns [/clear] for partial "/clear"', () => {
    const result = getCommandSuggestions('/clear')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('/clear')
  })

  it('returns [/review] for partial "/rev"', () => {
    const result = getCommandSuggestions('/rev')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('/review')
  })

  it('returns [/restart] for partial "/res"', () => {
    const result = getCommandSuggestions('/res')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('/restart')
  })

  it('returns [/help] for partial "/h"', () => {
    const result = getCommandSuggestions('/h')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('/help')
  })

  it('returns empty array for non-matching partial "/xyz"', () => {
    const result = getCommandSuggestions('/xyz')
    expect(result).toHaveLength(0)
  })

  it('is case-insensitive: "/CL" matches /clear', () => {
    const result = getCommandSuggestions('/CL')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('/clear')
  })

  it('returns all commands for partial "/"', () => {
    const result = getCommandSuggestions('/')
    expect(result).toHaveLength(4)
    expect(result.map((cmd) => cmd.name)).toEqual(['/clear', '/review', '/restart', '/help'])
  })
})

describe('SLASH_COMMANDS registry', () => {
  it('contains exactly 4 commands', () => {
    expect(SLASH_COMMANDS).toHaveLength(4)
  })

  it('has /clear command with correct properties', () => {
    const clearCmd = SLASH_COMMANDS.find((cmd) => cmd.name === '/clear')
    expect(clearCmd).toBeDefined()
    expect(clearCmd?.description).toBe('Clear all messages in current workspace chat')
    expect(clearCmd?.usage).toBe('/clear')
  })

  it('has /review command with correct properties', () => {
    const reviewCmd = SLASH_COMMANDS.find((cmd) => cmd.name === '/review')
    expect(reviewCmd).toBeDefined()
    expect(reviewCmd?.description).toBe('AI code review of current workspace changes')
    expect(reviewCmd?.usage).toBe('/review [file-path]')
  })

  it('has /restart command with correct properties', () => {
    const restartCmd = SLASH_COMMANDS.find((cmd) => cmd.name === '/restart')
    expect(restartCmd).toBeDefined()
    expect(restartCmd?.description).toBe('Restart the agent process for current workspace')
    expect(restartCmd?.usage).toBe('/restart')
  })

  it('has /help command with correct properties', () => {
    const helpCmd = SLASH_COMMANDS.find((cmd) => cmd.name === '/help')
    expect(helpCmd).toBeDefined()
    expect(helpCmd?.description).toBe('Show available commands')
    expect(helpCmd?.usage).toBe('/help')
  })
})

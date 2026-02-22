import { describe, expect, it } from 'vitest'
import { summarizeDroppedMessages } from '../chatSummarizer'
import type { Message } from '../../stores/chatStore'

describe('chatSummarizer - summarize dropped messages', () => {
  const createMessage = (
    role: 'user' | 'assistant' | 'system',
    content: string,
    index: number,
    extras?: Partial<Message>
  ): Message => ({
    id: `msg-${index}`,
    role,
    content,
    timestamp: new Date(Date.now() + index * 1000),
    ...extras,
  })

  it('returns empty string for empty messages array', () => {
    const result = summarizeDroppedMessages([])
    expect(result).toBe('')
  })

  it('extracts user topics from user messages', () => {
    const messages: Message[] = [
      createMessage('user', 'How do I configure Tailwind?', 0),
      createMessage('assistant', 'You can configure it in tailwind.config.ts', 1),
      createMessage('user', 'What about dark mode support?', 2),
      createMessage('assistant', 'Add darkMode: "class" to the config', 3),
    ]

    const result = summarizeDroppedMessages(messages)

    expect(result).toContain('[Context from earlier conversation]')
    expect(result).toContain('How do I configure Tailwind?')
    expect(result).toContain('What about dark mode support?')
  })

  it('extracts file paths mentioned in messages', () => {
    const messages: Message[] = [
      createMessage('user', 'Can you update src/components/Button.tsx?', 0),
      createMessage(
        'assistant',
        'I updated src/components/Button.tsx and also src/styles/theme.ts',
        1
      ),
    ]

    const result = summarizeDroppedMessages(messages)

    expect(result).toContain('src/components/Button.tsx')
    expect(result).toContain('src/styles/theme.ts')
  })

  it('extracts tool names from assistant messages with toolUses', () => {
    const messages: Message[] = [
      createMessage('user', 'Read the config file', 0),
      createMessage('assistant', 'Here is the content', 1, {
        toolUses: [
          { id: 't1', name: 'read_file', input: { path: 'config.ts' }, status: 'completed' },
          { id: 't2', name: 'write_file', input: { path: 'config.ts' }, status: 'completed' },
        ],
      }),
    ]

    const result = summarizeDroppedMessages(messages)

    expect(result).toContain('read_file')
    expect(result).toContain('write_file')
  })

  it('truncates summary to max 500 characters with ellipsis', () => {
    const messages: Message[] = Array.from({ length: 50 }, (_, i) =>
      createMessage(
        i % 2 === 0 ? 'user' : 'assistant',
        `This is a fairly long message number ${i} with content about topic ${i} that goes on and on`,
        i
      )
    )

    const result = summarizeDroppedMessages(messages)

    expect(result.length).toBeLessThanOrEqual(500)
    if (result.length === 500) {
      expect(result).toMatch(/\.\.\.$/)
    }
  })

  it('handles messages with no meaningful content', () => {
    const messages: Message[] = [createMessage('system', 'You are a helpful assistant', 0)]

    const result = summarizeDroppedMessages(messages)

    // System-only messages with no user questions, no files, no tools = empty
    expect(result).toBe('')
  })

  it('deduplicates file paths and tool names', () => {
    const messages: Message[] = [
      createMessage('user', 'Edit src/App.tsx', 0),
      createMessage('assistant', 'Done with src/App.tsx', 1, {
        toolUses: [{ id: 't1', name: 'read_file', input: {}, status: 'completed' }],
      }),
      createMessage('user', 'Now also fix src/App.tsx for the import', 2),
      createMessage('assistant', 'Fixed', 3, {
        toolUses: [{ id: 't2', name: 'read_file', input: {}, status: 'completed' }],
      }),
    ]

    const result = summarizeDroppedMessages(messages)
    const codeDiscussedLine = result.split('\n').find((l) => l.startsWith('- Code discussed:')) || ''
    const fileMatches = codeDiscussedLine.match(/src\/App\.tsx/g)
    expect(fileMatches?.length).toBe(1)
    const toolsLine = result.split('\n').find((l) => l.startsWith('- Tools used:')) || ''
    const toolMatches = toolsLine.match(/read_file/g)
    expect(toolMatches?.length).toBe(1)
  })

  it('extracts file paths with various extensions (.ts, .tsx, .css, .json)', () => {
    const messages: Message[] = [
      createMessage('user', 'Check package.json and src/index.css', 0),
      createMessage('assistant', 'I also looked at tsconfig.json and lib/utils.ts', 1),
    ]

    const result = summarizeDroppedMessages(messages)

    expect(result).toContain('package.json')
    expect(result).toContain('src/index.css')
    expect(result).toContain('tsconfig.json')
    expect(result).toContain('lib/utils.ts')
  })
})

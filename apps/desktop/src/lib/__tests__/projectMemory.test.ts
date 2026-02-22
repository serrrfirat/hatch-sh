import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { readProjectMemory, writeProjectMemory } from '../projectMemory'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('projectMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('readProjectMemory', () => {
    it('reads project memory from .hatch/context.md', async () => {
      const invokeMock = vi.mocked(invoke)
      const mockContent = '# Project Context\n\nThis is my project memory.'
      invokeMock.mockResolvedValueOnce({ content: mockContent })

      const result = await readProjectMemory('/path/to/workspace')

      expect(invokeMock).toHaveBeenCalledWith('read_file', {
        filePath: '/path/to/workspace/.hatch/context.md',
      })
      expect(result).toBe(mockContent)
    })

    it('returns null when file does not exist', async () => {
      const invokeMock = vi.mocked(invoke)
      invokeMock.mockRejectedValueOnce(new Error('File not found'))

      const result = await readProjectMemory('/path/to/workspace')

      expect(result).toBeNull()
    })

    it('returns null on any read error', async () => {
      const invokeMock = vi.mocked(invoke)
      invokeMock.mockRejectedValueOnce(new Error('Permission denied'))

      const result = await readProjectMemory('/path/to/workspace')

      expect(result).toBeNull()
    })
  })

  describe('writeProjectMemory', () => {
    it('writes project memory to .hatch/context.md', async () => {
      const invokeMock = vi.mocked(invoke)
      invokeMock.mockResolvedValueOnce([
        { path: '.hatch/context.md', success: true, size: 42, error: null },
      ])

      const content = '# Project Context\n\nMy notes.'
      await writeProjectMemory('/path/to/workspace', content)

      expect(invokeMock).toHaveBeenCalledWith('write_project_files', {
        baseDir: '/path/to/workspace',
        files: [{ path: '.hatch/context.md', content }],
      })
    })

    it('creates .hatch directory if it does not exist', async () => {
      const invokeMock = vi.mocked(invoke)
      invokeMock.mockResolvedValueOnce([
        { path: '.hatch/context.md', success: true, size: 100, error: null },
      ])

      const content = 'Memory content'
      await writeProjectMemory('/path/to/workspace', content)

      // The write_project_files command handles directory creation
      expect(invokeMock).toHaveBeenCalledWith('write_project_files', {
        baseDir: '/path/to/workspace',
        files: [{ path: '.hatch/context.md', content }],
      })
    })

    it('throws error if write fails', async () => {
      const invokeMock = vi.mocked(invoke)
      invokeMock.mockResolvedValueOnce([
        {
          path: '.hatch/context.md',
          success: false,
          size: 0,
          error: 'Permission denied',
        },
      ])

      const content = 'Memory content'
      await expect(writeProjectMemory('/path/to/workspace', content)).rejects.toThrow(
        'Failed to write project memory: .hatch/context.md (Permission denied)'
      )
    })
  })
})

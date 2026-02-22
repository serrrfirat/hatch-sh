import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { writeCodeBlocksToWorkspace } from '../fileWriter'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('writeCodeBlocksToWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes files and returns manifest with sizes', async () => {
    const invokeMock = vi.mocked(invoke)
    invokeMock.mockResolvedValueOnce([
      { path: 'src/App.tsx', success: true, size: 42, error: null },
      { path: 'src/utils/math.ts', success: true, size: 12, error: null },
    ])

    const result = await writeCodeBlocksToWorkspace(
      [
        { filePath: 'src/App.tsx', content: 'export default function App() { return null }' },
        {
          filePath: 'src/utils/math.ts',
          content: 'export const add = (a: number, b: number) => a + b',
        },
      ],
      '/tmp/workspace'
    )

    expect(invokeMock).toHaveBeenCalledWith('write_project_files', {
      baseDir: '/tmp/workspace',
      files: [
        { path: 'src/App.tsx', content: 'export default function App() { return null }' },
        {
          path: 'src/utils/math.ts',
          content: 'export const add = (a: number, b: number) => a + b',
        },
      ],
    })
    expect(result).toEqual([
      { path: 'src/App.tsx', size: 42 },
      { path: 'src/utils/math.ts', size: 12 },
    ])
  })

  it('returns empty manifest and skips invoke for empty blocks', async () => {
    const invokeMock = vi.mocked(invoke)

    const result = await writeCodeBlocksToWorkspace([], '/tmp/workspace')

    expect(invokeMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('treats overwrite writes as successful and keeps latest size', async () => {
    const invokeMock = vi.mocked(invoke)
    invokeMock.mockResolvedValueOnce([
      { path: 'src/App.tsx', success: true, size: 99, error: null },
    ])

    const result = await writeCodeBlocksToWorkspace(
      [{ filePath: 'src/App.tsx', content: 'export const version = 2' }],
      '/tmp/workspace'
    )

    expect(result).toEqual([{ path: 'src/App.tsx', size: 99 }])
  })

  it('propagates directory creation failures from backend command', async () => {
    const invokeMock = vi.mocked(invoke)
    invokeMock.mockResolvedValueOnce([
      {
        path: 'nested/path/App.tsx',
        success: false,
        size: 0,
        error: 'Failed to create parent directories',
      },
    ])

    await expect(
      writeCodeBlocksToWorkspace(
        [{ filePath: 'nested/path/App.tsx', content: 'export default 1' }],
        '/tmp/workspace'
      )
    ).rejects.toThrow(
      'Failed to write 1 file(s): nested/path/App.tsx (Failed to create parent directories)'
    )
  })
})

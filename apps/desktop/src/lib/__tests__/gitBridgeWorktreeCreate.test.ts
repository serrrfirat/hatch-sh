import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

import { worktreeCreate } from '../git/bridge'

describe('worktreeCreate response normalization', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('accepts camelCase response from worktree_create', async () => {
    invokeMock.mockResolvedValue({
      branchName: 'workspace/pikachu',
      worktreePath: '/tmp/repo/worktrees/pikachu',
    })

    const result = await worktreeCreate('/tmp/repo', 'pikachu')

    expect(result).toEqual({
      branch_name: 'workspace/pikachu',
      worktree_path: '/tmp/repo/worktrees/pikachu',
    })
  })

  it('accepts snake_case response from worktree_create', async () => {
    invokeMock.mockResolvedValue({
      branch_name: 'workspace/psyduck',
      worktree_path: '/tmp/repo/worktrees/psyduck',
    })

    const result = await worktreeCreate('/tmp/repo', 'psyduck')

    expect(result).toEqual({
      branch_name: 'workspace/psyduck',
      worktree_path: '/tmp/repo/worktrees/psyduck',
    })
  })

  it('throws when response is missing required fields', async () => {
    invokeMock.mockResolvedValue({ branchName: 'workspace/missing-path' })

    await expect(worktreeCreate('/tmp/repo', 'missing-path')).rejects.toThrow(
      'Invalid worktree_create response: missing branchName/worktreePath'
    )
  })
})

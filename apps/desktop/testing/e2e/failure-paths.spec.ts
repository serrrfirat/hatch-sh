import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockZustandPersist, createGitBridgeMock, createGitHubBridgeMock } from '../helpers'
import { createTestRepository, createTestWorkspace, createDefaultRepositoryState } from '../helpers'

vi.mock('zustand/middleware', async () => mockZustandPersist())
vi.mock('../../src/lib/git/bridge', () => createGitBridgeMock())
vi.mock('../../src/lib/github/bridge', () => createGitHubBridgeMock())

import { useRepositoryStore } from '../../src/stores/repositoryStore'
import * as gitBridge from '../../src/lib/git/bridge'

describe('failure path matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useRepositoryStore.setState(
      createDefaultRepositoryState({
        repositories: [createTestRepository({ id: 'repo-1' })],
        workspaces: [
          createTestWorkspace({
            id: 'ws-1',
            repositoryId: 'repo-1',
          }),
        ],
      })
    )
  })

  it('marks workspace as error when git push fails', async () => {
    vi.mocked(gitBridge.pushChanges).mockRejectedValue(new Error('missing upstream'))

    await expect(useRepositoryStore.getState().pushChanges('ws-1')).rejects.toThrow('missing upstream')

    const ws = useRepositoryStore.getState().workspaces.find((w) => w.id === 'ws-1')
    expect(ws?.status).toBe('error')
  })

  it('keeps PR metadata unset when push fails before PR creation', async () => {
    vi.mocked(gitBridge.pushChanges).mockRejectedValue(new Error('auth expired'))

    await expect(
      useRepositoryStore.getState().createPullRequest('ws-1', 'title', 'body')
    ).rejects.toThrow('auth expired')

    const ws = useRepositoryStore.getState().workspaces.find((w) => w.id === 'ws-1')
    expect(ws?.prNumber).toBeUndefined()
    expect(ws?.prUrl).toBeUndefined()
    expect(ws?.prState).toBeUndefined()
  })

  it('throws clean error when merge requested with no associated PR', async () => {
    await expect(useRepositoryStore.getState().mergePullRequest('ws-1')).rejects.toThrow(
      'No PR associated with this workspace'
    )
  })

  it('recovers workspace status from error to idle on successful operation', async () => {
    // Start in error state
    useRepositoryStore.getState().updateWorkspaceStatus('ws-1', 'error')
    const errorWs = useRepositoryStore.getState().workspaces.find((w) => w.id === 'ws-1')
    expect(errorWs?.status).toBe('error')

    // Successful commit should recover to idle
    vi.mocked(gitBridge.commitChanges).mockResolvedValue('abc123')
    await useRepositoryStore.getState().commitChanges('ws-1', 'fix: recover')

    const recoveredWs = useRepositoryStore.getState().workspaces.find((w) => w.id === 'ws-1')
    expect(recoveredWs?.status).toBe('idle')
  })

  it('surfaces clone failure without corrupting repository list', async () => {
    vi.mocked(gitBridge.cloneRepo).mockRejectedValue(new Error('network timeout'))
    vi.mocked(gitBridge.extractRepoName).mockReturnValue('test-repo')

    const reposBefore = useRepositoryStore.getState().repositories.length

    await expect(useRepositoryStore.getState().cloneRepository('https://github.com/test/repo')).rejects.toThrow(
      'network timeout'
    )

    expect(useRepositoryStore.getState().repositories.length).toBe(reposBefore)
    expect(useRepositoryStore.getState().isCloning).toBe(false)
  })
})

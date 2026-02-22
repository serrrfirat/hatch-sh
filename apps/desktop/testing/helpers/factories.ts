/**
 * Test data factories for unit tests.
 * Provides consistent test data across all test suites.
 */

import type { Workspace } from '../../src/stores/repositoryStore'
import type { Repository } from '../../src/lib/git/bridge'

let counter = 0
function nextId(prefix: string) {
  return `${prefix}-${++counter}`
}

export function resetFactoryCounter() {
  counter = 0
}

export function createTestRepository(overrides: Partial<Repository> = {}): Repository {
  const id = nextId('repo')
  return {
    id,
    name: 'hatch-sh',
    full_name: 'serrrfirat/hatch-sh',
    clone_url: 'https://github.com/serrrfirat/hatch-sh.git',
    local_path: '/tmp/hatch-sh',
    default_branch: 'master',
    is_private: false,
    ...overrides,
  }
}

export function createTestWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  const id = overrides.id || nextId('ws')
  return {
    id,
    repositoryId: 'repo-1',
    branchName: id,
    localPath: `/tmp/hatch-sh/.worktrees/${id}`,
    repoPath: '/tmp/hatch-sh',
    status: 'idle',
    lastActive: new Date(),
    agentId: 'claude-code',
    ...overrides,
  }
}

export interface TestMoodboardNode {
  type: 'text'
  id: string
  text: string
}

export function createTestMoodboardContent(text: string): TestMoodboardNode {
  return {
    type: 'text',
    id: crypto.randomUUID(),
    text,
  }
}

/**
 * Creates the default repository store state used across most test suites.
 */
export function createDefaultRepositoryState(overrides: Record<string, unknown> = {}) {
  return {
    githubAuth: null,
    isAuthenticating: false,
    authError: null,
    repositories: [createTestRepository({ id: 'repo-1' })],
    currentRepository: null,
    workspaces: [] as Workspace[],
    currentWorkspace: null,
    isCloning: false,
    cloneProgress: null,
    ...overrides,
  }
}

/**
 * Creates the default chat store state.
 */
export function createDefaultChatState(overrides: Record<string, unknown> = {}) {
  return {
    messagesByWorkspace: {},
    currentWorkspaceId: null,
    isLoading: false,
    currentProjectId: null,
    pendingOpenPR: null,
    ...overrides,
  }
}

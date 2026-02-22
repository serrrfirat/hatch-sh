/**
 * Shared mock setup for unit tests.
 * Call these before importing stores to ensure mocks are applied.
 */

import { vi } from 'vitest'

/**
 * Mock zustand persist middleware to bypass localStorage in tests.
 * Must be called at the top of test files BEFORE store imports.
 *
 * Usage:
 *   vi.mock('zustand/middleware', async () => mockZustandPersist())
 */
export async function mockZustandPersist() {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware')
  return {
    ...actual,
    persist: ((stateCreator: unknown) => stateCreator) as typeof actual.persist,
  }
}

/**
 * Git bridge mock factory — returns a mock object compatible with vi.mock.
 */
export function createGitBridgeMock() {
  return {
    createWorkspaceBranch: vi.fn(),
    deleteWorkspaceBranch: vi.fn(),
    getGitStatus: vi.fn(),
    commitChanges: vi.fn(),
    pushChanges: vi.fn(),
    createPR: vi.fn(),
    mergePullRequest: vi.fn(),
    cloneRepo: vi.fn(),
    extractRepoName: vi.fn(),
    openLocalRepo: vi.fn(),
    createGitHubRepo: vi.fn(),
  }
}

/**
 * GitHub bridge mock factory.
 */
export function createGitHubBridgeMock() {
  return {
    getAuthState: vi.fn(),
    startDeviceFlow: vi.fn(),
    pollForToken: vi.fn(),
    signOut: vi.fn(),
  }
}

/**
 * Tauri API mock factories.
 */
export function createTauriCoreMock() {
  return {
    invoke: vi.fn(),
  }
}

export function createTauriEventMock() {
  return {
    listen: vi.fn(),
  }
}

/**
 * Idea Maze storage mock factory.
 */
export function createIdeaMazeStorageMock() {
  return {
    initializeStorage: vi.fn().mockResolvedValue(undefined),
    saveMoodboard: vi.fn().mockResolvedValue(undefined),
    loadAllMoodboards: vi.fn().mockResolvedValue([]),
    deleteMoodboard: vi.fn().mockResolvedValue(undefined),
    migrateFromLocalStorage: vi.fn().mockResolvedValue([]),
    saveImageForAIContext: vi.fn().mockResolvedValue('/tmp/img.png'),
  }
}

/**
 * Setup localStorage mock for tests that need it.
 */
export function setupLocalStorageMock() {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    configurable: true,
  })
}

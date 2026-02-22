import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockZustandPersist,
  createGitBridgeMock,
  setupLocalStorageMock,
  createDefaultRepositoryState,
  createDefaultChatState,
  createTestRepository,
} from '../helpers'

setupLocalStorageMock()

// vi.hoisted ensures these are available when vi.mock factories run (hoisted)
const {
  mockCheckGhInstalled,
  mockLogin,
  mockGetAuthState,
  mockSignOut,
  mockValidateToken,
} = vi.hoisted(() => ({
  mockCheckGhInstalled: vi.fn(),
  mockLogin: vi.fn(),
  mockGetAuthState: vi.fn(),
  mockSignOut: vi.fn(),
  mockValidateToken: vi.fn(),
}))

vi.mock('zustand/middleware', async () => mockZustandPersist())
vi.mock('../../src/lib/git/bridge', () => createGitBridgeMock())
vi.mock('../../src/lib/github/bridge', () => ({
  checkGhInstalled: mockCheckGhInstalled,
  login: mockLogin,
  getAuthState: mockGetAuthState,
  signOut: mockSignOut,
  validateToken: mockValidateToken,
}))

import { useRepositoryStore } from '../../src/stores/repositoryStore'
import { useChatStore } from '../../src/stores/chatStore'

describe('GitHub auth via gh CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepositoryStore.setState(
      createDefaultRepositoryState({
        repositories: [createTestRepository({ id: 'repo-1' })],
      })
    )
    useChatStore.setState(createDefaultChatState())
  })

  describe('gh CLI detection', () => {
    it('checkGhInstalled sets isGhInstalled to true when gh is available', async () => {
      mockCheckGhInstalled.mockResolvedValue(true)

      await useRepositoryStore.getState().checkGhInstalled()
      expect(mockCheckGhInstalled).toHaveBeenCalled()
      expect(useRepositoryStore.getState().isGhInstalled).toBe(true)
    })

    it('checkGhInstalled sets isGhInstalled to false when gh is not found', async () => {
      mockCheckGhInstalled.mockResolvedValue(false)

      await useRepositoryStore.getState().checkGhInstalled()
      expect(useRepositoryStore.getState().isGhInstalled).toBe(false)
    })
  })

  describe('login flow', () => {
    it('loginWithGitHub calls bridge.login and sets githubAuth on success', async () => {
      mockLogin.mockResolvedValue({
        is_authenticated: true,
        access_token: 'gho_abc123',
        user: { login: 'testuser', id: 1, avatar_url: 'https://...' },
      })

      await useRepositoryStore.getState().loginWithGitHub()

      expect(mockLogin).toHaveBeenCalled()
      const state = useRepositoryStore.getState()
      expect(state.githubAuth?.is_authenticated).toBe(true)
      expect(state.githubAuth?.user?.login).toBe('testuser')
      expect(state.isAuthenticating).toBe(false)
    })

    it('loginWithGitHub sets error on failure', async () => {
      mockLogin.mockRejectedValue(new Error('gh CLI not installed'))

      await expect(
        useRepositoryStore.getState().loginWithGitHub()
      ).rejects.toThrow('gh CLI not installed')

      const state = useRepositoryStore.getState()
      expect(state.isAuthenticating).toBe(false)
      expect(state.authError).toBe('gh CLI not installed')
    })
  })

  describe('auth state', () => {
    it('checkGitHubAuth calls getAuthState from bridge', async () => {
      mockGetAuthState.mockResolvedValue({
        is_authenticated: true,
        access_token: 'gho_valid',
        user: { login: 'testuser', id: 1, avatar_url: 'https://...' },
      })

      await useRepositoryStore.getState().checkGitHubAuth()
      expect(mockGetAuthState).toHaveBeenCalled()
      expect(useRepositoryStore.getState().githubAuth?.is_authenticated).toBe(true)
    })

    it('checkGitHubAuth returns user info when authenticated', async () => {
      mockGetAuthState.mockResolvedValue({
        is_authenticated: true,
        access_token: 'gho_valid',
        user: { login: 'octocat', id: 42, avatar_url: 'https://avatars.githubusercontent.com/u/42' },
      })

      await useRepositoryStore.getState().checkGitHubAuth()
      const auth = useRepositoryStore.getState().githubAuth
      expect(auth?.user?.login).toBe('octocat')
      expect(auth?.user?.id).toBe(42)
    })

    it('getAuthState returns unauthenticated when not logged in', async () => {
      mockGetAuthState.mockResolvedValue({
        is_authenticated: false,
        access_token: undefined,
        user: undefined,
      })

      await useRepositoryStore.getState().checkGitHubAuth()
      expect(useRepositoryStore.getState().githubAuth?.is_authenticated).toBe(false)
    })
  })

  describe('sign out', () => {
    it('signOut clears auth state', async () => {
      // Set authenticated state first
      useRepositoryStore.setState({
        githubAuth: {
          is_authenticated: true,
          access_token: 'gho_abc',
          user: { login: 'test', id: 1, avatar_url: '' },
        },
      })

      mockSignOut.mockResolvedValue(undefined)
      await useRepositoryStore.getState().signOutGitHub()

      expect(useRepositoryStore.getState().githubAuth).toBeNull()
      expect(mockSignOut).toHaveBeenCalled()
    })
  })
})

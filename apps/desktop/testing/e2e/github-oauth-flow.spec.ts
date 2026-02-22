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
  mockStartDeviceFlow,
  mockPollForToken,
  mockGetAuthState,
  mockSignOut,
  mockValidateToken,
} = vi.hoisted(() => ({
  mockStartDeviceFlow: vi.fn(),
  mockPollForToken: vi.fn(),
  mockGetAuthState: vi.fn(),
  mockSignOut: vi.fn(),
  mockValidateToken: vi.fn(),
}))

vi.mock('zustand/middleware', async () => mockZustandPersist())
vi.mock('../../src/lib/git/bridge', () => createGitBridgeMock())
vi.mock('../../src/lib/github/bridge', () => ({
  startDeviceFlow: mockStartDeviceFlow,
  pollForToken: mockPollForToken,
  getAuthState: mockGetAuthState,
  signOut: mockSignOut,
  validateToken: mockValidateToken,
}))

import { useRepositoryStore } from '../../src/stores/repositoryStore'
import { useChatStore } from '../../src/stores/chatStore'

describe('GitHub OAuth flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepositoryStore.setState(
      createDefaultRepositoryState({
        repositories: [createTestRepository({ id: 'repo-1' })],
      })
    )
    useChatStore.setState(createDefaultChatState())
  })

  describe('device code polling fix', () => {
    it('startDeviceFlow returns device_code in addition to user_code', async () => {
      mockStartDeviceFlow.mockResolvedValue({
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        device_code: 'dev-code-abc',
      })

      const result = await useRepositoryStore.getState().startGitHubLogin()
      expect(result.userCode).toBe('ABCD-1234')
      // After fix, startGitHubLogin should also return deviceCode
      expect(result.deviceCode).toBe('dev-code-abc')
    })

    it('completeGitHubLogin passes device_code to pollForToken, not user_code', async () => {
      mockStartDeviceFlow.mockResolvedValue({
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        device_code: 'dev-code-abc',
      })

      mockPollForToken.mockResolvedValue({
        is_authenticated: true,
        access_token: 'gho_abc123',
        user: { login: 'testuser', id: 1, avatar_url: 'https://...' },
      })

      // Start device flow first
      await useRepositoryStore.getState().startGitHubLogin()
      // Complete login — should pass device_code, not user_code
      await useRepositoryStore.getState().completeGitHubLogin('dev-code-abc')

      expect(mockPollForToken).toHaveBeenCalledWith('dev-code-abc')
    })

    it('pollForToken rejects with clean error on expired_token', async () => {
      mockPollForToken.mockRejectedValue(new Error('Authorization expired. Please try again.'))

      useRepositoryStore.setState({ isAuthenticating: true })
      await expect(
        useRepositoryStore.getState().completeGitHubLogin('dev-code')
      ).rejects.toThrow('Authorization expired')
    })

    it('pollForToken rejects with clean error on access_denied', async () => {
      mockPollForToken.mockRejectedValue(new Error('Access denied by user.'))

      useRepositoryStore.setState({ isAuthenticating: true })
      await expect(
        useRepositoryStore.getState().completeGitHubLogin('dev-code')
      ).rejects.toThrow('Access denied')
    })
  })

  describe('token validation', () => {
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

    it('checkGitHubAuth returns user info when token is valid', async () => {
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

    it('signOut clears token and resets auth state', async () => {
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

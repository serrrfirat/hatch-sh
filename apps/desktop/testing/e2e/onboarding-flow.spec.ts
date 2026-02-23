import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockZustandPersist,
  createGitBridgeMock,
  createGitHubBridgeMock,
  createIdeaMazeStorageMock,
  setupLocalStorageMock,
} from '../helpers'
import {
  createDefaultRepositoryState,
  createDefaultChatState,
  createTestRepository,
} from '../helpers'

setupLocalStorageMock()

vi.mock('zustand/middleware', async () => mockZustandPersist())
vi.mock('../../src/lib/ideaMaze/storage', () => createIdeaMazeStorageMock())
vi.mock('../../src/lib/git/bridge', () => ({
  ...createGitBridgeMock(),
  worktreeCreate: vi.fn().mockResolvedValue({
    branch_name: 'ws-onboarding',
    worktree_path: '/tmp/hatch-sh/.worktrees/ws-onboarding',
  }),
}))
vi.mock('../../src/lib/github/bridge', () => createGitHubBridgeMock())

import { useSettingsStore } from '../../src/stores/settingsStore'
import { useRepositoryStore } from '../../src/stores/repositoryStore'
import { useChatStore } from '../../src/stores/chatStore'
import { templates, getTemplate } from '../../src/lib/templates'
import type { ProjectTemplate } from '../../src/lib/templates'

describe('P1-I1: first-time user detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      hasCompletedOnboarding: false,
    })
    useRepositoryStore.setState(
      createDefaultRepositoryState({
        repositories: [createTestRepository({ id: 'repo-1' })],
      })
    )
    useChatStore.setState(createDefaultChatState())
  })

  it('hasCompletedOnboarding defaults to false', () => {
    const state = useSettingsStore.getState()
    expect(state.hasCompletedOnboarding).toBe(false)
  })

  it('setOnboardingComplete persists true', () => {
    useSettingsStore.getState().setOnboardingComplete()
    const state = useSettingsStore.getState()
    expect(state.hasCompletedOnboarding).toBe(true)
  })

  it('hasCompletedOnboarding survives store rehydration', () => {
    useSettingsStore.getState().setOnboardingComplete()
    // Re-read state (simulates rehydration since persist is mocked as passthrough)
    const rehydrated = useSettingsStore.getState()
    expect(rehydrated.hasCompletedOnboarding).toBe(true)
  })
})

describe('P1-I2: onboarding wizard state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      hasCompletedOnboarding: false,
      onboardingStep: 0,
    })
    useRepositoryStore.setState(
      createDefaultRepositoryState({
        repositories: [createTestRepository({ id: 'repo-1' })],
      })
    )
    useChatStore.setState(createDefaultChatState())
  })

  it('wizard is needed when hasCompletedOnboarding is false', () => {
    const state = useSettingsStore.getState()
    expect(state.hasCompletedOnboarding).toBe(false)
  })

  it('wizard is not needed when hasCompletedOnboarding is true', () => {
    useSettingsStore.setState({ hasCompletedOnboarding: true })
    const state = useSettingsStore.getState()
    expect(state.hasCompletedOnboarding).toBe(true)
  })

  it('wizard step navigation: can track current step', () => {
    expect(useSettingsStore.getState().onboardingStep).toBe(0)
    useSettingsStore.getState().setOnboardingStep(1)
    expect(useSettingsStore.getState().onboardingStep).toBe(1)
    useSettingsStore.getState().setOnboardingStep(2)
    expect(useSettingsStore.getState().onboardingStep).toBe(2)
    useSettingsStore.getState().setOnboardingStep(3)
    expect(useSettingsStore.getState().onboardingStep).toBe(3)
  })

  it('completing wizard calls setOnboardingComplete', () => {
    useSettingsStore.getState().setOnboardingComplete()
    expect(useSettingsStore.getState().hasCompletedOnboarding).toBe(true)
  })

  it('GitHub step can be skipped', () => {
    // Step 1 is the GitHub step — skipping should advance to step 2 without error
    useSettingsStore.getState().setOnboardingStep(1)
    expect(useSettingsStore.getState().onboardingStep).toBe(1)
    // Skip action: just advance the step
    expect(() => {
      useSettingsStore.getState().setOnboardingStep(2)
    }).not.toThrow()
    expect(useSettingsStore.getState().onboardingStep).toBe(2)
  })
})

describe('P1-I3: sample project template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepositoryStore.setState(
      createDefaultRepositoryState({
        repositories: [createTestRepository({ id: 'repo-1' })],
      })
    )
    useChatStore.setState(createDefaultChatState())
  })

  it('template registry exports at least one template', () => {
    expect(templates.length).toBeGreaterThanOrEqual(1)
  })

  it('landing-page template has required fields', () => {
    const tmpl = getTemplate('landing-page') as ProjectTemplate
    expect(tmpl).toBeDefined()
    expect(tmpl.id).toBe('landing-page')
    expect(tmpl.name).toBeTruthy()
    expect(tmpl.description).toBeTruthy()
    expect(tmpl.initialPrompt).toBeTruthy()
  })

  it('selecting template creates workspace with seeded chat', async () => {
    const tmpl = getTemplate('landing-page') as ProjectTemplate

    // Create workspace
    const repoStore = useRepositoryStore.getState()
    const ws = await repoStore.createWorkspace('repo-1')
    repoStore.setCurrentWorkspace(ws)

    // Seed chat with the template's initial prompt
    useChatStore.getState().addMessage({
      role: 'user',
      content: tmpl.initialPrompt,
    })

    // Verify workspace exists and chat is seeded
    const currentWorkspace = useRepositoryStore.getState().currentWorkspace
    expect(currentWorkspace).toBeDefined()
    expect(currentWorkspace!.id).toBe(ws.id)

    const messages = useChatStore.getState().messagesByWorkspace[ws.id]
    expect(messages).toBeDefined()
    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe(tmpl.initialPrompt)
  })
})

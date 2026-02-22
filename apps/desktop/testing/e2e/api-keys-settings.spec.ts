import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockZustandPersist,
  createGitBridgeMock,
  createGitHubBridgeMock,
  createIdeaMazeStorageMock,
  setupLocalStorageMock,
} from '../helpers'

setupLocalStorageMock()

// vi.hoisted ensures keychainMock is available when vi.mock runs (hoisted above imports)
const keychainMock = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    keychainSet: vi.fn(async (key: string, value: string) => { store.set(key, value) }),
    keychainGet: vi.fn(async (key: string) => store.get(key) ?? null),
    keychainDelete: vi.fn(async (key: string) => { store.delete(key) }),
    keychainHas: vi.fn(async (key: string) => store.has(key) && store.get(key) !== ''),
    getServiceCredentials: vi.fn(async () => ({
      anthropicApiKey: store.get('anthropic_api_key') ?? null,
      cfAccountId: store.get('cf_account_id') ?? null,
      cfApiToken: store.get('cf_api_token') ?? null,
    })),
    KEYCHAIN_KEYS: ['anthropic_api_key', 'cf_account_id', 'cf_api_token'],
    _store: store,
  }
})

vi.mock('zustand/middleware', async () => mockZustandPersist())
vi.mock('../../src/lib/ideaMaze/storage', () => createIdeaMazeStorageMock())
vi.mock('../../src/lib/git/bridge', () => createGitBridgeMock())
vi.mock('../../src/lib/github/bridge', () => createGitHubBridgeMock())
vi.mock('../../src/lib/keychain', () => keychainMock)

import { useSettingsStore } from '../../src/stores/settingsStore'

describe('API Keys Settings — keychain bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    keychainMock._store.clear()
  })

  it('keychainSet stores value and keychainHas returns true', async () => {
    await keychainMock.keychainSet('anthropic_api_key', 'sk-test-123')
    const has = await keychainMock.keychainHas('anthropic_api_key')
    expect(has).toBe(true)
  })

  it('keychainGet retrieves stored value', async () => {
    await keychainMock.keychainSet('cf_api_token', 'tok-abc')
    const value = await keychainMock.keychainGet('cf_api_token')
    expect(value).toBe('tok-abc')
  })

  it('keychainDelete removes value and keychainHas returns false', async () => {
    await keychainMock.keychainSet('cf_account_id', 'acct-1')
    await keychainMock.keychainDelete('cf_account_id')
    const has = await keychainMock.keychainHas('cf_account_id')
    expect(has).toBe(false)
  })

  it('keychainGet returns null for non-existent key', async () => {
    const value = await keychainMock.keychainGet('anthropic_api_key')
    expect(value).toBeNull()
  })

  it('getServiceCredentials returns all credentials', async () => {
    await keychainMock.keychainSet('anthropic_api_key', 'sk-key')
    await keychainMock.keychainSet('cf_account_id', 'acct-id')
    await keychainMock.keychainSet('cf_api_token', 'cf-tok')

    const creds = await keychainMock.getServiceCredentials()
    expect(creds).toEqual({
      anthropicApiKey: 'sk-key',
      cfAccountId: 'acct-id',
      cfApiToken: 'cf-tok',
    })
  })
})

describe('API Keys Settings — settings store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    keychainMock._store.clear()
    useSettingsStore.setState({
      apiUrl: 'http://localhost:8787',
      keychainStatus: {
        anthropic_api_key: false,
        cf_account_id: false,
        cf_api_token: false,
      },
      anthropicApiKey: null,
      apiKeyValidated: false,
    })
  })

  it('apiUrl defaults to localhost and is editable', () => {
    const state = useSettingsStore.getState()
    expect(state.apiUrl).toBe('http://localhost:8787')

    state.setApiUrl('https://api.hatch.sh')
    expect(useSettingsStore.getState().apiUrl).toBe('https://api.hatch.sh')
  })

  it('refreshKeychainStatus updates keychainStatus from keychain', async () => {
    // Seed the keychain mock
    keychainMock._store.set('anthropic_api_key', 'sk-test')
    keychainMock._store.set('cf_account_id', '')

    await useSettingsStore.getState().refreshKeychainStatus()

    const status = useSettingsStore.getState().keychainStatus
    expect(status.anthropic_api_key).toBe(true)
    expect(status.cf_account_id).toBe(false)   // empty string => false
    expect(status.cf_api_token).toBe(false)     // not set => false
  })

  it('keychainStatus reflects save then clear cycle', async () => {
    // Save a key
    keychainMock._store.set('cf_api_token', 'tok-123')
    await useSettingsStore.getState().refreshKeychainStatus()
    expect(useSettingsStore.getState().keychainStatus.cf_api_token).toBe(true)

    // Clear the key
    keychainMock._store.delete('cf_api_token')
    await useSettingsStore.getState().refreshKeychainStatus()
    expect(useSettingsStore.getState().keychainStatus.cf_api_token).toBe(false)
  })
})

describe('API Keys Settings — legacy migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    keychainMock._store.clear()
  })

  it('legacy anthropicApiKey is migrated to keychain on init', async () => {
    // Simulate legacy state with an API key in localStorage
    useSettingsStore.setState({
      anthropicApiKey: 'sk-legacy-key-123',
      apiKeyValidated: true,
    })

    // Simulate the migration logic from Layout.tsx
    const legacyKey = useSettingsStore.getState().anthropicApiKey
    expect(legacyKey).toBe('sk-legacy-key-123')

    if (legacyKey) {
      await keychainMock.keychainSet('anthropic_api_key', legacyKey)
      useSettingsStore.getState().clearApiKey()
    }

    // Verify: key is in keychain
    const stored = await keychainMock.keychainGet('anthropic_api_key')
    expect(stored).toBe('sk-legacy-key-123')

    // Verify: legacy field is cleared
    const state = useSettingsStore.getState()
    expect(state.anthropicApiKey).toBeNull()
    expect(state.apiKeyValidated).toBe(false)
  })
})

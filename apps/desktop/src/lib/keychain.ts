import { invoke } from '@tauri-apps/api/core'

/** Keys that can be stored in the OS keychain. */
export type KeychainKey = 'anthropic_api_key' | 'cf_account_id' | 'cf_api_token' | 'herenow_api_token' | 'railway_api_token'

/** All keychain key names, for iteration. */
export const KEYCHAIN_KEYS: KeychainKey[] = ['anthropic_api_key', 'cf_account_id', 'cf_api_token', 'herenow_api_token', 'railway_api_token']

/** Store a secret in the OS keychain. */
export async function keychainSet(key: KeychainKey, value: string): Promise<void> {
  await invoke('keychain_set', { key, value })
}

/** Retrieve a secret from the OS keychain. Returns null if not set. */
export async function keychainGet(key: KeychainKey): Promise<string | null> {
  return invoke<string | null>('keychain_get', { key })
}

/** Delete a secret from the OS keychain. */
export async function keychainDelete(key: KeychainKey): Promise<void> {
  await invoke('keychain_delete', { key })
}

/** Check if a key exists in the OS keychain with a non-empty value. */
export async function keychainHas(key: KeychainKey): Promise<boolean> {
  return invoke<boolean>('keychain_has', { key })
}

/** Fetch all service credentials from the keychain. */
export async function getServiceCredentials(): Promise<{
  anthropicApiKey: string | null
  cfAccountId: string | null
  cfApiToken: string | null
  herenowApiToken: string | null
  railwayApiToken: string | null
}> {
  const [anthropicApiKey, cfAccountId, cfApiToken, herenowApiToken, railwayApiToken] = await Promise.all([
    keychainGet('anthropic_api_key'),
    keychainGet('cf_account_id'),
    keychainGet('cf_api_token'),
    keychainGet('herenow_api_token'),
    keychainGet('railway_api_token'),
  ])
  return { anthropicApiKey, cfAccountId, cfApiToken, herenowApiToken, railwayApiToken }
}

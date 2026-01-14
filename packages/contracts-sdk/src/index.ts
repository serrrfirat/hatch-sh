/**
 * Vibed.fun Contracts SDK
 *
 * A TypeScript SDK for creating and trading bonding curve tokens on Base.
 *
 * ## Two Client Options
 *
 * This SDK provides two different client implementations:
 *
 * ### 1. `createVibedClient` (Recommended for Production)
 * Uses Mint Club V2 protocol (CertiK Audited) under the hood.
 * - Battle-tested smart contracts
 * - Professionally audited
 * - Shared liquidity ecosystem
 *
 * ### 2. `createBondingCurveReadClient` / `createBondingCurveWriteClient` (Custom Contracts)
 * Uses vibed.fun's custom BondingCurve.sol contract.
 * - Full control over contract behavior
 * - Custom graduation logic
 * - Requires deployment before use (see addresses.ts)
 *
 * ## Which Should I Use?
 *
 * - **For production**: Use `createVibedClient` - it's built on audited contracts
 * - **For custom deployments**: Use `createBondingCurveWriteClient` after deploying your own contracts
 *
 * @example
 * ```typescript
 * // Recommended: Using Mint Club V2 (audited)
 * import { createVibedClient } from '@vibed/contracts-sdk'
 *
 * const client = createVibedClient('base')
 *
 * // Create a new token
 * await client.createToken({
 *   name: 'My Vibe Token',
 *   symbol: 'MYVIBE',
 *   maxSupply: 1_000_000_000,
 * })
 *
 * // Buy tokens
 * await client.buy({ symbol: 'MYVIBE', ethAmount: '0.1' })
 *
 * // Sell tokens
 * await client.sell({ symbol: 'MYVIBE', tokenAmount: '1000' })
 * ```
 *
 * @example
 * ```typescript
 * // Alternative: Using custom contracts (requires deployment)
 * import { createBondingCurveWriteClient } from '@vibed/contracts-sdk'
 *
 * const client = createBondingCurveWriteClient('baseSepolia', walletClient)
 * await client.createToken({ name: 'Test', symbol: 'TEST', imageUri: '' })
 * ```
 */

// ============================================================================
// PRIMARY CLIENT - Mint Club V2 based (Recommended)
// ============================================================================
export {
  createVibedClient,
  TokenNotFoundError,
  NetworkError,
  type VibedClient,
  type CreateVibeTokenParams,
  type BuyVibeTokenParams,
  type SellVibeTokenParams,
  type TransactionCallbacks,
  type VibeTokenInfo,
} from './vibed-client'

// Constants for Mint Club integration
export {
  MINT_CLUB_ADDRESSES,
  RESERVE_TOKENS,
  DEFAULT_CURVE_CONFIG,
  type SupportedChain,
} from './constants'

// Re-export Mint Club SDK for advanced usage
export { mintclub } from 'mint.club-v2-sdk'

// ============================================================================
// CUSTOM CONTRACT CLIENT - For self-deployed BondingCurve.sol
// ============================================================================
// Use these if you've deployed your own BondingCurve contract and updated
// the addresses in addresses.ts. Otherwise, use createVibedClient above.
export {
  createBondingCurveReadClient,
  createBondingCurveWriteClient,
  createVibeTokenClient,
  type BondingCurveReadClient,
  type BondingCurveWriteClient,
  type VibeTokenClient,
  type TokenInfo,
  type CreateTokenParams,
  type BuyParams,
  type SellParams,
  type TransactionResult,
} from './client'

export { bondingCurveAbi, vibeTokenAbi } from './abi'

export {
  addresses,
  chainIds,
  getAddresses,
  getAddressesUnchecked,
  isDeployed,
  isValidChainId,
  AddressNotConfiguredError,
  type ChainId,
  type ContractAddresses,
} from './addresses'

// ============================================================================
// SHARED UTILITIES
// ============================================================================
// Re-export useful viem utilities
export { parseEther, formatEther, type Address, type Hash } from 'viem'

/**
 * Hatch.sh SDK - Wrapper around Mint Club V2 (CertiK Audited)
 *
 * This SDK provides a simplified interface for creating and trading
 * bonding curve tokens on Base using the audited Mint Club V2 protocol.
 */

import { mintclub } from 'mint.club-v2-sdk'
import { formatEther, parseEther, type Hash, type Address } from 'viem'
import {
  RESERVE_TOKENS,
  DEFAULT_CURVE_CONFIG,
  type SupportedChain,
} from './constants'

export interface CreateHatchTokenParams {
  /** Token name (e.g., "My Vibe Token") */
  name: string
  /** Token symbol (e.g., "VIBE") */
  symbol: string
  /** Image URI for the token (IPFS or HTTP URL) */
  imageUri?: string
  /** Maximum token supply (default: 1 billion) */
  maxSupply?: number
  /** Initial price in ETH (default: 0.0000001) */
  initialPrice?: number
  /** Final price in ETH when max supply reached (default: 0.001) */
  finalPrice?: number
  /** Tokens to allocate to creator (default: 0) */
  creatorAllocation?: number
  /** Buy royalty percentage (default: 1%) */
  buyRoyalty?: number
  /** Sell royalty percentage (default: 1%) */
  sellRoyalty?: number
}

export interface BuyHatchTokenParams {
  /** Token symbol to buy */
  symbol: string
  /** Amount of ETH to spend */
  ethAmount: string
}

export interface SellHatchTokenParams {
  /** Token symbol to sell */
  symbol: string
  /** Amount of tokens to sell */
  tokenAmount: string
}

export interface TransactionCallbacks {
  /** Called when signature is requested from wallet */
  onSignatureRequest?: () => void
  /** Called when transaction is signed with tx hash */
  onSigned?: (txHash: Hash) => void
  /** Called when transaction succeeds */
  onSuccess?: (receipt: unknown) => void
  /** Called when transaction fails */
  onError?: (error: unknown) => void
}

export interface HatchTokenInfo {
  symbol: string
  name: string
  address: Address
  totalSupply: bigint
  maxSupply: bigint
  reserveBalance: bigint
  priceForNextMint: bigint
}

/**
 * Error thrown when a token is not found
 */
export class TokenNotFoundError extends Error {
  constructor(symbol: string) {
    super(`Token "${symbol}" not found`)
    this.name = 'TokenNotFoundError'
  }
}

/**
 * Error thrown when a network request fails
 */
export class NetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'NetworkError'
  }
}

/**
 * Create the Hatch.sh client for a specific chain
 */
export function createHatchClient(chain: SupportedChain) {
  const networkName = chain === 'base' ? 'base' : 'basesepolia'
  const reserveToken = RESERVE_TOKENS[chain]

  return {
    chain,

    /**
     * Create a new bonding curve token
     */
    async createToken(
      params: CreateHatchTokenParams,
      callbacks?: TransactionCallbacks
    ): Promise<{ txHash?: Hash } | undefined> {
      const {
        name,
        symbol,
        maxSupply = DEFAULT_CURVE_CONFIG.maxSupply,
        initialPrice = 0.0000001,
        finalPrice = 0.001,
        creatorAllocation = 0,
        buyRoyalty = DEFAULT_CURVE_CONFIG.buyRoyalty,
        sellRoyalty = DEFAULT_CURVE_CONFIG.sellRoyalty,
      } = params

      let txHash: Hash | undefined

      try {
        await mintclub.network(networkName).token(symbol).create({
          name,
          reserveToken: {
            address: reserveToken.WETH,
            decimals: reserveToken.decimals,
          },
          curveData: {
            curveType: DEFAULT_CURVE_CONFIG.curveType,
            stepCount: DEFAULT_CURVE_CONFIG.stepCount,
            maxSupply,
            initialMintingPrice: initialPrice,
            finalMintingPrice: finalPrice,
            creatorAllocation,
          },
          buyRoyalty,
          sellRoyalty,
          onSignatureRequest: callbacks?.onSignatureRequest,
          onSigned: (hash: Hash) => {
            txHash = hash
            callbacks?.onSigned?.(hash)
          },
          onSuccess: callbacks?.onSuccess,
          onError: callbacks?.onError,
        })

        return { txHash }
      } catch (error) {
        callbacks?.onError?.(error)
        throw error
      }
    },

    /**
     * Buy tokens with ETH
     */
    async buy(
      params: BuyHatchTokenParams,
      callbacks?: TransactionCallbacks
    ): Promise<Hash | undefined> {
      const { symbol, ethAmount } = params

      let txHash: Hash | undefined

      try {
        await mintclub.network(networkName).token(symbol).buy({
          amount: parseEther(ethAmount),
          onSignatureRequest: callbacks?.onSignatureRequest,
          onSigned: (hash: Hash) => {
            txHash = hash
            callbacks?.onSigned?.(hash)
          },
          onSuccess: callbacks?.onSuccess,
          onError: callbacks?.onError,
        })

        return txHash
      } catch (error) {
        callbacks?.onError?.(error)
        throw error
      }
    },

    /**
     * Sell tokens for ETH
     */
    async sell(
      params: SellHatchTokenParams,
      callbacks?: TransactionCallbacks
    ): Promise<Hash | undefined> {
      const { symbol, tokenAmount } = params

      let txHash: Hash | undefined

      try {
        await mintclub.network(networkName).token(symbol).sell({
          amount: parseEther(tokenAmount),
          onSignatureRequest: callbacks?.onSignatureRequest,
          onSigned: (hash: Hash) => {
            txHash = hash
            callbacks?.onSigned?.(hash)
          },
          onSuccess: callbacks?.onSuccess,
          onError: callbacks?.onError,
        })

        return txHash
      } catch (error) {
        callbacks?.onError?.(error)
        throw error
      }
    },

    /**
     * Get token information
     * @throws NetworkError if there's a network/RPC error (not a "token doesn't exist" error)
     * @returns Token info or null if token doesn't exist
     */
    async getTokenInfo(symbol: string): Promise<HatchTokenInfo | null> {
      try {
        const token = mintclub.network(networkName).token(symbol)
        const detail = await token.getDetail()

        if (!detail) return null

        return {
          symbol: detail.info.symbol,
          name: detail.info.name,
          address: detail.info.token as Address,
          totalSupply: detail.info.currentSupply,
          maxSupply: detail.info.maxSupply,
          reserveBalance: detail.info.reserveBalance,
          priceForNextMint: detail.info.priceForNextMint,
        }
      } catch (error) {
        // Check if this is a "token not found" type error vs a network error
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Common patterns that indicate token doesn't exist (rather than network failure)
        const tokenNotFoundPatterns = [
          'token not found',
          'does not exist',
          'invalid token',
          'not registered',
        ]

        const isTokenNotFoundError = tokenNotFoundPatterns.some(pattern =>
          errorMessage.toLowerCase().includes(pattern)
        )

        if (isTokenNotFoundError) {
          return null
        }

        // For other errors (network issues, RPC failures), throw so caller is aware
        throw new NetworkError(
          `Failed to fetch token info for "${symbol}": ${errorMessage}`,
          error
        )
      }
    },

    /**
     * Get current token price in wei (price for next mint)
     */
    async getPrice(symbol: string): Promise<bigint> {
      const info = await this.getTokenInfo(symbol)
      return info?.priceForNextMint || 0n
    },

    /**
     * Get formatted price in ETH
     */
    async getPriceFormatted(symbol: string): Promise<string> {
      const price = await this.getPrice(symbol)
      return formatEther(price)
    },

    /**
     * Calculate tokens received for ETH amount
     * Returns [tokensOut, reserveUsed]
     */
    async getBuyEstimate(
      symbol: string,
      ethAmount: string
    ): Promise<readonly [bigint, bigint]> {
      const token = mintclub.network(networkName).token(symbol)
      const estimate = await token.getBuyEstimation(parseEther(ethAmount))
      return estimate || [0n, 0n]
    },

    /**
     * Calculate ETH received for selling tokens
     * Returns [ethOut, tokensUsed]
     */
    async getSellEstimate(
      symbol: string,
      tokenAmount: string
    ): Promise<readonly [bigint, bigint]> {
      const token = mintclub.network(networkName).token(symbol)
      const estimate = await token.getSellEstimation(parseEther(tokenAmount))
      return estimate || [0n, 0n]
    },

    /**
     * Check if token exists
     */
    async tokenExists(symbol: string): Promise<boolean> {
      try {
        const token = mintclub.network(networkName).token(symbol)
        return await token.exists()
      } catch {
        return false
      }
    },

    /**
     * Get the underlying Mint Club token helper for advanced usage.
     *
     * Returns the raw Mint Club SDK token helper which provides access to
     * additional methods not exposed by this wrapper. Use with caution.
     *
     * @example
     * ```typescript
     * const helper = client.getTokenHelper('MYVIBE')
     * // Access advanced Mint Club SDK methods
     * const rawDetail = await helper.getDetail()
     * ```
     */
    getTokenHelper(symbol: string): ReturnType<ReturnType<typeof mintclub.network>['token']> {
      return mintclub.network(networkName).token(symbol)
    },
  }
}

export type HatchClient = ReturnType<typeof createHatchClient>

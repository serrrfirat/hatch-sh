import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  parseEther,
  formatEther,
  type PublicClient,
  type WalletClient,
  type Account,
  type Transport,
  type Chain,
  type Hash,
  type Address,
} from 'viem'
import { baseSepolia, base } from 'viem/chains'
import { bondingCurveAbi, hatchTokenAbi } from './abi'
import { addresses, type ChainId } from './addresses'

export interface TokenInfo {
  tokenAddress: Address
  creator: Address
  reserveBalance: bigint
  totalSupply: bigint
  graduated: boolean
  name: string
  symbol: string
  imageUri: string
  createdAt: bigint
}

export interface CreateTokenParams {
  name: string
  symbol: string
  imageUri: string
}

export interface BuyParams {
  tokenAddress: Address
  ethAmount: bigint
  /**
   * Minimum tokens to receive (slippage protection).
   * REQUIRED to prevent front-running attacks. Calculate using calculatePurchaseReturn()
   * and apply your desired slippage tolerance (e.g., expectedTokens * 95n / 100n for 5% slippage).
   * Pass 0n only if you explicitly accept any amount (not recommended).
   */
  minTokensOut: bigint
}

export interface SellParams {
  tokenAddress: Address
  tokenAmount: bigint
  /**
   * Minimum ETH to receive (slippage protection).
   * REQUIRED to prevent front-running attacks. Calculate using calculateSaleReturn()
   * and apply your desired slippage tolerance (e.g., expectedEth * 95n / 100n for 5% slippage).
   * Pass 0n only if you explicitly accept any amount (not recommended).
   */
  minEthOut: bigint
}

export interface TransactionResult {
  hash: Hash
  wait: () => Promise<void>
}

const chains: Record<ChainId, Chain> = {
  base,
  baseSepolia,
}

export interface BondingCurveReadClient {
  client: PublicClient
  contract: unknown
  getAllTokens(): Promise<readonly Address[]>
  getTokenCount(): Promise<bigint>
  getTokenInfo(tokenAddress: Address): Promise<TokenInfo>
  getPrice(tokenAddress: Address): Promise<bigint>
  getPriceFormatted(tokenAddress: Address): Promise<string>
  getMarketCap(tokenAddress: Address): Promise<bigint>
  getMarketCapFormatted(tokenAddress: Address): Promise<string>
  calculatePurchaseReturn(currentSupply: bigint, ethAmount: bigint): Promise<bigint>
  calculateSaleReturn(currentSupply: bigint, tokenAmount: bigint): Promise<bigint>
  getGraduationThreshold(): Promise<bigint>
  getPlatformFee(): Promise<bigint>
}

/**
 * Create a read-only client for the bonding curve contract
 */
export function createBondingCurveReadClient(
  chainId: ChainId,
  rpcUrl?: string
): BondingCurveReadClient {
  const chain = chains[chainId]
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  const contract = getContract({
    address: addresses[chainId].bondingCurve,
    abi: bondingCurveAbi,
    client,
  })

  return {
    client,
    contract,

    /**
     * Get all tokens created
     */
    async getAllTokens(): Promise<readonly Address[]> {
      return contract.read.getAllTokens()
    },

    /**
     * Get token count
     */
    async getTokenCount(): Promise<bigint> {
      return contract.read.getTokenCount()
    },

    /**
     * Get token info
     */
    async getTokenInfo(tokenAddress: Address): Promise<TokenInfo> {
      const result = await contract.read.getTokenInfo([tokenAddress])
      return {
        tokenAddress: result.tokenAddress,
        creator: result.creator,
        reserveBalance: result.reserveBalance,
        totalSupply: result.totalSupply,
        graduated: result.graduated,
        name: result.name,
        symbol: result.symbol,
        imageUri: result.imageUri,
        createdAt: result.createdAt,
      }
    },

    /**
     * Get current token price in wei
     */
    async getPrice(tokenAddress: Address): Promise<bigint> {
      return contract.read.getPrice([tokenAddress])
    },

    /**
     * Get formatted price in ETH
     */
    async getPriceFormatted(tokenAddress: Address): Promise<string> {
      const price = await contract.read.getPrice([tokenAddress])
      return formatEther(price)
    },

    /**
     * Get market cap in wei
     */
    async getMarketCap(tokenAddress: Address): Promise<bigint> {
      return contract.read.getMarketCap([tokenAddress])
    },

    /**
     * Get formatted market cap in ETH
     */
    async getMarketCapFormatted(tokenAddress: Address): Promise<string> {
      const marketCap = await contract.read.getMarketCap([tokenAddress])
      return formatEther(marketCap)
    },

    /**
     * Calculate how many tokens you get for a given ETH amount
     */
    async calculatePurchaseReturn(
      currentSupply: bigint,
      ethAmount: bigint
    ): Promise<bigint> {
      return contract.read.calculatePurchaseReturn([currentSupply, ethAmount])
    },

    /**
     * Calculate how much ETH you get for selling tokens
     */
    async calculateSaleReturn(
      currentSupply: bigint,
      tokenAmount: bigint
    ): Promise<bigint> {
      return contract.read.calculateSaleReturn([currentSupply, tokenAmount])
    },

    /**
     * Get graduation threshold
     */
    async getGraduationThreshold(): Promise<bigint> {
      return contract.read.GRADUATION_THRESHOLD()
    },

    /**
     * Get platform fee (in basis points, 100 = 1%)
     */
    async getPlatformFee(): Promise<bigint> {
      return contract.read.platformFee()
    },
  }
}

export interface BondingCurveWriteClient extends BondingCurveReadClient {
  walletClient: WalletClient<Transport, Chain, Account>
  createToken(params: CreateTokenParams): Promise<TransactionResult>
  buy(params: BuyParams): Promise<TransactionResult>
  buyWithEth(tokenAddress: Address, ethString: string, minTokensOut: bigint): Promise<TransactionResult>
  sell(params: SellParams): Promise<TransactionResult>
}

/**
 * Create a write client for the bonding curve contract
 */
export function createBondingCurveWriteClient(
  chainId: ChainId,
  walletClient: WalletClient<Transport, Chain, Account>,
  rpcUrl?: string
): BondingCurveWriteClient {
  const chain = chains[chainId]
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  const readClient = createBondingCurveReadClient(chainId, rpcUrl)

  return {
    ...readClient,
    walletClient,

    /**
     * Create a new bonding curve token
     */
    async createToken(params: CreateTokenParams): Promise<TransactionResult> {
      const hash = await walletClient.writeContract({
        address: addresses[chainId].bondingCurve,
        abi: bondingCurveAbi,
        functionName: 'createToken',
        args: [params.name, params.symbol, params.imageUri],
      })

      return {
        hash,
        wait: async () => {
          await publicClient.waitForTransactionReceipt({ hash })
        },
      }
    },

    /**
     * Buy tokens from the bonding curve
     * @param params.tokenAddress - Address of the token to buy
     * @param params.ethAmount - Amount of ETH to spend
     * @param params.minTokensOut - Minimum tokens to receive (slippage protection, REQUIRED)
     */
    async buy(params: BuyParams): Promise<TransactionResult> {
      const hash = await walletClient.writeContract({
        address: addresses[chainId].bondingCurve,
        abi: bondingCurveAbi,
        functionName: 'buy',
        args: [params.tokenAddress, params.minTokensOut],
        value: params.ethAmount,
      })

      return {
        hash,
        wait: async () => {
          await publicClient.waitForTransactionReceipt({ hash })
        },
      }
    },

    /**
     * Buy tokens with ETH string (convenience method)
     * @param tokenAddress - Address of the token to buy
     * @param ethString - Amount of ETH as a string (e.g., "0.1")
     * @param minTokensOut - Minimum tokens to receive (slippage protection, REQUIRED)
     */
    async buyWithEth(
      tokenAddress: Address,
      ethString: string,
      minTokensOut: bigint
    ): Promise<TransactionResult> {
      return this.buy({
        tokenAddress,
        ethAmount: parseEther(ethString),
        minTokensOut,
      })
    },

    /**
     * Sell tokens back to the bonding curve
     * @param params.tokenAddress - Address of the token to sell
     * @param params.tokenAmount - Amount of tokens to sell
     * @param params.minEthOut - Minimum ETH to receive (slippage protection, REQUIRED)
     */
    async sell(params: SellParams): Promise<TransactionResult> {
      const hash = await walletClient.writeContract({
        address: addresses[chainId].bondingCurve,
        abi: bondingCurveAbi,
        functionName: 'sell',
        args: [params.tokenAddress, params.tokenAmount, params.minEthOut],
      })

      return {
        hash,
        wait: async () => {
          await publicClient.waitForTransactionReceipt({ hash })
        },
      }
    },
  }
}

export interface HatchTokenClient {
  client: PublicClient
  contract: unknown
  tokenAddress: Address
  name(): Promise<string>
  symbol(): Promise<string>
  decimals(): Promise<number>
  totalSupply(): Promise<bigint>
  balanceOf(account: Address): Promise<bigint>
  balanceOfFormatted(account: Address): Promise<string>
  imageUri(): Promise<string>
}

/**
 * Create a VibeToken client for a specific token
 */
export function createHatchTokenClient(
  tokenAddress: Address,
  chainId: ChainId,
  rpcUrl?: string
): HatchTokenClient {
  const chain = chains[chainId]
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  const contract = getContract({
    address: tokenAddress,
    abi: hatchTokenAbi,
    client,
  })

  return {
    client,
    contract,
    tokenAddress,

    /**
     * Get token name
     */
    async name(): Promise<string> {
      return contract.read.name()
    },

    /**
     * Get token symbol
     */
    async symbol(): Promise<string> {
      return contract.read.symbol()
    },

    /**
     * Get token decimals
     */
    async decimals(): Promise<number> {
      return contract.read.decimals()
    },

    /**
     * Get total supply
     */
    async totalSupply(): Promise<bigint> {
      return contract.read.totalSupply()
    },

    /**
     * Get balance of an address
     */
    async balanceOf(account: Address): Promise<bigint> {
      return contract.read.balanceOf([account])
    },

    /**
     * Get formatted balance
     */
    async balanceOfFormatted(account: Address): Promise<string> {
      const balance = await contract.read.balanceOf([account])
      return formatEther(balance)
    },

    /**
     * Get image URI
     */
    async imageUri(): Promise<string> {
      return contract.read.imageUri()
    },
  }
}


/**
 * Mint Club V2 Contract Addresses (CertiK Audited)
 * Source: https://github.com/Steemhunt/mint.club-v2-contract
 */

export type SupportedChain = 'base' | 'baseSepolia'

// Mint Club V2 Contract Addresses
export const MINT_CLUB_ADDRESSES = {
  base: {
    MCV2_Token: '0xAa70bC79fD1cB4a6FBA717018351F0C3c64B79Df' as const,
    MCV2_MultiToken: '0x6c61918eECcC306D35247338FDcf025af0f6120A' as const,
    MCV2_Bond: '0xc5a076cad94176c2996B32d8466Be1cE757FAa27' as const,
    MCV2_ZapV1: '0x91523b39813F3F4E406ECe406D0bEAaA9dE251fa' as const,
    Locker: '0xA3dCf3Ca587D9929d540868c924f208726DC9aB6' as const,
    MerkleDistributor: '0x1349A9DdEe26Fe16D0D44E35B3CB9B0CA18213a4' as const,
  },
  baseSepolia: {
    // Base Sepolia addresses (Mint Club supports this testnet)
    MCV2_Token: '0xAa70bC79fD1cB4a6FBA717018351F0C3c64B79Df' as const,
    MCV2_MultiToken: '0x6c61918eECcC306D35247338FDcf025af0f6120A' as const,
    MCV2_Bond: '0xc5a076cad94176c2996B32d8466Be1cE757FAa27' as const,
    MCV2_ZapV1: '0x91523b39813F3F4E406ECe406D0bEAaA9dE251fa' as const,
    Locker: '0xA3dCf3Ca587D9929d540868c924f208726DC9aB6' as const,
    MerkleDistributor: '0x1349A9DdEe26Fe16D0D44E35B3CB9B0CA18213a4' as const,
  },
} as const

// Reserve token addresses (WETH)
export const RESERVE_TOKENS = {
  base: {
    WETH: '0x4200000000000000000000000000000000000006' as const,
    decimals: 18,
  },
  baseSepolia: {
    WETH: '0x4200000000000000000000000000000000000006' as const,
    decimals: 18,
  },
} as const

// Default bonding curve configuration for vibed.fun
export const DEFAULT_CURVE_CONFIG = {
  // Graduation threshold in reserve tokens (ETH)
  // 23 ETH @ ~$3000/ETH = ~$69k market cap threshold
  // Note: This is a fixed ETH amount - USD value will fluctuate with ETH price
  graduationThreshold: 23n * 10n ** 18n, // 23 ETH

  // Default royalties (platform fee)
  buyRoyalty: 1, // 1%
  sellRoyalty: 1, // 1%

  // Default max supply
  maxSupply: 1_000_000_000, // 1 billion tokens

  // Curve type
  curveType: 'EXPONENTIAL' as const,

  // Number of price steps (more = smoother curve, more gas)
  stepCount: 100,
} as const

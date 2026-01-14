export type ChainId = 'base' | 'baseSepolia'

export interface ContractAddresses {
  bondingCurve: `0x${string}`
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`

export const addresses: Record<ChainId, ContractAddresses> = {
  baseSepolia: {
    // To be updated after deployment
    bondingCurve: ZERO_ADDRESS,
  },
  base: {
    // Mainnet deployment - to be added
    bondingCurve: ZERO_ADDRESS,
  },
}

export const chainIds: Record<ChainId, number> = {
  baseSepolia: 84532,
  base: 8453,
}

/**
 * Error thrown when contract addresses are not configured for a chain
 */
export class AddressNotConfiguredError extends Error {
  constructor(chainId: ChainId, contractName: string) {
    super(
      `Contract "${contractName}" address not configured for chain "${chainId}". ` +
      `Please deploy the contracts and update the addresses in addresses.ts, ` +
      `or run the update-sdk-addresses script after deployment.`
    )
    this.name = 'AddressNotConfiguredError'
  }
}

/**
 * Get addresses for a chain with runtime validation
 * @throws AddressNotConfiguredError if any address is the zero address
 */
export function getAddresses(chainId: ChainId): ContractAddresses {
  const chainAddresses = addresses[chainId]

  if (chainAddresses.bondingCurve === ZERO_ADDRESS) {
    throw new AddressNotConfiguredError(chainId, 'bondingCurve')
  }

  return chainAddresses
}

/**
 * Get addresses without validation (for checking deployment status)
 */
export function getAddressesUnchecked(chainId: ChainId): ContractAddresses {
  return addresses[chainId]
}

/**
 * Check if contracts are deployed for a chain
 */
export function isDeployed(chainId: ChainId): boolean {
  return addresses[chainId].bondingCurve !== ZERO_ADDRESS
}

export function isValidChainId(chainId: string): chainId is ChainId {
  return chainId === 'base' || chainId === 'baseSepolia'
}

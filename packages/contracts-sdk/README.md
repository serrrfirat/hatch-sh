# @vibed/contracts-sdk

A TypeScript SDK for creating and trading bonding curve tokens on Base, built on top of [Mint Club V2](https://mint.club) (CertiK Audited).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND APP                                    │
│  (React/Next.js + wagmi/rainbowkit for wallet connection)                   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ imports
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         @vibed/contracts-sdk                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  createVibedClient('base' | 'baseSepolia')                          │   │
│  │                                                                      │   │
│  │  • createToken({ name, symbol, maxSupply, ... })                    │   │
│  │  • buy({ symbol, ethAmount })                                       │   │
│  │  • sell({ symbol, tokenAmount })                                    │   │
│  │  • getTokenInfo(symbol)                                             │   │
│  │  • getPrice(symbol)                                                 │   │
│  │  • getBuyEstimate(symbol, ethAmount)                                │   │
│  │  • getSellEstimate(symbol, tokenAmount)                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ wraps
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         mint.club-v2-sdk                                     │
│                    (npm package from Mint Club)                              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ calls via viem
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BASE BLOCKCHAIN (L2)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              MINT CLUB V2 CONTRACTS (CertiK Audited)                │   │
│  │                                                                      │   │
│  │  MCV2_Bond: 0xc5a076cad94176c2996B32d8466Be1cE757FAa27             │   │
│  │  ├── createToken(name, symbol, curveData, ...)                      │   │
│  │  ├── mint(token, amount) [buy]                                      │   │
│  │  ├── burn(token, amount) [sell]                                     │   │
│  │  └── getDetail(token)                                               │   │
│  │                                                                      │   │
│  │  MCV2_Token: 0xAa70bC79fD1cB4a6FBA717018351F0C3c64B79Df            │   │
│  │  └── ERC20 token factory (creates new tokens)                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Bonding Curve

Tokens are priced along an exponential bonding curve:

```
  Price (ETH)
       ▲
       │                                          ╭─────────────────╮
       │                                     ╭────╯                 │
       │                                ╭────╯                      │
       │                           ╭────╯                           │
       │                      ╭────╯                                │
       │                 ╭────╯                                     │
       │            ╭────╯                                          │
       │       ╭────╯                                               │
       │  ╭────╯                                                    │
       │──╯                                                         │
       └──────────────────────────────────────────────────────────▶ Supply
       0                                                    1 Billion
```

- **Buy**: ETH → Tokens (price increases)
- **Sell**: Tokens → ETH (price decreases)
- **Royalties**: 1% on buys, 1% on sells
- **Reserve**: WETH

## Installation

```bash
npm install @vibed/contracts-sdk
# or
pnpm add @vibed/contracts-sdk
```

## Quick Start

```typescript
import { createVibedClient, formatEther } from '@vibed/contracts-sdk'

// Create client (use 'baseSepolia' for testnet)
const client = createVibedClient('base')

// Create a new token
await client.createToken({
  name: 'My Vibe Token',
  symbol: 'MYVIBE',
  maxSupply: 1_000_000_000,
  initialPrice: 0.0000001,
  finalPrice: 0.001,
})

// Buy tokens with ETH
await client.buy({
  symbol: 'MYVIBE',
  ethAmount: '0.1',
})

// Sell tokens for ETH
await client.sell({
  symbol: 'MYVIBE',
  tokenAmount: '1000',
})

// Get token info
const info = await client.getTokenInfo('MYVIBE')
console.log(`Price: ${formatEther(info.priceForNextMint)} ETH`)
```

## API Reference

### `createVibedClient(chain)`

Creates a client for interacting with bonding curve tokens.

```typescript
const client = createVibedClient('base')      // Mainnet
const client = createVibedClient('baseSepolia') // Testnet
```

### `client.createToken(params, callbacks?)`

Creates a new bonding curve token.

```typescript
await client.createToken({
  name: string,              // Token name
  symbol: string,            // Token symbol (unique)
  maxSupply?: number,        // Default: 1 billion
  initialPrice?: number,     // Default: 0.0000001 ETH
  finalPrice?: number,       // Default: 0.001 ETH
  creatorAllocation?: number,// Default: 0
  buyRoyalty?: number,       // Default: 1%
  sellRoyalty?: number,      // Default: 1%
}, {
  onSignatureRequest?: () => void,
  onSigned?: (txHash) => void,
  onSuccess?: (receipt) => void,
  onError?: (error) => void,
})
```

### `client.buy(params, callbacks?)`

Buy tokens with ETH.

```typescript
await client.buy({
  symbol: 'MYVIBE',
  ethAmount: '0.1',  // ETH to spend
})
```

### `client.sell(params, callbacks?)`

Sell tokens for ETH.

```typescript
await client.sell({
  symbol: 'MYVIBE',
  tokenAmount: '1000',  // Tokens to sell
})
```

### `client.getTokenInfo(symbol)`

Get token information.

```typescript
const info = await client.getTokenInfo('MYVIBE')
// Returns: { symbol, name, address, totalSupply, maxSupply, reserveBalance, priceForNextMint }
```

### `client.getPrice(symbol)`

Get current token price in wei.

```typescript
const price = await client.getPrice('MYVIBE')
```

### `client.getBuyEstimate(symbol, ethAmount)`

Estimate tokens received for ETH amount.

```typescript
const [tokensOut, reserveUsed] = await client.getBuyEstimate('MYVIBE', '0.1')
```

### `client.getSellEstimate(symbol, tokenAmount)`

Estimate ETH received for selling tokens.

```typescript
const [ethOut, tokensUsed] = await client.getSellEstimate('MYVIBE', '1000')
```

### `client.tokenExists(symbol)`

Check if a token exists.

```typescript
const exists = await client.tokenExists('MYVIBE')
```

## Contract Addresses

### Base Mainnet

| Contract | Address |
|----------|---------|
| MCV2_Bond | `0xc5a076cad94176c2996B32d8466Be1cE757FAa27` |
| MCV2_Token | `0xAa70bC79fD1cB4a6FBA717018351F0C3c64B79Df` |
| MCV2_ZapV1 | `0x91523b39813F3F4E406ECe406D0bEAaA9dE251fa` |

### Base Sepolia (Testnet)

Same addresses as mainnet (Mint Club deploys to same addresses across chains).

## Why Mint Club V2?

Instead of deploying custom contracts, we use Mint Club V2 because:

1. **CertiK Audited** (January 2024)
2. **Battle-tested** - Already handling real value
3. **No deployment needed** - Contracts already on Base
4. **SDK available** - Well-maintained TypeScript SDK
5. **94.26% test coverage**

## Resources

- [Mint Club V2 Docs](https://docs.mint.club/)
- [Mint Club V2 SDK](https://sdk.mint.club/)
- [GitHub](https://github.com/Steemhunt/mint.club-v2-contract)
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)

## License

MIT

/**
 * Basic Usage Example for @vibed/contracts-sdk
 *
 * This example shows how to:
 * 1. Create a bonding curve token
 * 2. Get token information
 * 3. Buy tokens
 * 4. Sell tokens
 * 5. Get price estimates
 *
 * Prerequisites:
 * - A wallet with Base Sepolia ETH (get from faucet)
 * - The SDK connected to a wallet provider (e.g., via wagmi/rainbowkit)
 */

import { createVibedClient, formatEther } from '@vibed/contracts-sdk'

// Create client for Base Sepolia testnet
const client = createVibedClient('baseSepolia')

// For mainnet, use:
// const client = createVibedClient('base')

async function main() {
  console.log('=== Vibed.fun SDK Example ===\n')

  // Example 1: Check if a token exists
  console.log('1. Checking if token exists...')
  const exists = await client.tokenExists('MYVIBE')
  console.log(`   Token MYVIBE exists: ${exists}\n`)

  // Example 2: Create a new token (requires wallet connection)
  console.log('2. Creating a new token...')
  try {
    const result = await client.createToken(
      {
        name: 'My Vibe Token',
        symbol: 'MYVIBE',
        maxSupply: 1_000_000_000, // 1 billion tokens
        initialPrice: 0.0000001, // Starting price in ETH
        finalPrice: 0.001, // Price at max supply
        creatorAllocation: 0, // No free tokens for creator
        buyRoyalty: 1, // 1% fee on buys
        sellRoyalty: 1, // 1% fee on sells
      },
      {
        onSignatureRequest: () => {
          console.log('   Please sign the transaction...')
        },
        onSigned: (txHash) => {
          console.log(`   Transaction signed: ${txHash}`)
        },
        onSuccess: () => {
          console.log('   Token created successfully!')
        },
        onError: (error) => {
          console.error('   Error creating token:', error)
        },
      }
    )
    console.log(`   Result: ${JSON.stringify(result)}\n`)
  } catch (error) {
    console.log('   Skipping (requires wallet connection)\n')
  }

  // Example 3: Get token information
  console.log('3. Getting token information...')
  const tokenInfo = await client.getTokenInfo('MINT') // Use an existing token
  if (tokenInfo) {
    console.log('   Token Info:')
    console.log(`   - Name: ${tokenInfo.name}`)
    console.log(`   - Symbol: ${tokenInfo.symbol}`)
    console.log(`   - Address: ${tokenInfo.address}`)
    console.log(`   - Total Supply: ${formatEther(tokenInfo.totalSupply)}`)
    console.log(`   - Max Supply: ${formatEther(tokenInfo.maxSupply)}`)
    console.log(`   - Reserve Balance: ${formatEther(tokenInfo.reserveBalance)} ETH`)
    console.log(`   - Price: ${formatEther(tokenInfo.priceForNextMint)} ETH`)
  } else {
    console.log('   Token not found')
  }
  console.log()

  // Example 4: Get price estimate for buying
  console.log('4. Getting buy estimate for 0.1 ETH...')
  try {
    const [tokensOut, reserveUsed] = await client.getBuyEstimate('MINT', '0.1')
    console.log(`   Tokens you would receive: ${formatEther(tokensOut)}`)
    console.log(`   ETH to spend: ${formatEther(reserveUsed)}\n`)
  } catch {
    console.log('   Could not get estimate\n')
  }

  // Example 5: Get price estimate for selling
  console.log('5. Getting sell estimate for 1000 tokens...')
  try {
    const [ethOut, tokensUsed] = await client.getSellEstimate('MINT', '1000')
    console.log(`   ETH you would receive: ${formatEther(ethOut)}`)
    console.log(`   Tokens to sell: ${formatEther(tokensUsed)}\n`)
  } catch {
    console.log('   Could not get estimate\n')
  }

  // Example 6: Buy tokens (requires wallet connection)
  console.log('6. Buying tokens...')
  try {
    const txHash = await client.buy(
      {
        symbol: 'MINT',
        ethAmount: '0.01', // Spend 0.01 ETH
      },
      {
        onSignatureRequest: () => console.log('   Please sign...'),
        onSigned: (hash) => console.log(`   Tx: ${hash}`),
        onSuccess: () => console.log('   Purchase complete!'),
        onError: (err) => console.error('   Error:', err),
      }
    )
    console.log(`   Transaction hash: ${txHash}\n`)
  } catch {
    console.log('   Skipping (requires wallet connection)\n')
  }

  // Example 7: Sell tokens (requires wallet connection)
  console.log('7. Selling tokens...')
  try {
    const txHash = await client.sell(
      {
        symbol: 'MINT',
        tokenAmount: '100', // Sell 100 tokens
      },
      {
        onSignatureRequest: () => console.log('   Please sign...'),
        onSigned: (hash) => console.log(`   Tx: ${hash}`),
        onSuccess: () => console.log('   Sale complete!'),
        onError: (err) => console.error('   Error:', err),
      }
    )
    console.log(`   Transaction hash: ${txHash}\n`)
  } catch {
    console.log('   Skipping (requires wallet connection)\n')
  }

  console.log('=== Example Complete ===')
}

main().catch(console.error)

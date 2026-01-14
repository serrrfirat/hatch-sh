import { ethers, network } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Test the deployed contract by creating a token and buying/selling
 * Run: npx hardhat run scripts/test-deployment.ts --network baseSepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Testing deployment on:', network.name)
  console.log('Account:', deployer.address)
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH')

  // Load deployment
  const deploymentsDir = path.join(__dirname, '..', 'deployments')
  const deploymentPath = path.join(deploymentsDir, `${network.name}.json`)

  if (!fs.existsSync(deploymentPath)) {
    console.error('Deployment not found. Run deploy script first.')
    process.exit(1)
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'))
  console.log('BondingCurve address:', deployment.bondingCurve)

  // Get contract instance
  const bondingCurve = await ethers.getContractAt('BondingCurve', deployment.bondingCurve)

  // Test 1: Create a token
  console.log('\n--- Test 1: Create Token ---')
  const createTx = await bondingCurve.createToken(
    'Test Vibe Token',
    'TVIBE',
    'ipfs://QmTest123'
  )
  const createReceipt = await createTx.wait()
  console.log('Token created. Tx:', createReceipt?.hash)

  // Get the token address from event
  const tokens = await bondingCurve.getAllTokens()
  const tokenAddress = tokens[tokens.length - 1]
  console.log('Token address:', tokenAddress)

  // Get token info
  const tokenInfo = await bondingCurve.getTokenInfo(tokenAddress)
  console.log('Token name:', tokenInfo.name)
  console.log('Token symbol:', tokenInfo.symbol)
  console.log('Creator:', tokenInfo.creator)

  // Test 2: Buy tokens
  console.log('\n--- Test 2: Buy Tokens ---')
  const buyAmount = ethers.parseEther('0.001') // Small amount for testing
  const priceBefore = await bondingCurve.getPrice(tokenAddress)
  console.log('Price before:', ethers.formatEther(priceBefore), 'ETH')

  const buyTx = await bondingCurve.buy(tokenAddress, { value: buyAmount })
  const buyReceipt = await buyTx.wait()
  console.log('Buy tx:', buyReceipt?.hash)

  const priceAfter = await bondingCurve.getPrice(tokenAddress)
  console.log('Price after:', ethers.formatEther(priceAfter), 'ETH')

  const vibeToken = await ethers.getContractAt('VibeToken', tokenAddress)
  const balance = await vibeToken.balanceOf(deployer.address)
  console.log('Token balance:', ethers.formatEther(balance))

  // Test 3: Sell some tokens
  console.log('\n--- Test 3: Sell Tokens ---')
  const sellAmount = balance / 2n
  const sellTx = await bondingCurve.sell(tokenAddress, sellAmount)
  const sellReceipt = await sellTx.wait()
  console.log('Sell tx:', sellReceipt?.hash)

  const finalBalance = await vibeToken.balanceOf(deployer.address)
  console.log('Final token balance:', ethers.formatEther(finalBalance))

  const finalPrice = await bondingCurve.getPrice(tokenAddress)
  console.log('Final price:', ethers.formatEther(finalPrice), 'ETH')

  // Summary
  console.log('\n--- Summary ---')
  console.log('All tests passed!')
  console.log('Total tokens created:', tokens.length)
  console.log('Market cap:', ethers.formatEther(await bondingCurve.getMarketCap(tokenAddress)), 'ETH')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error)
    process.exit(1)
  })

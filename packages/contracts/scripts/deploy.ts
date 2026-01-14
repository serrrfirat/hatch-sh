import { ethers, network } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const [deployer] = await ethers.getSigners()
  const balance = await ethers.provider.getBalance(deployer.address)

  console.log('Deploying BondingCurve contract...')
  console.log('Network:', network.name)
  console.log('Deployer:', deployer.address)
  console.log('Balance:', ethers.formatEther(balance), 'ETH')

  // Deploy BondingCurve
  const BondingCurve = await ethers.getContractFactory('BondingCurve')
  const bondingCurve = await BondingCurve.deploy()
  await bondingCurve.waitForDeployment()

  const bondingCurveAddress = await bondingCurve.getAddress()
  console.log('BondingCurve deployed to:', bondingCurveAddress)

  // Wait for a few confirmations
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    console.log('Waiting for confirmations...')
    await bondingCurve.deploymentTransaction()?.wait(3)
    console.log('Confirmed!')
  }

  // Save deployment info
  const deploymentsDir = path.join(__dirname, '..', 'deployments')
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true })
  }

  const deployment = {
    network: network.name,
    chainId: network.config.chainId,
    bondingCurve: bondingCurveAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  }

  const deploymentPath = path.join(deploymentsDir, `${network.name}.json`)
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2))
  console.log('Deployment info saved to:', deploymentPath)

  // Log verification command
  if (network.name === 'baseSepolia' || network.name === 'base') {
    console.log('\nTo verify on Basescan:')
    console.log(`npx hardhat verify --network ${network.name} ${bondingCurveAddress}`)
  }

  return deployment
}

main()
  .then((deployment) => {
    console.log('\nDeployment successful!')
    console.log(deployment)
    process.exit(0)
  })
  .catch((error) => {
    console.error('Deployment failed:', error)
    process.exit(1)
  })

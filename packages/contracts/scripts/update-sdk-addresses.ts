import * as fs from 'fs'
import * as path from 'path'

/**
 * Update the SDK addresses file with deployed contract addresses
 * Run after deployment: npx ts-node scripts/update-sdk-addresses.ts baseSepolia
 */
async function main() {
  const network = process.argv[2]

  if (!network) {
    console.error('Usage: npx ts-node scripts/update-sdk-addresses.ts <network>')
    console.error('  network: baseSepolia or base')
    process.exit(1)
  }

  // Read deployment file
  const deploymentsDir = path.join(__dirname, '..', 'deployments')
  const deploymentPath = path.join(deploymentsDir, `${network}.json`)

  if (!fs.existsSync(deploymentPath)) {
    console.error(`Deployment file not found: ${deploymentPath}`)
    console.error('Have you run the deploy script first?')
    process.exit(1)
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'))

  // Update SDK addresses
  const sdkAddressesPath = path.join(
    __dirname,
    '..',
    '..',
    'contracts-sdk',
    'src',
    'addresses.ts'
  )

  if (!fs.existsSync(sdkAddressesPath)) {
    console.error(`SDK addresses file not found: ${sdkAddressesPath}`)
    process.exit(1)
  }

  let content = fs.readFileSync(sdkAddressesPath, 'utf-8')

  // Update the address for the network
  const addressRegex = new RegExp(
    `(${network}:\\s*\\{[^}]*bondingCurve:\\s*)'0x[a-fA-F0-9]+'`,
    's'
  )

  content = content.replace(
    addressRegex,
    `$1'${deployment.bondingCurve}'`
  )

  fs.writeFileSync(sdkAddressesPath, content)

  console.log(`Updated SDK addresses for ${network}:`)
  console.log(`  BondingCurve: ${deployment.bondingCurve}`)
  console.log('')
  console.log('Next steps:')
  console.log('1. cd packages/contracts-sdk')
  console.log('2. npm run build')
  console.log('3. Test the SDK with the new addresses')
}

main().catch(console.error)

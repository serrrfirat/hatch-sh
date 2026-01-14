# Agent Task: Smart Contracts (Bonding Curve on Base)

## Priority: HIGH - Completely Independent
## Estimated Time: 4-6 hours

## Objective
Research Base launchpad SDKs (Clanker, Wow.xyz) and either integrate existing SDK or build custom bonding curve contracts. Deploy to Base Sepolia testnet.

## Research Phase (1-2 hours)

### Option A: Clanker SDK (Recommended)
Clanker is a token launch protocol on Base. Research:
1. Check https://clanker.world for SDK/API documentation
2. Look for npm package or contract interfaces
3. Evaluate if it supports our requirements:
   - Create token with name/symbol/image
   - Bonding curve mechanics
   - Graduation to Uniswap at threshold

### Option B: Wow.xyz Integration
Research Wow.xyz for Base token launches:
1. Check their contracts and ABIs
2. Evaluate API availability

### Option C: Custom Implementation
If no SDK works, build custom:
- Simpler bonding curve (linear or exponential)
- Token factory pattern

## Implementation Tasks

### If Using Existing SDK (Clanker/Wow):

1. Create `packages/contracts-sdk/`:
```bash
mkdir -p packages/contracts-sdk/src
cd packages/contracts-sdk
pnpm init
pnpm add viem @types/node
```

2. Create wrapper:
```typescript
// packages/contracts-sdk/src/index.ts
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { baseSepolia, base } from 'viem/chains'

// Add Clanker/Wow ABI and addresses
export const BONDING_CURVE_ADDRESS = {
  baseSepolia: '0x...', // Get from SDK docs
  base: '0x...',
}

export const bondingCurveAbi = parseAbi([
  'function createToken(string name, string symbol, string imageUri) returns (address)',
  'function buy(address token) payable',
  'function sell(address token, uint256 amount)',
  'function getPrice(address token) view returns (uint256)',
  // Add actual ABI from SDK
])

export function createBondingCurveClient(chain: 'base' | 'baseSepolia') {
  const selectedChain = chain === 'base' ? base : baseSepolia
  return createPublicClient({
    chain: selectedChain,
    transport: http(),
  })
}
```

### If Building Custom Contracts:

1. Initialize Hardhat project:
```bash
mkdir -p packages/contracts
cd packages/contracts
pnpm init
pnpm add -D hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
npx hardhat init
```

2. Create `packages/contracts/hardhat.config.ts`:
```typescript
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  networks: {
    baseSepolia: {
      url: 'https://sepolia.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    base: {
      url: 'https://mainnet.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
}

export default config
```

3. Create `packages/contracts/contracts/BondingCurve.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VibeToken is ERC20 {
    address public bondingCurve;
    string public imageUri;

    constructor(
        string memory name,
        string memory symbol,
        string memory _imageUri,
        address _bondingCurve
    ) ERC20(name, symbol) {
        bondingCurve = _bondingCurve;
        imageUri = _imageUri;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == bondingCurve, "Only bonding curve");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == bondingCurve, "Only bonding curve");
        _burn(from, amount);
    }
}

contract BondingCurve is Ownable {
    uint256 public constant GRADUATION_THRESHOLD = 69000 * 1e18; // $69k
    uint256 public platformFee = 100; // 1% = 100 basis points

    struct Token {
        address tokenAddress;
        address creator;
        uint256 reserveBalance;
        uint256 totalSupply;
        bool graduated;
        string imageUri;
    }

    mapping(address => Token) public tokens;
    address[] public allTokens;

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol);
    event Buy(address indexed token, address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    event Sell(address indexed token, address indexed seller, uint256 tokenAmount, uint256 ethAmount);
    event Graduated(address indexed token);

    constructor() Ownable(msg.sender) {}

    function createToken(
        string memory name,
        string memory symbol,
        string memory imageUri
    ) external returns (address) {
        VibeToken token = new VibeToken(name, symbol, imageUri, address(this));
        address tokenAddress = address(token);

        tokens[tokenAddress] = Token({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            reserveBalance: 0,
            totalSupply: 0,
            graduated: false,
            imageUri: imageUri
        });

        allTokens.push(tokenAddress);
        emit TokenCreated(tokenAddress, msg.sender, name, symbol);
        return tokenAddress;
    }

    function buy(address tokenAddress) external payable {
        Token storage token = tokens[tokenAddress];
        require(token.tokenAddress != address(0), "Token not found");
        require(!token.graduated, "Token graduated");

        uint256 fee = (msg.value * platformFee) / 10000;
        uint256 ethForPurchase = msg.value - fee;

        // Simple linear bonding curve: price = supply / 1e18
        // tokenAmount = sqrt(2 * ethForPurchase * 1e18 + supply^2) - supply
        uint256 tokenAmount = calculateBuyAmount(token.totalSupply, ethForPurchase);

        token.reserveBalance += ethForPurchase;
        token.totalSupply += tokenAmount;

        VibeToken(tokenAddress).mint(msg.sender, tokenAmount);

        // Check graduation
        uint256 marketCap = getMarketCap(tokenAddress);
        if (marketCap >= GRADUATION_THRESHOLD) {
            graduate(tokenAddress);
        }

        emit Buy(tokenAddress, msg.sender, msg.value, tokenAmount);
    }

    function sell(address tokenAddress, uint256 tokenAmount) external {
        Token storage token = tokens[tokenAddress];
        require(token.tokenAddress != address(0), "Token not found");
        require(!token.graduated, "Token graduated");

        uint256 ethAmount = calculateSellAmount(token.totalSupply, tokenAmount);
        uint256 fee = (ethAmount * platformFee) / 10000;
        uint256 ethToSeller = ethAmount - fee;

        require(token.reserveBalance >= ethAmount, "Insufficient reserve");

        token.reserveBalance -= ethAmount;
        token.totalSupply -= tokenAmount;

        VibeToken(tokenAddress).burn(msg.sender, tokenAmount);
        payable(msg.sender).transfer(ethToSeller);

        emit Sell(tokenAddress, msg.sender, tokenAmount, ethToSeller);
    }

    function graduate(address tokenAddress) internal {
        Token storage token = tokens[tokenAddress];
        token.graduated = true;
        // TODO: Add liquidity to Uniswap
        emit Graduated(tokenAddress);
    }

    function getPrice(address tokenAddress) external view returns (uint256) {
        Token storage token = tokens[tokenAddress];
        if (token.totalSupply == 0) return 1e15; // Initial price: 0.001 ETH
        return (token.reserveBalance * 1e18) / token.totalSupply;
    }

    function getMarketCap(address tokenAddress) public view returns (uint256) {
        Token storage token = tokens[tokenAddress];
        uint256 price = token.totalSupply == 0 ? 1e15 : (token.reserveBalance * 1e18) / token.totalSupply;
        return (price * token.totalSupply) / 1e18;
    }

    // Simple linear bonding curve math
    function calculateBuyAmount(uint256 currentSupply, uint256 ethAmount) internal pure returns (uint256) {
        // Simplified: more ETH = more tokens, but price increases
        return (ethAmount * 1e18) / (currentSupply / 1e18 + 1e18);
    }

    function calculateSellAmount(uint256 currentSupply, uint256 tokenAmount) internal pure returns (uint256) {
        return (tokenAmount * (currentSupply / 1e18)) / 1e18;
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
}
```

4. Create deployment script `packages/contracts/scripts/deploy.ts`:
```typescript
import { ethers } from 'hardhat'

async function main() {
  const BondingCurve = await ethers.getContractFactory('BondingCurve')
  const bondingCurve = await BondingCurve.deploy()
  await bondingCurve.waitForDeployment()

  const address = await bondingCurve.getAddress()
  console.log('BondingCurve deployed to:', address)

  // Save deployment info
  const fs = await import('fs')
  const deployments = {
    baseSepolia: {
      bondingCurve: address,
      deployedAt: new Date().toISOString(),
    },
  }
  fs.writeFileSync(
    './deployments/baseSepolia.json',
    JSON.stringify(deployments, null, 2)
  )
}

main().catch(console.error)
```

5. Create test file `packages/contracts/test/BondingCurve.test.ts`:
```typescript
import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('BondingCurve', function () {
  it('Should create a token', async function () {
    const BondingCurve = await ethers.getContractFactory('BondingCurve')
    const bondingCurve = await BondingCurve.deploy()

    const tx = await bondingCurve.createToken('Test Token', 'TEST', 'ipfs://image')
    const receipt = await tx.wait()

    const tokens = await bondingCurve.getAllTokens()
    expect(tokens.length).to.equal(1)
  })

  it('Should allow buying tokens', async function () {
    const [owner, buyer] = await ethers.getSigners()
    const BondingCurve = await ethers.getContractFactory('BondingCurve')
    const bondingCurve = await BondingCurve.deploy()

    await bondingCurve.createToken('Test Token', 'TEST', 'ipfs://image')
    const tokens = await bondingCurve.getAllTokens()
    const tokenAddress = tokens[0]

    await bondingCurve.connect(buyer).buy(tokenAddress, { value: ethers.parseEther('0.1') })

    const token = await bondingCurve.tokens(tokenAddress)
    expect(token.totalSupply).to.be.gt(0)
  })
})
```

### Create TypeScript SDK Package

Create `packages/contracts-sdk/`:
```typescript
// packages/contracts-sdk/src/index.ts
export * from './abi'
export * from './addresses'
export * from './client'

// packages/contracts-sdk/src/abi.ts
export const bondingCurveAbi = [/* ABI from compiled contract */] as const

// packages/contracts-sdk/src/addresses.ts
import baseSepolia from '../deployments/baseSepolia.json'

export const addresses = {
  baseSepolia: {
    bondingCurve: baseSepolia.bondingCurve as `0x${string}`,
  },
  base: {
    bondingCurve: '' as `0x${string}`, // To be deployed
  },
}

// packages/contracts-sdk/src/client.ts
import { createPublicClient, http, getContract } from 'viem'
import { baseSepolia, base } from 'viem/chains'
import { bondingCurveAbi } from './abi'
import { addresses } from './addresses'

export function getBondingCurveContract(chain: 'base' | 'baseSepolia') {
  const selectedChain = chain === 'base' ? base : baseSepolia
  const client = createPublicClient({
    chain: selectedChain,
    transport: http(),
  })

  return getContract({
    address: addresses[chain].bondingCurve,
    abi: bondingCurveAbi,
    client,
  })
}
```

## Directory Structure
```
packages/
├── contracts/
│   ├── package.json
│   ├── hardhat.config.ts
│   ├── contracts/
│   │   ├── BondingCurve.sol
│   │   └── interfaces/
│   ├── scripts/
│   │   └── deploy.ts
│   ├── test/
│   │   └── BondingCurve.test.ts
│   └── deployments/
│       └── baseSepolia.json
└── contracts-sdk/
    ├── package.json
    ├── src/
    │   ├── index.ts
    │   ├── abi.ts
    │   ├── addresses.ts
    │   └── client.ts
    └── tsconfig.json
```

## Definition of Done
- [ ] Research complete: decision made on SDK vs custom
- [ ] Contracts compiled without errors
- [ ] Tests passing locally
- [ ] Deployed to Base Sepolia testnet
- [ ] Can create token via script
- [ ] Can buy/sell tokens on testnet
- [ ] TypeScript SDK package created
- [ ] ABIs exported for frontend

## Environment Variables Needed
```
PRIVATE_KEY=your_deployer_private_key
BASESCAN_API_KEY=for_contract_verification
```

## Notes
- Start with Base Sepolia for all testing
- Do NOT deploy to mainnet until full e2e testing complete
- If using Clanker SDK, document the integration for the team
- Price curve can be adjusted - start simple, optimize later

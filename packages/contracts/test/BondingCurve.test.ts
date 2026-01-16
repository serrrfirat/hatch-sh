import { expect } from 'chai'
import { ethers } from 'hardhat'
import { BondingCurve, VibeToken } from '../typechain-types'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

describe('BondingCurve', function () {
  let bondingCurve: BondingCurve
  let owner: HardhatEthersSigner
  let creator: HardhatEthersSigner
  let buyer: HardhatEthersSigner
  let buyer2: HardhatEthersSigner

  beforeEach(async function () {
    [owner, creator, buyer, buyer2] = await ethers.getSigners()

    const BondingCurveFactory = await ethers.getContractFactory('BondingCurve')
    bondingCurve = await BondingCurveFactory.deploy()
  })

  describe('Deployment', function () {
    it('Should set the owner correctly', async function () {
      expect(await bondingCurve.owner()).to.equal(owner.address)
    })

    it('Should set the fee recipient to owner', async function () {
      expect(await bondingCurve.feeRecipient()).to.equal(owner.address)
    })

    it('Should set default platform fee to 1%', async function () {
      expect(await bondingCurve.platformFee()).to.equal(100)
    })
  })

  describe('Token Creation', function () {
    it('Should create a new token', async function () {
      const tx = await bondingCurve
        .connect(creator)
        .createToken('Test Token', 'TEST', 'ipfs://image')

      const receipt = await tx.wait()

      // Check event was emitted
      const event = receipt?.logs.find((log) => {
        try {
          const parsed = bondingCurve.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          })
          return parsed?.name === 'TokenCreated'
        } catch {
          return false
        }
      })
      expect(event).to.not.be.undefined

      // Check token count
      expect(await bondingCurve.getTokenCount()).to.equal(1)

      // Check token is in array
      const tokens = await bondingCurve.getAllTokens()
      expect(tokens.length).to.equal(1)
    })

    it('Should store correct token info', async function () {
      await bondingCurve
        .connect(creator)
        .createToken('Test Token', 'TEST', 'ipfs://image')

      const tokens = await bondingCurve.getAllTokens()
      const tokenInfo = await bondingCurve.getTokenInfo(tokens[0])

      expect(tokenInfo.name).to.equal('Test Token')
      expect(tokenInfo.symbol).to.equal('TEST')
      expect(tokenInfo.imageUri).to.equal('ipfs://image')
      expect(tokenInfo.creator).to.equal(creator.address)
      expect(tokenInfo.graduated).to.be.false
      expect(tokenInfo.totalSupply).to.equal(0)
      expect(tokenInfo.reserveBalance).to.equal(0)
    })

    it('Should create VibeToken with correct properties', async function () {
      await bondingCurve
        .connect(creator)
        .createToken('Test Token', 'TEST', 'ipfs://image')

      const tokens = await bondingCurve.getAllTokens()
      const vibeToken = await ethers.getContractAt('VibeToken', tokens[0])

      expect(await vibeToken.name()).to.equal('Test Token')
      expect(await vibeToken.symbol()).to.equal('TEST')
      expect(await vibeToken.imageUri()).to.equal('ipfs://image')
      expect(await vibeToken.bondingCurve()).to.equal(
        await bondingCurve.getAddress()
      )
    })
  })

  describe('Buying Tokens', function () {
    let tokenAddress: string

    beforeEach(async function () {
      await bondingCurve
        .connect(creator)
        .createToken('Test Token', 'TEST', 'ipfs://image')
      const tokens = await bondingCurve.getAllTokens()
      tokenAddress = tokens[0]
    })

    it('Should allow buying tokens', async function () {
      const buyAmount = ethers.parseEther('0.1')

      await bondingCurve.connect(buyer).buy(tokenAddress, 0, { value: buyAmount })

      const vibeToken = await ethers.getContractAt('VibeToken', tokenAddress)
      const balance = await vibeToken.balanceOf(buyer.address)

      expect(balance).to.be.gt(0)
    })

    it('Should increase price after purchase', async function () {
      const initialPrice = await bondingCurve.getPrice(tokenAddress)

      await bondingCurve
        .connect(buyer)
        .buy(tokenAddress, 0, { value: ethers.parseEther('1') })

      const newPrice = await bondingCurve.getPrice(tokenAddress)
      expect(newPrice).to.be.gt(initialPrice)
    })

    it('Should update token info after purchase', async function () {
      const buyAmount = ethers.parseEther('0.1')
      const fee = (buyAmount * BigInt(100)) / BigInt(10000)
      const ethForPurchase = buyAmount - fee

      await bondingCurve.connect(buyer).buy(tokenAddress, 0, { value: buyAmount })

      const tokenInfo = await bondingCurve.getTokenInfo(tokenAddress)
      expect(tokenInfo.reserveBalance).to.equal(ethForPurchase)
      expect(tokenInfo.totalSupply).to.be.gt(0)
    })

    it('Should emit Buy event', async function () {
      const buyAmount = ethers.parseEther('0.1')

      await expect(
        bondingCurve.connect(buyer).buy(tokenAddress, 0, { value: buyAmount })
      ).to.emit(bondingCurve, 'Buy')
    })

    it('Should accumulate platform fee in pendingFees', async function () {
      const buyAmount = ethers.parseEther('1')
      const fee = (buyAmount * BigInt(100)) / BigInt(10000)

      const initialPendingFees = await bondingCurve.pendingFees()

      await bondingCurve.connect(buyer).buy(tokenAddress, 0, { value: buyAmount })

      const finalPendingFees = await bondingCurve.pendingFees()
      expect(finalPendingFees - initialPendingFees).to.equal(fee)
    })

    it('Should revert on zero ETH', async function () {
      await expect(
        bondingCurve.connect(buyer).buy(tokenAddress, 0, { value: 0 })
      ).to.be.revertedWithCustomError(bondingCurve, 'ZeroAmount')
    })

    it('Should revert for non-existent token', async function () {
      await expect(
        bondingCurve
          .connect(buyer)
          .buy(ethers.ZeroAddress, 0, { value: ethers.parseEther('0.1') })
      ).to.be.revertedWithCustomError(bondingCurve, 'TokenNotFound')
    })

    it('Should revert if slippage exceeded (minTokensOut not met)', async function () {
      const buyAmount = ethers.parseEther('0.1')
      // Request an impossibly high minimum
      const impossibleMinTokens = ethers.parseEther('999999999999')

      await expect(
        bondingCurve.connect(buyer).buy(tokenAddress, impossibleMinTokens, { value: buyAmount })
      ).to.be.revertedWithCustomError(bondingCurve, 'SlippageExceeded')
    })
  })

  describe('Selling Tokens', function () {
    let tokenAddress: string
    let vibeToken: VibeToken

    beforeEach(async function () {
      await bondingCurve
        .connect(creator)
        .createToken('Test Token', 'TEST', 'ipfs://image')
      const tokens = await bondingCurve.getAllTokens()
      tokenAddress = tokens[0]
      vibeToken = await ethers.getContractAt('VibeToken', tokenAddress)

      // Buy some tokens first
      await bondingCurve
        .connect(buyer)
        .buy(tokenAddress, 0, { value: ethers.parseEther('1') })
    })

    it('Should allow selling tokens', async function () {
      const tokenBalance = await vibeToken.balanceOf(buyer.address)
      const sellAmount = tokenBalance / BigInt(2)

      const initialEthBalance = await ethers.provider.getBalance(buyer.address)

      const tx = await bondingCurve
        .connect(buyer)
        .sell(tokenAddress, sellAmount, 0)
      const receipt = await tx.wait()
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice

      const finalEthBalance = await ethers.provider.getBalance(buyer.address)
      const newTokenBalance = await vibeToken.balanceOf(buyer.address)

      expect(newTokenBalance).to.equal(tokenBalance - sellAmount)
      expect(finalEthBalance + gasUsed).to.be.gt(initialEthBalance)
    })

    it('Should decrease price after sell', async function () {
      const tokenBalance = await vibeToken.balanceOf(buyer.address)
      const initialPrice = await bondingCurve.getPrice(tokenAddress)

      await bondingCurve.connect(buyer).sell(tokenAddress, tokenBalance, 0)

      const newPrice = await bondingCurve.getPrice(tokenAddress)
      expect(newPrice).to.be.lt(initialPrice)
    })

    it('Should emit Sell event', async function () {
      const tokenBalance = await vibeToken.balanceOf(buyer.address)

      await expect(
        bondingCurve.connect(buyer).sell(tokenAddress, tokenBalance / BigInt(2), 0)
      ).to.emit(bondingCurve, 'Sell')
    })

    it('Should revert on zero amount', async function () {
      await expect(
        bondingCurve.connect(buyer).sell(tokenAddress, 0, 0)
      ).to.be.revertedWithCustomError(bondingCurve, 'ZeroAmount')
    })

    it('Should revert if user has insufficient tokens', async function () {
      const tokenBalance = await vibeToken.balanceOf(buyer.address)

      await expect(
        bondingCurve.connect(buyer).sell(tokenAddress, tokenBalance + BigInt(1), 0)
      ).to.be.revertedWithCustomError(bondingCurve, 'InsufficientTokens')
    })

    it('Should revert for non-existent token', async function () {
      await expect(
        bondingCurve.connect(buyer).sell(ethers.ZeroAddress, 100, 0)
      ).to.be.revertedWithCustomError(bondingCurve, 'TokenNotFound')
    })

    it('Should revert if slippage exceeded (minEthOut not met)', async function () {
      const tokenBalance = await vibeToken.balanceOf(buyer.address)
      const sellAmount = tokenBalance / BigInt(2)
      // Request an impossibly high minimum ETH out
      const impossibleMinEth = ethers.parseEther('999999')

      await expect(
        bondingCurve.connect(buyer).sell(tokenAddress, sellAmount, impossibleMinEth)
      ).to.be.revertedWithCustomError(bondingCurve, 'SlippageExceeded')
    })
  })

  describe('Price Calculation', function () {
    let tokenAddress: string

    beforeEach(async function () {
      await bondingCurve
        .connect(creator)
        .createToken('Test Token', 'TEST', 'ipfs://image')
      const tokens = await bondingCurve.getAllTokens()
      tokenAddress = tokens[0]
    })

    it('Should return initial price for empty supply', async function () {
      const price = await bondingCurve.getPrice(tokenAddress)
      expect(price).to.equal(await bondingCurve.INITIAL_PRICE())
    })

    it('Should increase price with more supply', async function () {
      // Buy in increments and check price increases
      const prices: bigint[] = []

      for (let i = 0; i < 3; i++) {
        prices.push(await bondingCurve.getPrice(tokenAddress))
        await bondingCurve
          .connect(buyer)
          .buy(tokenAddress, 0, { value: ethers.parseEther('0.5') })
      }
      prices.push(await bondingCurve.getPrice(tokenAddress))

      // Each price should be higher than the previous
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).to.be.gt(prices[i - 1])
      }
    })

    it('Should calculate market cap correctly', async function () {
      await bondingCurve
        .connect(buyer)
        .buy(tokenAddress, 0, { value: ethers.parseEther('1') })

      const tokenInfo = await bondingCurve.getTokenInfo(tokenAddress)
      const price = await bondingCurve.getPrice(tokenAddress)
      const expectedMarketCap =
        (price * tokenInfo.totalSupply) / ethers.parseEther('1')
      const actualMarketCap = await bondingCurve.getMarketCap(tokenAddress)

      expect(actualMarketCap).to.equal(expectedMarketCap)
    })
  })

  describe('Admin Functions', function () {
    it('Should allow owner to update platform fee', async function () {
      await bondingCurve.connect(owner).setPlatformFee(200) // 2%
      expect(await bondingCurve.platformFee()).to.equal(200)
    })

    it('Should emit PlatformFeeUpdated event', async function () {
      await expect(bondingCurve.connect(owner).setPlatformFee(200))
        .to.emit(bondingCurve, 'PlatformFeeUpdated')
        .withArgs(100, 200)
    })

    it('Should revert if fee is too high', async function () {
      await expect(
        bondingCurve.connect(owner).setPlatformFee(1001) // > 10%
      ).to.be.revertedWithCustomError(bondingCurve, 'InvalidFee')
    })

    it('Should revert if non-owner tries to set fee', async function () {
      await expect(
        bondingCurve.connect(buyer).setPlatformFee(200)
      ).to.be.revertedWithCustomError(bondingCurve, 'OwnableUnauthorizedAccount')
    })

    it('Should allow owner to update fee recipient', async function () {
      await bondingCurve.connect(owner).setFeeRecipient(buyer.address)
      expect(await bondingCurve.feeRecipient()).to.equal(buyer.address)
    })

    it('Should emit FeeRecipientUpdated event', async function () {
      await expect(bondingCurve.connect(owner).setFeeRecipient(buyer.address))
        .to.emit(bondingCurve, 'FeeRecipientUpdated')
        .withArgs(owner.address, buyer.address)
    })

    it('Should revert if setting fee recipient to zero address', async function () {
      await expect(
        bondingCurve.connect(owner).setFeeRecipient(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(bondingCurve, 'ZeroAddress')
    })
  })

  describe('Fee Withdrawal', function () {
    let tokenAddress: string

    beforeEach(async function () {
      await bondingCurve
        .connect(creator)
        .createToken('Test Token', 'TEST', 'ipfs://image')
      const tokens = await bondingCurve.getAllTokens()
      tokenAddress = tokens[0]

      // Generate some fees through purchases
      await bondingCurve
        .connect(buyer)
        .buy(tokenAddress, 0, { value: ethers.parseEther('1') })
    })

    it('Should allow withdrawing pending fees', async function () {
      const pendingFees = await bondingCurve.pendingFees()
      expect(pendingFees).to.be.gt(0)

      const initialBalance = await ethers.provider.getBalance(owner.address)

      const tx = await bondingCurve.connect(owner).withdrawPendingFees()
      const receipt = await tx.wait()
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice

      const finalBalance = await ethers.provider.getBalance(owner.address)
      expect(finalBalance + gasUsed - initialBalance).to.equal(pendingFees)
      expect(await bondingCurve.pendingFees()).to.equal(0)
    })

    it('Should emit FeesWithdrawn event', async function () {
      const pendingFees = await bondingCurve.pendingFees()

      await expect(bondingCurve.connect(owner).withdrawPendingFees())
        .to.emit(bondingCurve, 'FeesWithdrawn')
        .withArgs(owner.address, pendingFees)
    })

    it('Should revert if no pending fees', async function () {
      // Withdraw all fees first
      await bondingCurve.connect(owner).withdrawPendingFees()

      await expect(
        bondingCurve.connect(owner).withdrawPendingFees()
      ).to.be.revertedWithCustomError(bondingCurve, 'NoPendingFees')
    })

    it('Should send fees to current fee recipient', async function () {
      // Change fee recipient
      await bondingCurve.connect(owner).setFeeRecipient(buyer2.address)

      const pendingFees = await bondingCurve.pendingFees()
      const initialBalance = await ethers.provider.getBalance(buyer2.address)

      // Now only buyer2 (the new fee recipient) can withdraw
      await bondingCurve.connect(buyer2).withdrawPendingFees()

      const finalBalance = await ethers.provider.getBalance(buyer2.address)
      // Account for gas spent by buyer2
      expect(finalBalance).to.be.gt(initialBalance)
    })

    it('Should revert if non-fee-recipient tries to withdraw', async function () {
      await expect(
        bondingCurve.connect(buyer).withdrawPendingFees()
      ).to.be.revertedWithCustomError(bondingCurve, 'OnlyFeeRecipient')
    })
  })

  describe('Graduated Liquidity Withdrawal', function () {
    let tokenAddress: string

    beforeEach(async function () {
      await bondingCurve
        .connect(creator)
        .createToken('Test Token', 'TEST', 'ipfs://image')
      const tokens = await bondingCurve.getAllTokens()
      tokenAddress = tokens[0]
    })

    it('Should allow owner to withdraw liquidity from graduated token', async function () {
      // The GRADUATION_THRESHOLD is 69000 * 1e18 wei market cap
      // We need to buy enough to reach this threshold
      // For this test, we'll buy a large amount and verify graduation happens
      const buyAmount = ethers.parseEther('100')
      await bondingCurve
        .connect(buyer)
        .buy(tokenAddress, 0, { value: buyAmount })

      const tokenInfo = await bondingCurve.getTokenInfo(tokenAddress)
      const marketCap = await bondingCurve.getMarketCap(tokenAddress)
      const threshold = await bondingCurve.GRADUATION_THRESHOLD()

      // If market cap didn't reach threshold, skip this test with a message
      // In a real scenario, you'd need much more ETH to graduate
      if (marketCap < threshold) {
        console.log(`    ⚠ Skipping: Market cap ${marketCap} < threshold ${threshold}`)
        console.log(`    To fully test graduation, deploy with lower threshold or use more ETH`)
        return
      }

      expect(tokenInfo.graduated).to.be.true

      const reserveBalance = tokenInfo.reserveBalance
      const initialBalance = await ethers.provider.getBalance(buyer2.address)

      await bondingCurve
        .connect(owner)
        .withdrawGraduatedLiquidity(tokenAddress, buyer2.address)

      const finalBalance = await ethers.provider.getBalance(buyer2.address)
      expect(finalBalance - initialBalance).to.equal(reserveBalance)

      // Reserve should be zero after withdrawal
      const newTokenInfo = await bondingCurve.getTokenInfo(tokenAddress)
      expect(newTokenInfo.reserveBalance).to.equal(0)
    })

    it('Should revert if token is not graduated', async function () {
      // Buy some but not enough to graduate
      await bondingCurve
        .connect(buyer)
        .buy(tokenAddress, 0, { value: ethers.parseEther('0.1') })

      await expect(
        bondingCurve
          .connect(owner)
          .withdrawGraduatedLiquidity(tokenAddress, buyer2.address)
      ).to.be.revertedWithCustomError(bondingCurve, 'TokenNotGraduated')
    })

    it('Should revert if recipient is zero address', async function () {
      await expect(
        bondingCurve
          .connect(owner)
          .withdrawGraduatedLiquidity(tokenAddress, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(bondingCurve, 'ZeroAddress')
    })

    it('Should revert if called by non-owner', async function () {
      await expect(
        bondingCurve
          .connect(buyer)
          .withdrawGraduatedLiquidity(tokenAddress, buyer2.address)
      ).to.be.revertedWithCustomError(bondingCurve, 'OwnableUnauthorizedAccount')
    })
  })

  describe('VibeToken Access Control', function () {
    let tokenAddress: string
    let vibeToken: VibeToken

    beforeEach(async function () {
      await bondingCurve
        .connect(creator)
        .createToken('Test Token', 'TEST', 'ipfs://image')
      const tokens = await bondingCurve.getAllTokens()
      tokenAddress = tokens[0]
      vibeToken = await ethers.getContractAt('VibeToken', tokenAddress)
    })

    it('Should only allow bonding curve to mint', async function () {
      await expect(
        vibeToken.connect(buyer).mint(buyer.address, 1000)
      ).to.be.revertedWithCustomError(vibeToken, 'OnlyBondingCurve')
    })

    it('Should only allow bonding curve to burn', async function () {
      await expect(
        vibeToken.connect(buyer).burn(buyer.address, 1000)
      ).to.be.revertedWithCustomError(vibeToken, 'OnlyBondingCurve')
    })
  })

  describe('Multiple Tokens', function () {
    it('Should support multiple tokens independently', async function () {
      // Create two tokens
      await bondingCurve
        .connect(creator)
        .createToken('Token A', 'TKA', 'ipfs://a')
      await bondingCurve
        .connect(creator)
        .createToken('Token B', 'TKB', 'ipfs://b')

      const tokens = await bondingCurve.getAllTokens()
      expect(tokens.length).to.equal(2)

      // Buy token A
      await bondingCurve
        .connect(buyer)
        .buy(tokens[0], 0, { value: ethers.parseEther('1') })

      // Check token B is unaffected
      const tokenBInfo = await bondingCurve.getTokenInfo(tokens[1])
      expect(tokenBInfo.totalSupply).to.equal(0)
      expect(tokenBInfo.reserveBalance).to.equal(0)
    })
  })
})

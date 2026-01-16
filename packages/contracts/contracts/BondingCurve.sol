// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VibeToken.sol";

/**
 * @title BondingCurve
 * @notice Factory and trading contract for bonding curve tokens
 * @dev Uses a linear bonding curve: price = k * supply, where k = 1e-18
 *      This means price increases linearly with supply
 */
contract BondingCurve is Ownable, ReentrancyGuard {
    // Constants
    uint256 public constant GRADUATION_THRESHOLD = 69000 * 1e18; // $69k market cap in wei equivalent
    uint256 public constant PRECISION = 1e18;
    uint256 public constant INITIAL_PRICE = 1e12; // 0.000001 ETH initial price

    // State
    uint256 public platformFee = 100; // 1% = 100 basis points (out of 10000)
    address public feeRecipient;
    uint256 public pendingFees; // Accumulated fees for pull-based withdrawal

    struct TokenInfo {
        address tokenAddress;
        address creator;
        uint256 reserveBalance; // ETH in the curve
        uint256 totalSupply; // Tokens minted
        bool graduated;
        string name;
        string symbol;
        string imageUri;
        uint256 createdAt;
    }

    mapping(address => TokenInfo) public tokens;
    address[] public allTokens;

    // Events
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        string imageUri
    );
    event Buy(
        address indexed tokenAddress,
        address indexed buyer,
        uint256 ethIn,
        uint256 tokensOut,
        uint256 newPrice
    );
    event Sell(
        address indexed tokenAddress,
        address indexed seller,
        uint256 tokensIn,
        uint256 ethOut,
        uint256 newPrice
    );
    event Graduated(address indexed tokenAddress, uint256 finalMarketCap);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event GraduatedLiquidityWithdrawn(address indexed tokenAddress, address indexed recipient, uint256 amount);

    // Errors
    error TokenNotFound();
    error TokenGraduated();
    error TokenNotGraduated();
    error InsufficientPayment();
    error InsufficientTokens();
    error InsufficientReserve();
    error TransferFailed();
    error InvalidFee();
    error ZeroAmount();
    error ZeroAddress();
    error NoPendingFees();
    error SlippageExceeded();
    error OnlyFeeRecipient();

    constructor() Ownable(msg.sender) {
        feeRecipient = msg.sender;
    }

    /**
     * @notice Create a new bonding curve token
     * @param name Token name
     * @param symbol Token symbol
     * @param imageUri URI to token image (IPFS or HTTP)
     * @return tokenAddress Address of the newly created token
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata imageUri
    ) external returns (address tokenAddress) {
        VibeToken token = new VibeToken(name, symbol, imageUri, address(this));
        tokenAddress = address(token);

        tokens[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            reserveBalance: 0,
            totalSupply: 0,
            graduated: false,
            name: name,
            symbol: symbol,
            imageUri: imageUri,
            createdAt: block.timestamp
        });

        allTokens.push(tokenAddress);

        emit TokenCreated(tokenAddress, msg.sender, name, symbol, imageUri);
    }

    /**
     * @notice Buy tokens from the bonding curve
     * @param tokenAddress Address of the token to buy
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     */
    function buy(address tokenAddress, uint256 minTokensOut) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();

        TokenInfo storage token = tokens[tokenAddress];
        if (token.tokenAddress == address(0)) revert TokenNotFound();
        if (token.graduated) revert TokenGraduated();

        // Calculate and deduct platform fee
        uint256 fee = (msg.value * platformFee) / 10000;
        uint256 ethForPurchase = msg.value - fee;

        // Calculate tokens to mint using bonding curve formula
        uint256 tokensToMint = calculatePurchaseReturn(
            token.totalSupply,
            ethForPurchase
        );

        // Slippage protection
        if (tokensToMint < minTokensOut) revert SlippageExceeded();

        // Update state
        token.reserveBalance += ethForPurchase;
        token.totalSupply += tokensToMint;

        // Mint tokens to buyer
        VibeToken(tokenAddress).mint(msg.sender, tokensToMint);

        // Accumulate fee for pull-based withdrawal (prevents malicious feeRecipient from blocking buys)
        if (fee > 0) {
            pendingFees += fee;
        }

        // Check for graduation
        uint256 currentMarketCap = getMarketCap(tokenAddress);
        if (currentMarketCap >= GRADUATION_THRESHOLD) {
            _graduate(tokenAddress);
        }

        emit Buy(
            tokenAddress,
            msg.sender,
            msg.value,
            tokensToMint,
            getPrice(tokenAddress)
        );
    }

    /**
     * @notice Sell tokens back to the bonding curve
     * @param tokenAddress Address of the token to sell
     * @param tokenAmount Amount of tokens to sell
     * @param minEthOut Minimum ETH to receive (slippage protection)
     */
    function sell(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 minEthOut
    ) external nonReentrant {
        if (tokenAmount == 0) revert ZeroAmount();

        TokenInfo storage token = tokens[tokenAddress];
        if (token.tokenAddress == address(0)) revert TokenNotFound();
        if (token.graduated) revert TokenGraduated();

        // Check user has enough tokens
        if (VibeToken(tokenAddress).balanceOf(msg.sender) < tokenAmount) {
            revert InsufficientTokens();
        }

        // Calculate ETH to return using bonding curve formula
        uint256 ethToReturn = calculateSaleReturn(token.totalSupply, tokenAmount);

        // Calculate and deduct platform fee
        uint256 fee = (ethToReturn * platformFee) / 10000;
        uint256 ethToSeller = ethToReturn - fee;

        // Slippage protection
        if (ethToSeller < minEthOut) revert SlippageExceeded();

        if (token.reserveBalance < ethToReturn) revert InsufficientReserve();

        // Update state
        token.reserveBalance -= ethToReturn;
        token.totalSupply -= tokenAmount;

        // Burn tokens from seller
        VibeToken(tokenAddress).burn(msg.sender, tokenAmount);

        // Transfer ETH to seller
        (bool success, ) = msg.sender.call{value: ethToSeller}("");
        if (!success) revert TransferFailed();

        // Accumulate fee for pull-based withdrawal (prevents malicious feeRecipient from blocking sells)
        if (fee > 0) {
            pendingFees += fee;
        }

        emit Sell(
            tokenAddress,
            msg.sender,
            tokenAmount,
            ethToSeller,
            getPrice(tokenAddress)
        );
    }

    /**
     * @notice Graduate a token (internal function)
     * @dev Called automatically when market cap threshold is reached.
     *      The token is marked as graduated and trading is halted.
     *      The reserve ETH remains in the contract until withdrawn by owner
     *      via withdrawGraduatedLiquidity() for Uniswap liquidity migration.
     * @param tokenAddress Address of the token to graduate
     */
    function _graduate(address tokenAddress) internal {
        TokenInfo storage token = tokens[tokenAddress];
        token.graduated = true;

        // Note: Reserve ETH stays in contract. Owner must call withdrawGraduatedLiquidity()
        // to retrieve funds for Uniswap liquidity pool creation.

        emit Graduated(tokenAddress, getMarketCap(tokenAddress));
    }

    // ============ View Functions ============

    /**
     * @notice Get the current price of a token
     * @param tokenAddress Address of the token
     * @return price Current price in wei per token
     */
    function getPrice(address tokenAddress) public view returns (uint256 price) {
        TokenInfo storage token = tokens[tokenAddress];
        if (token.totalSupply == 0) {
            return INITIAL_PRICE;
        }
        // Linear bonding curve: price = k * supply
        // k = INITIAL_PRICE / PRECISION
        return INITIAL_PRICE + (token.totalSupply * INITIAL_PRICE) / (1000 * PRECISION);
    }

    /**
     * @notice Get the market cap of a token
     * @param tokenAddress Address of the token
     * @return marketCap Current market cap in wei
     */
    function getMarketCap(
        address tokenAddress
    ) public view returns (uint256 marketCap) {
        TokenInfo storage token = tokens[tokenAddress];
        uint256 price = getPrice(tokenAddress);
        return (price * token.totalSupply) / PRECISION;
    }

    /**
     * @notice Calculate how many tokens you get for a given ETH amount
     * @dev Mathematical derivation for linear bonding curve:
     *
     *      Price function: P(S) = INITIAL_PRICE + k * S
     *      where k = INITIAL_PRICE / (1000 * PRECISION)
     *
     *      Cost to buy from S0 to S1 = integral of P(S) from S0 to S1
     *      = [INITIAL_PRICE * S + k * S^2 / 2] from S0 to S1
     *      = INITIAL_PRICE * (S1 - S0) + k * (S1^2 - S0^2) / 2
     *
     *      Simplified (ignoring linear term for approximation):
     *      ETH ≈ k * (S1^2 - S0^2) / 2
     *
     *      Solving for S1:
     *      S1 = sqrt(S0^2 + 2 * ETH / k)
     *      tokensOut = S1 - S0
     *
     * @param currentSupply Current token supply (S0)
     * @param ethAmount ETH amount to spend
     * @return tokensOut Number of tokens to receive (S1 - S0)
     */
    function calculatePurchaseReturn(
        uint256 currentSupply,
        uint256 ethAmount
    ) public pure returns (uint256 tokensOut) {
        uint256 k = INITIAL_PRICE;

        // Calculate 2 * ETH / k with proper scaling
        // factor = 2 * ethAmount * 1000 * PRECISION / INITIAL_PRICE
        uint256 factor = (2 * ethAmount * 1000 * PRECISION) / k;

        // Calculate (S0^2 + factor * PRECISION) to avoid early precision loss
        // We keep everything scaled by PRECISION until the final sqrt
        uint256 currentSupplySquared = currentSupply * currentSupply;
        // newSupplySquared * PRECISION = currentSupplySquared + factor * PRECISION
        // This avoids dividing currentSupplySquared by PRECISION early (which loses precision)
        uint256 newSupplySquaredScaled = currentSupplySquared + (factor * PRECISION);

        // S1 = sqrt(newSupplySquaredScaled)
        uint256 newSupply = sqrt(newSupplySquaredScaled);

        return newSupply > currentSupply ? newSupply - currentSupply : 0;
    }

    /**
     * @notice Calculate how much ETH you get for selling tokens
     * @param currentSupply Current token supply
     * @param tokenAmount Tokens to sell
     * @return ethOut ETH amount to receive
     */
    function calculateSaleReturn(
        uint256 currentSupply,
        uint256 tokenAmount
    ) public pure returns (uint256 ethOut) {
        if (tokenAmount > currentSupply) return 0;

        // Using the integral: ETH = k * (S0^2 - S1^2) / 2
        // where S1 = S0 - tokenAmount

        uint256 newSupply = currentSupply - tokenAmount;
        uint256 k = INITIAL_PRICE;

        // ETH = k * (currentSupply^2 - newSupply^2) / (2 * 1000 * PRECISION)
        // Calculate squares first, then difference, to minimize precision loss
        uint256 currentSupplySquared = currentSupply * currentSupply;
        uint256 newSupplySquared = newSupply * newSupply;
        uint256 supplyDiffSquared = (currentSupplySquared - newSupplySquared) / PRECISION;

        return (k * supplyDiffSquared) / (2 * 1000 * PRECISION);
    }

    /**
     * @notice Get all token addresses
     * @return Array of all token addresses
     */
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    /**
     * @notice Get the number of tokens created
     * @return Number of tokens
     */
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @notice Get token info
     * @param tokenAddress Address of the token
     * @return TokenInfo struct
     */
    function getTokenInfo(
        address tokenAddress
    ) external view returns (TokenInfo memory) {
        return tokens[tokenAddress];
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the platform fee
     * @param newFee New fee in basis points (100 = 1%)
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        if (newFee > 1000) revert InvalidFee(); // Max 10%
        uint256 oldFee = platformFee;
        platformFee = newFee;
        emit PlatformFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update the fee recipient address
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    /**
     * @notice Withdraw accumulated platform fees (pull-based pattern)
     * @dev Can only be called by fee recipient to withdraw their accumulated fees
     */
    function withdrawPendingFees() external nonReentrant {
        if (msg.sender != feeRecipient) revert OnlyFeeRecipient();

        uint256 amount = pendingFees;
        if (amount == 0) revert NoPendingFees();

        pendingFees = 0;

        (bool success, ) = feeRecipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(feeRecipient, amount);
    }

    /**
     * @notice Withdraw ETH from a graduated token for Uniswap liquidity migration
     * @dev Only callable by owner. This is the mechanism to retrieve locked ETH
     *      from graduated tokens for creating Uniswap liquidity pools.
     * @param tokenAddress Address of the graduated token
     * @param recipient Address to receive the ETH
     */
    function withdrawGraduatedLiquidity(
        address tokenAddress,
        address recipient
    ) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();

        TokenInfo storage token = tokens[tokenAddress];
        if (token.tokenAddress == address(0)) revert TokenNotFound();
        if (!token.graduated) revert TokenNotGraduated();

        uint256 amount = token.reserveBalance;
        if (amount == 0) revert InsufficientReserve();

        token.reserveBalance = 0;

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit GraduatedLiquidityWithdrawn(tokenAddress, recipient, amount);
    }

    // ============ Internal Helpers ============

    /**
     * @notice Babylonian square root
     * @param x Number to find square root of
     * @return y Square root of x
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title VibeToken
 * @notice ERC20 token created by the BondingCurve factory
 * @dev Only the bonding curve contract can mint/burn tokens.
 *
 * TRUST ASSUMPTION: The bonding curve contract has unrestricted mint/burn access.
 * This is by design - users trust the BondingCurve contract to only mint during
 * buy() operations and only burn during sell() operations initiated by the token holder.
 * The BondingCurve contract enforces that burn() is only called when the user
 * initiates a sell and has sufficient balance.
 */
contract VibeToken is ERC20 {
    address public immutable bondingCurve;
    string public imageUri;

    error OnlyBondingCurve();

    modifier onlyBondingCurve() {
        if (msg.sender != bondingCurve) revert OnlyBondingCurve();
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _imageUri,
        address _bondingCurve
    ) ERC20(_name, _symbol) {
        bondingCurve = _bondingCurve;
        imageUri = _imageUri;
    }

    /**
     * @notice Mint tokens to an address
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyBondingCurve {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from an address
     * @dev This function burns tokens without requiring approval from the holder.
     *      This is safe because only the BondingCurve contract can call it, and the
     *      BondingCurve.sell() function verifies the caller owns the tokens before burning.
     *      See BondingCurve.sol sell() function - the balance check at line ~180 ensures
     *      the seller owns sufficient tokens before this burn is called.
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external onlyBondingCurve {
        _burn(from, amount);
    }
}

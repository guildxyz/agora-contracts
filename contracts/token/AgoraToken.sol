// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title A mintable ERC20 token used by agora.space
contract AgoraToken is ERC20, Ownable {
    uint8 private immutable tokenDecimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) {
        tokenDecimals = _decimals;
    }

    /// @dev See {ERC20-decimals}
    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    /// @notice Mints tokens to an account
    /// @param _account The address receiving the tokens
    /// @param _amount The amount of tokens to be minted
    function mint(address _account, uint256 _amount) external onlyOwner {
        _mint(_account, _amount);
    }

    /// @notice Burns tokens from an account
    /// @param _account The address the tokens will be burnt from
    /// @param _amount The amount of tokens to be burned
    function burn(address _account, uint256 _amount) external onlyOwner {
        _burn(_account, _amount);
    }
}

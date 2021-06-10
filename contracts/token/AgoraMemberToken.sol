// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title A mintable ERC20 token used by agora.space in their Bank contract to represent members.
contract AgoraMemberToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @notice Apart from initializing an ERC20 token, this grants the deployer the minter role.
     * The deployer should grant it to governance and revoke it from themselves.
     * The governance should grant it to the contracts that need it.
     */
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _setupRole(MINTER_ROLE, msg.sender);
        _setRoleAdmin(MINTER_ROLE, MINTER_ROLE); // It's own admin
    }

    /// @notice Mints tokens to an account
    /// @param _account The address receiving the tokens
    /// @param _amount The amount of tokens to be minted
    function mint(address _account, uint256 _amount) external {
        require(hasRole(MINTER_ROLE, _msgSender()), "!minter");
        _mint(_account, _amount);
    }

    /// @notice Burns tokens from an account
    /// @param _account The address the tokens will be burnt from
    /// @param _amount The amount of tokens to be burned
    function burn(address _account, uint256 _amount) external {
        require(hasRole(MINTER_ROLE, _msgSender()), "!minter");
        _burn(_account, _amount);
    }
}

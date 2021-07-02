// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title A mintable ERC20 token used by agora.space in their Bank contract to represent members.
contract AgoraMemberToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @notice Apart from initializing an ERC20 token, this grants the deployer the DEFAULT_ADMIN_ROLE.
     * The deployer should grant it to governance and revoke it from themselves.
     * The governance should then grant the MINTER_ROLE to the contracts that need it.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _mint(msg.sender, _initialSupply);
    }

    /// @notice Mints tokens to an account
    /// @param _account The address receiving the tokens
    /// @param _amount The amount of tokens to be minted
    function mint(address _account, uint256 _amount) external {
        require(hasRole(MINTER_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Minting failed");
        _mint(_account, _amount);
    }
}

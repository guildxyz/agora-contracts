// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title A contract that can pause it's functionality
contract Freezable is Ownable {
    bool public frozen;

    event SpaceFrozenState(bool frozen);

    error SpaceIsFrozen();
    error SpaceIsNotFrozen();

    modifier notFrozen() {
        if (frozen) revert SpaceIsFrozen();
        _;
    }

    /// @notice Disables the deposit and withdraw functions and enables emergencyWithdraw if input is true
    /// @notice Enables the deposit and withdraw functions and disables emergencyWithdraw if input is false
    /// @dev function call must change the state of the contract
    /// @param _frozen The new state of the contract
    function freezeSpace(bool _frozen) external onlyOwner {
        if (!frozen && !_frozen) revert SpaceIsNotFrozen();
        if (frozen && _frozen) revert SpaceIsFrozen();
        frozen = _frozen;
        emit SpaceFrozenState(frozen);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./Freezable.sol";

/// @title A contract to store and manage ranks
contract RankManager is Freezable {
    uint256 public numOfRanks;

    struct Rank {
        uint256 minDuration;
        uint256 goalAmount;
    }

    // Bigger id equals higher rank
    mapping(uint256 => Rank) public ranks;

    event NewRank(uint256 minDuration, uint256 goalAmount, uint256 id);
    event ModifyRank(uint256 minDuration, uint256 goalAmount, uint256 id);

    error NewDurationTooShort(uint256 value, uint256 minValue);
    error NewDurationTooLong(uint256 value, uint256 maxValue);
    error NewGoalTooSmall(uint256 value, uint256 minValue);
    error NewGoalTooBig(uint256 value, uint256 maxValue);
    error TooManyRanks();
    error NoRanks();
    error InvalidRank();

    /// @notice Creates a new rank
    /// @dev Only the new highest rank can be added
    /// @dev The goal amount and the lock time can't be lower than in the previous rank
    /// @param _minDuration The duration of the lock
    /// @param _goalAmount The amount of tokens needed to reach the rank
    function addRank(uint256 _minDuration, uint256 _goalAmount) external onlyOwner {
        if (numOfRanks >= 255) revert TooManyRanks();
        if (numOfRanks >= 1) {
            if (ranks[numOfRanks - 1].goalAmount > _goalAmount)
                revert NewGoalTooSmall({value: _goalAmount, minValue: ranks[numOfRanks - 1].goalAmount});
            if (ranks[numOfRanks - 1].minDuration > _minDuration)
                revert NewDurationTooShort({value: _minDuration, minValue: ranks[numOfRanks - 1].minDuration});
        }
        ranks[numOfRanks] = (Rank(_minDuration, _goalAmount));
        emit NewRank(_minDuration, _goalAmount, numOfRanks);
        numOfRanks++;
    }

    /// @notice Modifies a rank
    /// @dev Values must be between the previous and the next ranks'
    /// @param _minDuration New duration of the lock
    /// @param _goalAmount New amount of tokens needed to reach the rank
    /// @param _id The id of the rank to be modified
    function modifyRank(
        uint256 _minDuration,
        uint256 _goalAmount,
        uint256 _id
    ) external onlyOwner {
        if (numOfRanks < 1) revert NoRanks();
        if (_id >= numOfRanks) revert InvalidRank();
        if (_id > 0) {
            if (ranks[_id - 1].goalAmount > _goalAmount)
                revert NewGoalTooSmall({value: _goalAmount, minValue: ranks[numOfRanks - 1].goalAmount});
            if (ranks[numOfRanks - 1].minDuration > _minDuration)
                revert NewDurationTooShort({value: _minDuration, minValue: ranks[numOfRanks - 1].minDuration});
        }
        if (_id < numOfRanks - 1) {
            if (ranks[_id + 1].goalAmount < _goalAmount)
                revert NewGoalTooBig({value: _goalAmount, maxValue: ranks[_id + 1].goalAmount});
            if (ranks[_id + 1].minDuration < _minDuration)
                revert NewDurationTooLong({value: _minDuration, maxValue: ranks[_id + 1].minDuration});
        }
        ranks[_id] = Rank(_minDuration, _goalAmount);
        emit ModifyRank(_minDuration, _goalAmount, _id);
    }
}

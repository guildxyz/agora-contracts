// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./token/IAgoraToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title The central contract of agora.space, keeping track of the community member limits and distributing rewards
contract AgoraBank is Ownable {
    address public immutable agoAddress;
    uint256 public rewardPerBlock = 100000000000000000; // 0.1 AGO by default
    uint256 public lockInterval = 586868; // by default around 90 days with 13.25s block time
    uint256 public totalStakes;

    struct StakeItem {
        uint256 amount;
        uint128 lockExpires;
        uint128 countRewardsFrom;
    }
    mapping(uint256 => mapping(address => StakeItem)) public stakes; // communityId -> user -> stake

    event Deposit(uint256 indexed communityId, address indexed wallet, uint256 amount);
    event Withdraw(uint256 indexed communityId, address indexed wallet, uint256 amount);
    event RewardClaimed(uint256[] communityIds, address indexed wallet);
    event RewardChanged(uint256 newRewardPerBlock);

    /// @notice Sets the address of the token minted for staking
    constructor(address _agoAddress) {
        agoAddress = _agoAddress;
    }

    /// @notice Stakes AGO token and registers it. Claims rewards automatically
    /// @param _communityId The community's id, to which the stake will belong to
    /// @param _amount The amount to stake.
    function deposit(uint256 _communityId, uint256 _amount) external {
        // Claim rewards in the community
        uint256[] memory communityArray = new uint256[](1);
        communityArray[0] = _communityId;
        claimReward(communityArray);
        // Register the stake details
        stakes[_communityId][msg.sender].amount += _amount;
        stakes[_communityId][msg.sender].lockExpires = uint128(block.number + lockInterval);
        totalStakes += _amount;
        // Actually get the tokens
        IAgoraToken(agoAddress).transferFrom(msg.sender, address(this), _amount);
        emit Deposit(_communityId, msg.sender, _amount);
    }

    /// @notice Withdraws a certain amount of staked tokens if the timelock expired. Claims rewards automatically
    /// @param _communityId The community's id, to which the stake belongs
    /// @param _amount The amount to unstake
    function withdraw(uint256 _communityId, uint256 _amount) external {
        StakeItem storage stakeData = stakes[_communityId][msg.sender];
        // Test timelock
        require(stakeData.lockExpires < block.number, "Stake still locked");
        // Claim rewards in the community
        uint256[] memory communityArray = new uint256[](1);
        communityArray[0] = _communityId;
        claimReward(communityArray);
        // Modify tne stake details
        stakeData.amount -= _amount; // Will revert if the user tries to withdraw more than staked
        totalStakes -= _amount;
        // // Actually send the withdraw amount
        IAgoraToken(agoAddress).transfer(msg.sender, _amount);
        emit Withdraw(_communityId, msg.sender, _amount);
    }

    /// @notice Mints the reward for the sender based on the stakes in an array of communities
    /// @dev The rewards will be calculated from the current block in these communities on the next call
    /// @param _communityIds An array of those communities' id's, where the staking reward should be claimed
    function claimReward(uint256[] memory _communityIds) public {
        uint256 userStakes;
        uint256 elapsedBlocks;
        for (uint256 i = 0; i < _communityIds.length; i++) {
            uint256 stakeInCommunity = stakes[_communityIds[i]][msg.sender].amount;
            if (stakeInCommunity > 0) {
                userStakes += stakeInCommunity;
                elapsedBlocks += block.number - stakes[_communityIds[i]][msg.sender].countRewardsFrom;
            }
            stakes[_communityIds[i]][msg.sender].countRewardsFrom = uint128(block.number);
        }
        if (userStakes > 0)
            IAgoraToken(agoAddress).mint(msg.sender, (elapsedBlocks * rewardPerBlock * userStakes) / totalStakes);
        emit RewardClaimed(_communityIds, msg.sender);
    }

    /// @notice Changes the amount of AGO to be minted per block as a reward
    /// @param _rewardAmount The amount of AGO in wei
    function changeRewardPerBlock(uint256 _rewardAmount) external onlyOwner {
        rewardPerBlock = _rewardAmount;
        emit RewardChanged(_rewardAmount);
    }

    /// @notice Changes the number of blocks the stakes will be locked for
    /// @param _blocks The number of blocks
    function changeTimelockInterval(uint256 _blocks) external onlyOwner {
        lockInterval = _blocks;
    }

    /// @notice Calculates the reward for the sender based on the stakes in an array of communities
    /// @dev The same logic as in claimReward
    /// @param _communityIds An array of those communities' id's, where the staking reward should be calculated
    function getReward(uint256[] calldata _communityIds) external view returns (uint256) {
        uint256 userStakes;
        uint256 elapsedBlocks;
        for (uint256 i = 0; i < _communityIds.length; i++) {
            uint256 stakeInCommunity = stakes[_communityIds[i]][msg.sender].amount;
            if (stakeInCommunity > 0) {
                userStakes += stakeInCommunity;
                elapsedBlocks += block.number - stakes[_communityIds[i]][msg.sender].countRewardsFrom;
            }
        }
        return (elapsedBlocks * rewardPerBlock * userStakes) / totalStakes;
    }
}
